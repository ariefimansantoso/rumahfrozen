import { Types } from "mongoose";
import { Order, Product, User } from "@/models";
import { connectDB } from "@/lib/db";
import { NextRequest } from "next/server";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PAYMENT_STATUS, USER_ROLES } from "@/config/app.config";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { AdminCreateOrderSchema, OrderListQuerySchema } from "@/lib/validations";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffOrderScopeFilter,
  buildStaffProductScopeFilter,
  hasStaffScope,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import { getSettings } from "@/models/settings.model";
import { getNextOnlineOrderNumber } from "@/lib/order-number";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";
import {
  buildVendorSubOrders,
  getOrderItemVendorId,
  groupItemsByOrderVendor,
  resolveOrderVendorContextForItems,
} from "@/lib/order-vendors";
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

type AdminCreateOrderLine = {
  productId: string;
  variantId?: string;
  quantity: number;
};

type ResolvedAdminOrderLine = AdminCreateOrderLine & {
  product: {
    _id: unknown;
    name?: string;
    title?: string;
    sku?: string;
    price?: number;
    stock?: number;
    images?: string[];
    vendorId?: unknown;
    variants?: Array<{
      _id?: unknown;
      name?: string;
      sku?: string;
      price?: number;
      stock?: number;
      image?: string;
    }>;
  };
  variant?: {
    _id?: unknown;
    name?: string;
    sku?: string;
    price?: number;
    stock?: number;
    image?: string;
  };
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

async function resolveAdminOrderLines(
  lines: AdminCreateOrderLine[],
): Promise<ResolvedAdminOrderLine[]> {
  const productIds = Array.from(new Set(lines.map((line) => line.productId)));
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  return lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) {
      throw new NotFoundError("Product");
    }

    const variants = (product.variants || []) as ResolvedAdminOrderLine["product"]["variants"];
    const variant = line.variantId
      ? variants?.find((item) => idsMatch(item._id, line.variantId))
      : undefined;

    if (line.variantId && !variant) {
      throw new ValidationError("Selected product variant was not found");
    }

    const productName = product.title || product.name || "Product";
    const variantName = variant?.name && variant.name !== "Default Title" ? variant.name : "";

    return {
      ...line,
      product,
      variant,
      name: variantName ? `${productName} - ${variantName}` : productName,
      sku: variant?.sku || product.sku || "",
      price: Number(variant?.price ?? product.price ?? 0),
      image: variant?.image || product.images?.[0],
    };
  });
}

/**
 * GET /api/admin/orders
 * Get all orders for admin
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:orders:list",
      "lenient",
      session.user.role
    );

    const { page, limit, search, status, paymentStatus, channel, view, sortBy, sortOrder } =
      validateQuery(request, OrderListQuerySchema);

    await connectDB();

    const skip = (page - 1) * limit;

    const andConditions: Record<string, unknown>[] = [];

    if (view && view !== "all") {
      if (view === "unfulfilled") {
        andConditions.push({ status: { $in: ["pending", "processing"] } });
      } else if (view === "unpaid") {
        andConditions.push({ paymentStatus: { $in: ["pending", "partially_paid"] } });
      } else if (view === "open") {
        andConditions.push({ status: { $nin: ["delivered", "cancelled"] } });
      } else if (view === "archived") {
        andConditions.push({ status: { $in: ["delivered", "cancelled"] } });
      }
    }

    if (status && status !== "all") {
      andConditions.push({ status });
    }

    if (paymentStatus && paymentStatus !== "all") {
      andConditions.push({ paymentStatus });
    }

    if (channel && channel !== "all") {
      andConditions.push({ channel });
    }

    if (search) {
      andConditions.push({
        $or: [{ orderNumber: { $regex: search, $options: "i" } }],
      });
    }

    const baseQuery: Record<string, unknown> =
      andConditions.length > 0 ? { $and: andConditions } : {};
    const query = mergeScopeFilter(
      baseQuery,
      buildStaffOrderScopeFilter(access.staffScope),
    );

    const allowedSortFields = new Set([
      "createdAt",
      "total",
      "orderNumber",
      "status",
      "paymentStatus",
    ]);
    const effectiveSortBy =
      sortBy && allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [effectiveSortBy]: sortDirection };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customerId", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return paginatedResponse(orders, page, limit, total);
  },
);

/**
 * POST /api/admin/orders
 * Create a manual admin order
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();
    if (session.user.role !== USER_ROLES.ADMIN) {
      await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [STAFF_PERMISSIONS.CREATE_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "admin:orders:create",
      "moderate",
      session.user.role,
    );

    const body = await validateBody(request, AdminCreateOrderSchema);

    await connectDB();

    const customer = await User.findOne({
      _id: body.customerId,
      role: USER_ROLES.CUSTOMER,
    })
      .select("_id")
      .lean();

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const settings = await getSettings();
    const resolvedLines = await resolveAdminOrderLines(body.items);
    if (session.user.role !== USER_ROLES.ADMIN) {
      const access = await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [STAFF_PERMISSIONS.CREATE_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
      );
      if (hasStaffScope(access.staffScope)) {
        const productIds = Array.from(
          new Set(resolvedLines.map((line) => String(line.product._id))),
        );
        const allowedProducts = await Product.countDocuments(
          mergeScopeFilter(
            { _id: { $in: productIds } },
            buildStaffProductScopeFilter(access.staffScope),
          ),
        );
        if (allowedProducts !== productIds.length) {
          throw new ValidationError(
            "One or more products are outside this staff member's assigned scope",
          );
        }
      }
    }
    const isMultiVendorEnabled = Boolean(settings.multiVendorMode?.enabled);
    const vendorContext = await resolveOrderVendorContextForItems({
      isMultiVendorEnabled,
      items: resolvedLines,
      getVendorId: (item) => item.product.vendorId,
      defaultVendorOwnerUserId: session.user.id,
    });
    const vendorGroups = groupItemsByOrderVendor(
      resolvedLines,
      vendorContext,
      (item) => item.product.vendorId,
    );
    const subtotal = roundMoney(
      resolvedLines.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );
    const discount = Math.min(roundMoney(body.discount), subtotal);
    const taxableSubtotal = Math.max(subtotal - discount, 0);
    const tax = roundMoney(taxableSubtotal * (body.taxRate / 100));
    const shippingCost = roundMoney(body.shippingCost);
    const total = roundMoney(taxableSubtotal + tax + shippingCost);

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
        throw new ValidationError("Some selected items do not have enough stock");
      }
      throw err;
    }
    revalidateProductContent({
      slugs: resolvedLines
        .map((line) => (line.product as { slug?: string } | null)?.slug)
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
          variantId: item.variantId ? new Types.ObjectId(item.variantId) : undefined,
          vendorId: new Types.ObjectId(
            getOrderItemVendorId(item.product.vendorId, vendorContext),
          ),
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
        console.error("Failed to restore inventory after admin order failure:", restoreErr),
      );
      throw err;
    }

    await markOrderInventoryReserved(String(order._id)).catch((err) =>
      console.error("Failed to mark inventory reserved on admin order:", err),
    );

    await notifyOrderCreatedParticipants(order).catch((err) =>
      console.error("Failed to create admin order notifications:", err),
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
