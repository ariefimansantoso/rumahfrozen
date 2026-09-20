import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Order, Cart } from "@/models";
import {
  paginatedResponse,
  createdResponse,
} from "@/lib/api/response";
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/models/settings.model";
import { getNextOnlineOrderNumber } from "@/lib/order-number";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_ORDER_SHIPPING_COST,
  DEFAULT_ORDER_TAX_RATE,
  DEFAULT_VENDOR_COMMISSION_RATE,
} from "@/lib/order-settings";
import {
  calculateShipping,
  SHIPPING_UNAVAILABLE_MESSAGE,
} from "@/lib/shipping";
import {
  decrementInventory,
  restoreInventory,
  InsufficientStockError,
} from "@/lib/inventory";
import { markOrderInventoryReserved } from "@/lib/order-inventory";
import { isStorefrontProductSourceAllowed } from "@/lib/product-visibility";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import {
  buildVendorSubOrders,
  getOrderItemVendorId,
  groupItemsByOrderVendor,
  resolveOrderVendorContext,
} from "@/lib/order-vendors";
import { ensurePendingChargeTransaction } from "@/lib/payment-transactions";
import { notifyOrderCreatedParticipants } from "@/lib/notifications";
import { assertStorefrontWriteAllowed } from "@/lib/maintenance";
import {
  buildOrderItemCustomsSnapshot,
  resolveItemShipping,
  type ProductShippingData,
  type VariantShippingData,
} from "@/lib/product-shipping";
import { withApi } from "@/lib/api/handler";
import { parsePageLimit } from "@/lib/api/list-query";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/**
 * GET /api/orders
 * Get orders for the current user
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = parsePageLimit(searchParams, {
      defaultLimit: 10,
      maxLimit: 100,
    });
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const query: Record<string, unknown> = { customerId: session.user.id };

    if (status && status !== "all") {
      query.status = status;
    }
    if (type === "preorders") {
      query.hasPreorder = true;
    } else if (type === "regular") {
      query.hasPreorder = { $ne: true };
    }

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    return paginatedResponse(orders, page, limit, total);
  },
);

/**
 * POST /api/orders
 * Create a new order from cart
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();

    await connectDB();

    const body = await request.json();
    const { shippingAddress, billingAddress, paymentMethod, notes } = body;

    if (!shippingAddress) {
      throw new ValidationError("Shipping address is required");
    }

    // Get user's cart with product details for validation
    const cart = await Cart.findOne({ userId: session.user.id })
      .populate(
        "items.productId",
        "name price images vendorId sku status stock slug productSource shipping variants",
      )
      .lean();

    if (!cart || cart.items.length === 0) {
      throw new ValidationError("Cart is empty");
    }
    const cartItems = cart.items as Array<{
      productId: {
        _id?: string;
        name?: string;
        price?: number;
        sku?: string;
        status?: string;
        stock?: number;
        vendorId?: unknown;
        productSource?: unknown;
        shipping?: ProductShippingData;
        variants?: Array<
          VariantShippingData & { _id: { toString: () => string } }
        >;
      } | null;
      price: number;
      quantity: number;
      image?: string;
      variantId?: string;
      name?: string;
    }>;

    const settings = await getSettings();
    assertStorefrontWriteAllowed(settings.maintenance, settings.general?.storeName);
    const isMultiVendorEnabled = Boolean(settings.multiVendorMode?.enabled);

    // Validate cart items before checkout
    const invalidItems: string[] = [];
    for (const item of cartItems) {
      if (!item.productId || !item.productId._id) {
        invalidItems.push("A product in your cart no longer exists");
        continue;
      }
      if (item.productId.status !== "active") {
        invalidItems.push(
          `"${item.productId.name || "Unknown"}" is no longer available`
        );
        continue;
      }
      if (
        !isStorefrontProductSourceAllowed(
          item.productId.productSource,
          isMultiVendorEnabled,
        )
      ) {
        invalidItems.push(
          `"${item.productId.name || "Unknown"}" is no longer available`
        );
        continue;
      }
      if (
        typeof item.productId.stock === "number" &&
        item.productId.stock < item.quantity
      ) {
        invalidItems.push(
          `"${item.productId.name || "Unknown"}" has insufficient stock (${item.productId.stock} available)`
        );
      }
    }
    if (invalidItems.length > 0) {
      throw new ValidationError(
        `Cart validation failed: ${invalidItems.join("; ")}`
      );
    }

    // Calculate totals using current product prices
    const subtotal = cartItems.reduce(
      (sum, item) => sum + (item.productId?.price ?? item.price) * item.quantity,
      0
    );
    const orderSettings = settings.orders || {};
    const freeShippingThreshold =
      orderSettings.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;
    const defaultShippingCost =
      orderSettings.defaultShippingCost ?? DEFAULT_ORDER_SHIPPING_COST;
    const taxRate = orderSettings.taxRate ?? DEFAULT_ORDER_TAX_RATE;
    let totalWeight = 0;
    let hasShippableItems = false;
    let shippableSubtotal = 0;
    for (const item of cartItems) {
      if (!item.productId) continue;
      const variant = item.variantId
        ? item.productId.variants?.find(
            (candidate) =>
              candidate._id.toString() === String(item.variantId),
          )
        : undefined;
      const itemShipping = resolveItemShipping({
        productShipping: item.productId.shipping,
        variantShipping: variant,
        quantity: item.quantity,
        targetWeightUnit: "kg",
      });
      totalWeight += itemShipping.totalWeight;
      hasShippableItems ||= itemShipping.requiresShipping;
      if (itemShipping.requiresShipping) {
        shippableSubtotal +=
          (item.productId.price ?? item.price) * item.quantity;
      }
    }

    const shippingResult = hasShippableItems
      ? calculateShipping({
          subtotal: shippableSubtotal,
          totalWeight,
          totalWeightUnit: "kg",
          destination: {
            country: shippingAddress.country,
            state: shippingAddress.state,
          },
          shipping: settings.shipping,
          orders: { freeShippingThreshold, defaultShippingCost },
        })
      : null;
    if (shippingResult && !shippingResult.available) {
      throw new ValidationError(SHIPPING_UNAVAILABLE_MESSAGE);
    }
    const shippingCost = shippingResult?.shippingCost ?? 0;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + shippingCost + tax;

    // Generate order number (with retry for uniqueness)

    const vendorContext = await resolveOrderVendorContext({
      isMultiVendorEnabled,
    });
    const vendorItems = groupItemsByOrderVendor(
      cartItems,
      vendorContext,
      (item) => item.productId?.vendorId,
    );
    const subOrders = await buildVendorSubOrders(vendorItems, {
      getProductId: (item) => item.productId?._id || item.productId,
      getVariantId: (item) => item.variantId,
      getName: (item) => item.productId?.name || item.name,
      getSku: (item) => item.productId?.sku,
      getQuantity: (item) => item.quantity,
      getPrice: (item) => item.price,
      getImage: (item) => item.image,
      getCustoms: (item) =>
        item.productId
          ? buildOrderItemCustomsSnapshot({
              productShipping: item.productId.shipping,
              variantShipping: item.variantId
                ? item.productId.variants?.find(
                    (candidate) =>
                      candidate._id.toString() === String(item.variantId),
                  )
                : undefined,
            })
          : undefined,
      fallbackCommissionPercent:
        settings.orders?.commission?.vendorRate ?? DEFAULT_VENDOR_COMMISSION_RATE,
      status: "pending",
    });

    // Create order with retry for order number uniqueness
    const orderData = {
      customerId: session.user.id,
      items: cartItems.map((item) => ({
        productId: item.productId?._id || item.productId,
        vendorId: getOrderItemVendorId(item.productId?.vendorId, vendorContext),
        variantId: item.variantId,
        name: item.productId?.name || item.name,
        sku: item.productId?.sku || "",
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        customs: item.productId
          ? buildOrderItemCustomsSnapshot({
              productShipping: item.productId.shipping,
              variantShipping: item.variantId
                ? item.productId.variants?.find(
                    (candidate) =>
                      candidate._id.toString() === String(item.variantId),
                  )
                : undefined,
            })
          : undefined,
      })),
      subOrders,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      paymentStatus: "pending",
      subtotal,
      shippingCost,
      tax,
      discount: 0,
      total,
      status: "pending",
      notes,
    };

    const inventoryLines = cartItems.map((item) => ({
      productId: String(item.productId?._id || item.productId),
      variantId: item.variantId ? String(item.variantId) : undefined,
      quantity: item.quantity,
    }));

    // Decrement inventory before creating the order. If the order fails to
    // persist after retries, restore inventory to avoid permanent over-reserve.
    try {
      await decrementInventory(inventoryLines);
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        throw new ValidationError(
          "Some items are out of stock. Please update your cart and try again.",
        );
      }
      throw err;
    }
    revalidateProductContent({
      slugs: cartItems
        .map((item) => (item.productId as { slug?: string } | null)?.slug)
        .filter(
          (slug): slug is string =>
            typeof slug === "string" && slug.length > 0,
        ),
    });

    let order;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          order = await Order.create({
            ...orderData,
            orderNumber: await getNextOnlineOrderNumber(orderSettings.prefix),
          });
          break;
        } catch (err) {
          if (isDuplicateKeyError(err) && attempt < 2) continue;
          throw err;
        }
      }
    } catch (err) {
      await restoreInventory(inventoryLines).catch((restoreErr) =>
        console.error("Failed to restore inventory after order failure:", restoreErr),
      );
      throw err;
    }

    if (!order) {
      await restoreInventory(inventoryLines).catch((restoreErr) =>
        console.error("Failed to restore inventory after order failure:", restoreErr),
      );
      throw new Error("Failed to create order after retries");
    }

    // Inventory was decremented before order create; mark sub-orders reserved.
    await markOrderInventoryReserved(String(order._id)).catch((err) =>
      console.error("Failed to mark inventory reserved on order:", err),
    );

    if (paymentMethod === "cod") {
      await ensurePendingChargeTransaction({
        _id: String(order._id),
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentId: order.paymentId,
        stripePaymentIntentId: order.stripePaymentIntentId,
        paypalCaptureId: order.paypalCaptureId,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        currency: settings.general?.defaultCurrency,
        channel: order.channel || "online",
        createdAt: order.createdAt,
      }).catch((err) => {
        console.error("Failed to sync pending COD payment transaction:", err);
      });
    }

    await Cart.deleteOne({ userId: session.user.id });

    // Update customer profile stats (fire-and-forget)
    import("@/lib/customer")
      .then(({ refreshCustomerStats }) =>
        refreshCustomerStats(session.user.id),
      )
      .catch((err) =>
        console.error("Failed to refresh customer stats:", err),
      );

    await notifyOrderCreatedParticipants(order).catch((err) =>
      console.error("Failed to create order notifications:", err),
    );

    return createdResponse(order);
  } catch (error) {
    return handleApiError(error);
  }
}
