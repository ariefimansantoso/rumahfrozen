import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Order, Product } from "@/models";
import { getNextPosOrderNumber } from "@/lib/order-number";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";
import { createdResponse } from "@/lib/api/response";
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { USER_ROLES, ORDER_STATUS } from "@/config/app.config";
import { isStaffRole } from "@/lib/staff-role";
import { getSettings } from "@/models";
import {
  getStripeForSecretKey,
  isStripeSecretKeyConfigured,
} from "@/lib/stripe";
import { resolveStripeCredentials } from "@/lib/credentials";
import {
  decrementInventory,
  restoreInventory,
  InsufficientStockError,
} from "@/lib/inventory";
import { markOrderInventoryReserved } from "@/lib/order-inventory";
import { canAccessPOS } from "@/lib/rbac";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { ensureChargeTransaction } from "@/lib/payment-transactions";
import {
  buildVendorSubOrders,
  getOrderItemVendorId,
  groupItemsByOrderVendor,
  resolveOrderVendorContextForItems,
} from "@/lib/order-vendors";
import { notifyOrderCreatedParticipants } from "@/lib/notifications";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { validatePOSPaymentInput } from "@/lib/pos/payment";
import {
  calculatePOSOrderTotals,
  computePOSLineDiscountAmount,
  type POSOrderDiscountInput,
  type POSOrderItemInput,
} from "@/lib/pos/order-totals";

async function generatePosOrderNumber(prefix?: string) {
  return getNextPosOrderNumber(prefix || "POS");
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();
    const role = session.user.role;
    if (
      role !== USER_ROLES.ADMIN &&
      role !== USER_ROLES.VENDOR &&
      !isStaffRole(role)
    ) {
      throw new AuthorizationError();
    }

    await connectDB();
    const settings = await getSettings();
    if (!(await canAccessPOS(session.user))) {
      throw new AuthorizationError();
    }

    const body = await request.json();
    const {
      items,
      paymentMethod,
      notes,
      posLocationId,
      customerId,
      cashTendered,
      paymentReference,
      paymentNote,
      stripePaymentIntentId,
      discount,
    }: {
      items: POSOrderItemInput[];
      paymentMethod: string;
      notes?: string;
      posLocationId?: string;
      customerId?: string;
      cashTendered?: number | string;
      paymentReference?: string;
      paymentNote?: string;
      stripePaymentIntentId?: string;
      discount?: POSOrderDiscountInput;
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError("Items are required");
    }
    if (!paymentMethod) {
      throw new ValidationError("Payment method is required");
    }

    let normalizedItems = items;

    if (role === USER_ROLES.VENDOR) {
      const vendor = await requireApprovedVendorByUserId(session.user.id);
      const vendorId = vendor._id.toString();
      const productIds = Array.from(
        new Set(
          items
            .map((item) => String(item.productId || "").trim())
            .filter(Boolean),
        ),
      );

      if (productIds.length === 0) {
        throw new ValidationError("Items are required");
      }

      const ownedProducts = await Product.find({
        _id: { $in: productIds },
        vendorId: vendor._id,
      })
        .select("_id slug")
        .lean();

      if (ownedProducts.length !== productIds.length) {
        throw new AuthorizationError("Vendors can only sell their own products");
      }

      normalizedItems = items.map((item) => ({ ...item, vendorId }));
    }

    // Collect product slugs for cache invalidation after inventory decrement.
    // This works for both vendor and non-vendor roles: the vendor branch
    // already validated ownership above.
    const slugProductIds = Array.from(
      new Set(
        normalizedItems
          .map((item) => String(item.productId || "").trim())
          .filter(Boolean),
      ),
    );
    const affectedProducts = slugProductIds.length
      ? await Product.find({ _id: { $in: slugProductIds } })
          .select("slug")
          .lean()
      : [];

    const taxRate = settings.orders?.taxRate ?? 0;
    const { subtotal, tax, shippingCost, totalDiscount, total } =
      calculatePOSOrderTotals({
        items: normalizedItems,
        discount,
        taxRate,
      });
    const normalizedStripeIntentId =
      typeof stripePaymentIntentId === "string"
        ? stripePaymentIntentId.trim()
        : "";
    const payment = validatePOSPaymentInput({
      paymentMethod,
      enabledMethods: settings.pos?.checkout?.paymentMethods,
      total,
      cashTendered,
      paymentReference: paymentReference || normalizedStripeIntentId,
      paymentNote,
    });
    if (!payment.ok) {
      throw new ValidationError(payment.message);
    }

    let verifiedStripePaymentIntentId: string | undefined;
    if (payment.metadata.posPayment.cardSubMethod === "card_stripe") {
      if (!normalizedStripeIntentId) {
        throw new ValidationError("Stripe payment intent is required");
      }
      const existingStripeOrder = await Order.findOne({
        stripePaymentIntentId: normalizedStripeIntentId,
      })
        .select("_id orderNumber")
        .lean();
      if (existingStripeOrder) {
        throw new ValidationError("Stripe payment has already been used");
      }

      const stripeSettings = settings.payment?.stripe;
      if (!stripeSettings?.enabled) {
        throw new ValidationError("Stripe is disabled");
      }
      const stripeSecretKey = resolveStripeCredentials(stripeSettings).secretKey;
      if (!isStripeSecretKeyConfigured(stripeSecretKey)) {
        throw new ValidationError("Stripe is not configured");
      }

      const currency = (
        settings.general?.defaultCurrency || "USD"
      ).toLowerCase();
      const expectedAmount = Math.round(total * 100);
      const intent = await getStripeForSecretKey(
        stripeSecretKey,
      ).paymentIntents.retrieve(normalizedStripeIntentId);
      if (intent.status !== "succeeded" && intent.status !== "processing") {
        throw new ValidationError("Stripe payment was not completed");
      }
      if (intent.amount !== expectedAmount || intent.currency !== currency) {
        throw new ValidationError(
          "Stripe payment amount does not match order total",
        );
      }
      verifiedStripePaymentIntentId = intent.id;
    }

    // Order number generated below with retry
    const vendorContext = await resolveOrderVendorContextForItems({
      isMultiVendorEnabled: Boolean(settings.multiVendorMode?.enabled),
      items: normalizedItems,
      getVendorId: (item) => item.vendorId,
      defaultVendorOwnerUserId:
        role === USER_ROLES.ADMIN ? session.user.id : undefined,
    });
    const vendorItems = groupItemsByOrderVendor(
      normalizedItems,
      vendorContext,
      (item) => item.vendorId,
    );
    const subOrders = await buildVendorSubOrders(vendorItems, {
      getProductId: (item) => item.productId,
      getVariantId: (item) => item.variantId,
      getName: (item) => item.name,
      getSku: (item) => item.sku,
      getQuantity: (item) => item.quantity,
      getPrice: (item) => item.price,
      getImage: (item) => item.image,
      getLineDiscount: (item) => item.lineDiscount ?? null,
      getLineNote: (item) =>
        typeof item.lineNote === "string" && item.lineNote.trim().length > 0
          ? item.lineNote.trim()
          : undefined,
      fallbackCommissionPercent:
        settings.orders?.commission?.vendorRate ?? DEFAULT_VENDOR_COMMISSION_RATE,
      status: ORDER_STATUS.DELIVERED,
    });

    // POS placeholder address (not applicable for in-store sales)
    const posAddress = {
      street: "In-store POS",
      city: "POS",
      state: "POS",
      postalCode: "00000",
      country: "POS",
    };

    const orderData = {
      customerId: customerId || session.user.id,
      items: normalizedItems.map((item) => {
        const lineDiscountAmount = computePOSLineDiscountAmount(item);
        return {
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          variantId: item.variantId,
          vendorId: getOrderItemVendorId(item.vendorId, vendorContext),
          lineDiscount: item.lineDiscount
            ? {
                type: item.lineDiscount.type,
                value: item.lineDiscount.value,
                amount: lineDiscountAmount,
              }
            : undefined,
          lineNote:
            typeof item.lineNote === "string" && item.lineNote.trim().length > 0
              ? item.lineNote.trim()
              : undefined,
        };
      }),
      subOrders,
      shippingAddress: posAddress,
      billingAddress: posAddress,
      paymentMethod: payment.method,
      paymentStatus: "paid",
      paymentId:
        verifiedStripePaymentIntentId ||
        (payment.method === "card" && payment.reference
          ? payment.reference
          : undefined),
      stripePaymentIntentId: verifiedStripePaymentIntentId,
      subtotal,
      shippingCost,
      tax,
      // Store the TOTAL discount (line + order-level) so finance reports,
      // sales ledger, and analytics all reflect the full markdown.
      discount: totalDiscount,
      discountMeta: discount
        ? {
            type: discount.type,
            value: discount.value,
            reason: discount.reason,
            note: discount.note,
          }
        : undefined,
      total,
      status: ORDER_STATUS.DELIVERED,
      notes,
      channel: "pos",
      posLocationId,
      staffId: session.user.id,
    };

    const inventoryLines = normalizedItems.map((item) => ({
      productId: String(item.productId),
      variantId: item.variantId ? String(item.variantId) : undefined,
      quantity: item.quantity,
    }));

    // Decrement inventory first so we never end up with a phantom order
    // referencing stock we couldn't actually reserve.
    try {
      await decrementInventory(inventoryLines, {
        channel: "pos",
        locationId: posLocationId,
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        throw new ValidationError("Insufficient stock for one or more items");
      }
      throw err;
    }
    revalidateProductContent({
      slugs: affectedProducts
        .map((p) => p.slug)
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
            orderNumber: await generatePosOrderNumber(
              settings.pos?.orders?.orderNumberPrefix,
            ),
          });
          break;
        } catch (err) {
          if (isDuplicateKeyError(err) && attempt < 2) continue;
          throw err;
        }
      }
    } catch (err) {
      await restoreInventory(inventoryLines, {
        channel: "pos",
        locationId: posLocationId,
      }).catch((restoreErr) =>
        console.error("Failed to restore inventory after POS order failure:", restoreErr),
      );
      throw err;
    }

    if (!order) {
      await restoreInventory(inventoryLines, {
        channel: "pos",
        locationId: posLocationId,
      }).catch((restoreErr) =>
        console.error("Failed to restore inventory after POS order failure:", restoreErr),
      );
      throw new Error("Failed to create POS order after retries");
    }

    // Inventory was decremented before the order was created, so the
    // sub-orders should be marked reserved now that we have the order ID.
    await markOrderInventoryReserved(String(order._id)).catch((err) =>
      console.error("Failed to mark inventory reserved on POS order:", err),
    );

    await ensureChargeTransaction({
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
      channel: order.channel,
      posLocationId: order.posLocationId ? String(order.posLocationId) : undefined,
      paymentMetadata: payment.metadata,
      createdAt: order.createdAt,
    });

    await notifyOrderCreatedParticipants(order).catch((err) =>
      console.error("Failed to create POS order notifications:", err),
    );

    return createdResponse(order);
  } catch (error) {
    return handleApiError(error);
  }
}
