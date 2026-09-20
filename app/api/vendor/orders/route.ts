import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Order, Product, User } from "@/models";
import {
  createdResponse,
  paginatedResponse,
} from "@/lib/api/response";
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { PAYMENT_STATUS, USER_ROLES } from "@/config/app.config";
import type { IUser } from "@/types";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody, validateQuery } from "@/lib/api/validate";
import {
  AdminCreateOrderSchema,
  OrderListQuerySchema,
} from "@/lib/validations";
import { getNextOnlineOrderNumber } from "@/lib/order-number";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";
import { buildVendorSubOrders } from "@/lib/order-vendors";
import {
  decrementInventory,
  restoreInventory,
  InsufficientStockError,
  type InventoryAdjustmentLine,
} from "@/lib/inventory";
import { markOrderInventoryReserved } from "@/lib/order-inventory";
import { notifyOrderCreatedParticipants } from "@/lib/notifications";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { withApi } from "@/lib/api/handler";

type ViewType = "all" | "unfulfilled" | "unpaid" | "open" | "archived";

function getStatusesForView(view: ViewType): string[] | null {
  switch (view) {
    case "unfulfilled":
      return ["pending", "processing"];
    case "open":
      return ["pending", "processing", "shipped"];
    case "archived":
      return ["delivered", "cancelled"];
    default:
      return null;
  }
}

/**
 * GET /api/vendor/orders
 * Get orders for the current vendor
 * Requires: VIEW_ORDERS permission
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_ORDERS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError("You do not have permission to view orders");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:orders:list",
      "lenient",
      session.user.role,
    );

    const {
      page,
      limit,
      search,
      status,
      paymentStatus,
      view,
      sortBy,
      sortOrder,
    } = validateQuery(request, OrderListQuerySchema);

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const skip = (page - 1) * limit;

    const andConditions: Record<string, unknown>[] = [];

    const statusFromView = getStatusesForView((view || "all") as ViewType);
    let subOrderStatusCondition: Record<string, unknown> | undefined;

    if (status && status !== "all") {
      if (statusFromView && !statusFromView.includes(status)) {
        return paginatedResponse([], page, limit, 0);
      }
      subOrderStatusCondition = { status };
    } else if (statusFromView) {
      subOrderStatusCondition = { status: { $in: statusFromView } };
    }

    andConditions.push({
      subOrders: {
        $elemMatch: {
          vendorId: vendor._id,
          ...(subOrderStatusCondition || {}),
        },
      },
    });

    if (paymentStatus && paymentStatus !== "all") {
      andConditions.push({ paymentStatus });
    }

    if (view === "unpaid") {
      andConditions.push({ paymentStatus: { $in: ["pending", "partially_paid"] } });
    }

    if (search) {
      andConditions.push({
        $or: [{ orderNumber: { $regex: search, $options: "i" } }],
      });
    }

    const query: Record<string, unknown> =
      andConditions.length > 0 ? { $and: andConditions } : {};

    const allowedSortFields = new Set([
      "createdAt",
      "orderNumber",
      "paymentStatus",
      "total",
    ]);
    const effectiveSortBy =
      sortBy && allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customerId", "name email")
        .sort({ [effectiveSortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const vendorOrders = orders.map((order) => ({
      ...order,
      subOrders: order.subOrders.filter(
        (sub: { vendorId?: { toString: () => string } }) =>
          sub.vendorId?.toString() === vendor._id.toString(),
      ),
    }));

    return paginatedResponse(vendorOrders, page, limit, total);
  },
);

type VendorCreateOrderLine = {
  productId: string;
  variantId?: string;
  quantity: number;
};

type ResolvedVendorOrderLine = VendorCreateOrderLine & {
  name: string;
  sku: string;
  price: number;
  image?: string;
};

function idsMatch(left: unknown, right?: string) {
  if (!left || !right) return false;
  return String((left as { _id?: unknown })?._id || left) === right;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * POST /api/vendor/orders
 * Create a manual order on behalf of the current vendor. Every item must
 * belong to this vendor; the resulting order has a single sub-order owned by
 * this vendor.
 * Requires: CREATE_ORDERS or MANAGE_ORDERS permission
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();

    const user = session.user as unknown as IUser;
    const canCreate = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.CREATE_ORDERS,
    );
    const canManage = canCreate
      ? true
      : await hasVendorPermission(user, VENDOR_PERMISSIONS.MANAGE_ORDERS);
    if (!canCreate && !canManage && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to create orders",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:orders:create",
      "moderate",
      session.user.role,
    );

    const body = await validateBody(request, AdminCreateOrderSchema);

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const customer = await User.findOne({
      _id: body.customerId,
      role: USER_ROLES.CUSTOMER,
    })
      .select("_id")
      .lean();
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const productIds = Array.from(new Set(body.items.map((line) => line.productId)));
    const products = await Product.find({
      _id: { $in: productIds },
      vendorId: vendor._id,
    }).lean();

    if (products.length !== productIds.length) {
      throw new ValidationError(
        "One or more selected products do not belong to your store",
      );
    }
    const productById = new Map(products.map((p) => [String(p._id), p]));

    const resolvedLines: ResolvedVendorOrderLine[] = body.items.map((line) => {
      const product = productById.get(line.productId);
      if (!product) {
        throw new ValidationError("Selected product not found");
      }
      const variants = (product.variants || []) as Array<{
        _id?: unknown;
        name?: string;
        sku?: string;
        price?: number;
        image?: string;
      }>;
      const variant = line.variantId
        ? variants.find((v) => idsMatch(v._id, line.variantId))
        : undefined;
      if (line.variantId && !variant) {
        throw new ValidationError("Selected product variant was not found");
      }
      const productName = product.title || product.name || "Product";
      const variantName =
        variant?.name && variant.name !== "Default Title" ? variant.name : "";
      return {
        ...line,
        name: variantName ? `${productName} - ${variantName}` : productName,
        sku: variant?.sku || product.sku || "",
        price: Number(variant?.price ?? product.price ?? 0),
        image: variant?.image || product.images?.[0],
      };
    });

    const subtotal = roundMoney(
      resolvedLines.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );
    const discount = Math.min(roundMoney(body.discount), subtotal);
    const taxableSubtotal = Math.max(subtotal - discount, 0);
    const tax = roundMoney(taxableSubtotal * (body.taxRate / 100));
    const shippingCost = roundMoney(body.shippingCost);
    const total = roundMoney(taxableSubtotal + tax + shippingCost);

    const vendorIdString = String(vendor._id);
    const vendorGroups = new Map<string, ResolvedVendorOrderLine[]>();
    vendorGroups.set(vendorIdString, resolvedLines);

    const subOrders = await buildVendorSubOrders(vendorGroups, {
      getProductId: (item) => new Types.ObjectId(item.productId),
      getVariantId: (item) =>
        item.variantId ? new Types.ObjectId(item.variantId) : undefined,
      getName: (item) => item.name,
      getSku: (item) => item.sku,
      getQuantity: (item) => item.quantity,
      getPrice: (item) => item.price,
      getImage: (item) => item.image,
      fallbackCommissionPercent:
        settings.orders?.commission?.vendorRate ?? DEFAULT_VENDOR_COMMISSION_RATE,
      status: "pending",
    });

    const inventoryLines: InventoryAdjustmentLine[] = resolvedLines.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    try {
      await decrementInventory(inventoryLines);
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        throw new ValidationError(
          "Some selected items do not have enough stock",
        );
      }
      throw err;
    }
    revalidateProductContent({
      slugs: products
        .map((p) => p.slug)
        .filter(
          (slug): slug is string =>
            typeof slug === "string" && slug.length > 0,
        ),
    });

    let order;
    try {
      order = await Order.create({
        orderNumber: await getNextOnlineOrderNumber(settings.orders?.prefix),
        customerId: body.customerId,
        items: resolvedLines.map((item) => ({
          productId: new Types.ObjectId(item.productId),
          variantId: item.variantId
            ? new Types.ObjectId(item.variantId)
            : undefined,
          vendorId: vendor._id,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        subOrders,
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress || body.shippingAddress,
        paymentMethod: body.paymentMethod,
        paymentStatus: body.paymentStatus,
        subtotal,
        shippingCost,
        tax,
        discount,
        total,
        status: "pending",
        channel: "online",
        staffId: session.user.id,
        notes: body.notes,
      });
    } catch (err) {
      await restoreInventory(inventoryLines).catch((restoreErr) =>
        console.error(
          "Failed to restore inventory after vendor order failure:",
          restoreErr,
        ),
      );
      throw err;
    }

    await markOrderInventoryReserved(String(order._id)).catch((err) =>
      console.error(
        "Failed to mark inventory reserved on vendor order:",
        err,
      ),
    );

    await notifyOrderCreatedParticipants(order).catch((err) =>
      console.error("Failed to create vendor order notifications:", err),
    );

    return createdResponse(
      {
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        paymentStatus: order.paymentStatus || PAYMENT_STATUS.PENDING,
      },
      "Order created successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
