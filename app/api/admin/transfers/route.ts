import { connectDB } from "@/lib/db";
import { InventoryLocation, Product, Transfer } from "@/models";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { ValidationError } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { generateTransferNumber } from "@/lib/transfers";
import { withApi } from "@/lib/api/handler";

type TransferCreateItem = {
  productId: string;
  variantId: string;
  quantity: number;
  productTitle?: string;
  variantTitle?: string;
  sku?: string;
};

async function validateItemsAtSourceLocation(
  fromLocationId: string,
  items: TransferCreateItem[],
) {
  const grouped = new Map<string, TransferCreateItem[]>();

  for (const item of items) {
    if (!grouped.has(item.productId)) {
      grouped.set(item.productId, []);
    }
    grouped.get(item.productId)!.push(item);
  }

  for (const [productId, lines] of grouped) {
    const product = await Product.findById(productId)
      .select("title name variants")
      .lean();
    if (!product) {
      throw new ValidationError("Selected product no longer exists");
    }

    for (const line of lines) {
      const variant = Array.isArray(product.variants)
        ? product.variants.find(
            (v: {
              _id?: { toString: () => string };
              locationInventory?: Array<{ locationId: string; quantity: number }>;
              stock?: number;
              name?: string;
              sku?: string;
            }) => String(v._id) === line.variantId,
          )
        : undefined;

      if (!variant) {
        throw new ValidationError("Selected variant no longer exists");
      }

      const sourceQty = (variant.locationInventory || []).find(
        (entry: { locationId: string; quantity: number }) =>
          String(entry.locationId) === fromLocationId,
      )?.quantity;

      if (typeof sourceQty !== "number" || sourceQty < line.quantity) {
        throw new ValidationError(
          `Insufficient stock at source location for ${(product.title || product.name || "item") as string}`,
        );
      }
    }
  }
}

/**
 * GET /api/admin/transfers
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_INVENTORY],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:transfers:list",
      "lenient",
      session.user.role,
    );

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const status = (searchParams.get("status") || "all").trim();
    const search = (searchParams.get("search") || "").trim();
    const sortBy = (searchParams.get("sortBy") || "").trim();
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    await connectDB();

    const query: Record<string, unknown> = {};

    if (status !== "all") {
      query.status = status;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { transferNumber: { $regex: escaped, $options: "i" } },
        { fromLocationName: { $regex: escaped, $options: "i" } },
        { toLocationName: { $regex: escaped, $options: "i" } },
        { reference: { $regex: escaped, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const allowedSortFields = new Set([
      "createdAt",
      "updatedAt",
      "transferNumber",
      "status",
    ]);
    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortBy && allowedSortFields.has(sortBy)) {
      sort = sortBy === "createdAt"
        ? { createdAt: sortOrder }
        : { [sortBy]: sortOrder, createdAt: -1 };
    }

    const [records, total, statusAgg] = await Promise.all([
      Transfer.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Transfer.countDocuments(query),
      Transfer.aggregate([
        { $match: search ? query : {} },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const totalsByStatus = statusAgg.reduce(
      (acc: Record<string, number>, row: { _id: string; count: number }) => {
        if (row?._id) acc[row._id] = row.count || 0;
        return acc;
      },
      {},
    );

    return successResponse({
      items: records.map((record) => ({
        _id: String(record._id),
        transferNumber: record.transferNumber,
        status: record.status,
        fromLocationName: record.fromLocationName,
        toLocationName: record.toLocationName,
        itemCount: Array.isArray(record.items)
          ? record.items.reduce(
              (sum: number, item: { quantity?: number }) =>
                sum + (Number(item.quantity) || 0),
              0,
            )
          : 0,
        totalLines: Array.isArray(record.items) ? record.items.length : 0,
        updatedAt: record.updatedAt,
        createdAt: record.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      counters: {
        all: total,
        draft: totalsByStatus.draft || 0,
        ready_to_ship: totalsByStatus.ready_to_ship || 0,
        in_transit: totalsByStatus.in_transit || 0,
        completed: totalsByStatus.completed || 0,
        cancelled: totalsByStatus.cancelled || 0,
      },
    });
  },
);

/**
 * POST /api/admin/transfers
 */
export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [
        STAFF_PERMISSIONS.CREATE_INVENTORY,
        STAFF_PERMISSIONS.MANAGE_INVENTORY,
      ],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:transfers:create",
      "moderate",
      session.user.role,
    );

    const body = await request.json();
    const fromLocationId = String(body.fromLocationId || "").trim();
    const toLocationId = String(body.toLocationId || "").trim();
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const reference =
      typeof body.reference === "string" ? body.reference.trim() : "";
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!fromLocationId || !toLocationId) {
      throw new ValidationError("From and To locations are required");
    }

    if (fromLocationId === toLocationId) {
      throw new ValidationError("Source and destination must be different");
    }

    const items: TransferCreateItem[] = rawItems
      .map((item: unknown) => {
        const row = item as Record<string, unknown>;
        return {
          productId: String(row.productId || "").trim(),
          variantId: String(row.variantId || "").trim(),
          quantity: Math.max(0, Number(row.quantity || 0)),
          productTitle:
            typeof row.productTitle === "string" ? row.productTitle.trim() : "",
          variantTitle:
            typeof row.variantTitle === "string" ? row.variantTitle.trim() : "",
          sku: typeof row.sku === "string" ? row.sku.trim() : "",
        };
      })
      .filter(
        (item: TransferCreateItem) =>
          item.productId && item.variantId && item.quantity > 0,
      );

    if (!items.length) {
      throw new ValidationError("At least one transfer item is required");
    }

    await connectDB();

    const [fromLocation, toLocation] = await Promise.all([
      InventoryLocation.findOne({ _id: fromLocationId, isActive: true })
        .select("name")
        .lean(),
      InventoryLocation.findOne({ _id: toLocationId, isActive: true })
        .select("name")
        .lean(),
    ]);

    if (!fromLocation || !toLocation) {
      throw new ValidationError("One or more selected locations are invalid");
    }

    await validateItemsAtSourceLocation(fromLocationId, items);

    const transfer = await Transfer.create({
      transferNumber: await generateTransferNumber(),
      fromLocationId,
      fromLocationName: fromLocation.name,
      toLocationId,
      toLocationName: toLocation.name,
      status: "draft",
      note,
      reference,
      createdBy: String(session.user.id),
      items,
    });

    return successResponse(
      {
        transferId: String(transfer._id),
      },
      "Transfer created",
      201,
    );
  },
);
