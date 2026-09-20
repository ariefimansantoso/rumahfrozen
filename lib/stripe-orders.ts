import { Cart, Order } from "@/models";
import { getSettings } from "@/models/settings.model";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/config/app.config";
import { sendOrderConfirmationEmail } from "@/lib/order-emails";
import { decrementInventory, InsufficientStockError } from "@/lib/inventory";
import { markOrderInventoryReserved } from "@/lib/order-inventory";
import {
  getOrderPreorderLines,
  getPreorderReleaseDateForOrder,
  markOrderPreorderReserved,
  PREORDER_ITEM_STATUS,
  PreorderUnavailableError,
  PURCHASE_TYPE,
  reservePreorderQuantity,
} from "@/lib/preorders";
import { getNextOnlineOrderNumber } from "@/lib/order-number";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";
import {
  applyCouponUsageForOrder,
  reverseCouponUsageForOrder,
} from "@/lib/coupons";
import { ensureChargeTransaction } from "@/lib/payment-transactions";
import { markCheckoutRecovered } from "@/lib/abandoned-checkouts";
import {
  buildVendorSubOrders,
  getOrderItemVendorId,
  groupItemsByOrderVendor,
  resolveOrderVendorContext,
} from "@/lib/order-vendors";
import { notifyOrderCreatedParticipants } from "@/lib/notifications";
import {
  parseShippingMetadata,
  allocateSubOrderShipping,
} from "@/lib/checkout-shipping";
import type Stripe from "stripe";
import {
  buildOrderItemCustomsSnapshot,
  type ProductShippingData,
  type VariantShippingData,
} from "@/lib/product-shipping";
import { revalidateProductContent } from "@/lib/cache-invalidation";

type SettingsDocument = Awaited<ReturnType<typeof getSettings>>;

type StripeOrderShippingAddress = { fullName?: string } & Record<
  string,
  unknown
>;

type StripeOrderCartItem = {
  productId: {
    _id: string;
    name: string;
    sku?: string;
    images?: string[];
    vendorId: string | { _id: string };
    shipping?: ProductShippingData;
    variants?: Array<
      VariantShippingData & { _id: { toString: () => string } }
    >;
  };
  variantId?: string;
  quantity: number;
  price: number;
  purchaseType?: string;
  preorderReleaseDate?: Date;
  preorderMessage?: string;
  preorderPaymentMode?: "full" | "deposit" | "pay_later";
  preorderDepositAmount?: number;
  preorderOutstandingAmount?: number;
  preorderSupplierEta?: Date;
  preorderBatchName?: string;
};

export type FinalizeStripeOrderResult = {
  created: boolean;
  orderId?: string;
  orderNumber?: string;
};

/**
 * Idempotently create an order for a succeeded Stripe PaymentIntent.
 *
 * Safe to call from both the Stripe webhook and the /verify polling
 * endpoint: it returns the existing order if one already exists and
 * guards against duplicate-key races.
 */
export async function finalizeStripePaymentIntentOrder(
  paymentIntent: Stripe.PaymentIntent,
  settings: SettingsDocument,
): Promise<FinalizeStripeOrderResult> {
  const metadata = (paymentIntent.metadata || {}) as Record<
    string,
    string | undefined
  >;
  const {
    userId,
    cartId,
    shippingAddress: shippingAddressStr,
    billingAddress: billingAddressStr,
    subtotal,
    shipping,
    tax,
    discount,
    total,
    customerEmail,
    couponCode,
    couponType,
    couponValue,
    couponId,
  } = metadata;

  if (!userId || !cartId || !shippingAddressStr) {
    console.error("Missing metadata in payment intent:", paymentIntent.id);
    return { created: false };
  }

  const existingOrder = await Order.findOne({
    stripePaymentIntentId: paymentIntent.id,
  }).lean();
  if (existingOrder) {
    return {
      created: false,
      orderId: String(existingOrder._id),
      orderNumber: existingOrder.orderNumber,
    };
  }

  let shippingAddress: StripeOrderShippingAddress;
  try {
    shippingAddress = JSON.parse(shippingAddressStr);
  } catch {
    console.error("Failed to parse shipping address from payment intent");
    return { created: false };
  }
  let billingAddress: StripeOrderShippingAddress = shippingAddress;
  if (billingAddressStr) {
    try {
      billingAddress = JSON.parse(billingAddressStr);
    } catch {
      billingAddress = shippingAddress;
    }
  }

  const cart = await Cart.findById(cartId)
    .populate({
      path: "items.productId",
      select: "name price images vendorId stock sku slug shipping variants",
      populate: { path: "vendorId", select: "_id" },
    })
    .lean();

  if (!cart || !cart.items || cart.items.length === 0) {
    console.error("Cart not found or empty:", cartId);
    return { created: false };
  }

  const items = cart.items as StripeOrderCartItem[];

  const orderNumber = await getNextOnlineOrderNumber(settings.orders?.prefix);

  const vendorContext = await resolveOrderVendorContext({
    isMultiVendorEnabled: Boolean(settings.multiVendorMode?.enabled),
  });
  const vendorGroups = groupItemsByOrderVendor(
    items,
    vendorContext,
    (item) => item.productId.vendorId,
  );
  const subOrders = await buildVendorSubOrders(vendorGroups, {
    getProductId: (item) => item.productId._id,
    getVariantId: (item) => item.variantId,
    getName: (item) => item.productId.name,
    getSku: (item) => item.productId.sku,
    getQuantity: (item) => item.quantity,
    getPrice: (item) => item.price,
    getImage: (item) => item.productId.images?.[0],
    getPurchaseType: (item) => item.purchaseType || PURCHASE_TYPE.STANDARD,
    getPreorderReleaseDate: (item) => item.preorderReleaseDate,
    getPreorderMessage: (item) => item.preorderMessage,
    getPreorderStatus: (item) =>
      item.purchaseType === PURCHASE_TYPE.PREORDER
        ? PREORDER_ITEM_STATUS.RESERVED
        : undefined,
    getPreorderPaymentMode: (item) => item.preorderPaymentMode,
    getPreorderDepositAmount: (item) => item.preorderDepositAmount,
    getPreorderOutstandingAmount: (item) => item.preorderOutstandingAmount,
    getPreorderSupplierEta: (item) => item.preorderSupplierEta,
    getPreorderBatchName: (item) => item.preorderBatchName,
    getCustoms: (item) => buildOrderItemCustomsSnapshot({
      productShipping: item.productId.shipping,
      variantShipping: item.variantId
        ? item.productId.variants?.find(
            (candidate) => candidate._id.toString() === String(item.variantId),
          )
        : undefined,
    }),
    fallbackCommissionPercent:
      settings.orders?.commission?.vendorRate ?? DEFAULT_VENDOR_COMMISSION_RATE,
    status: items.some((item) => item.purchaseType === PURCHASE_TYPE.PREORDER)
      ? ORDER_STATUS.PREORDERED
      : ORDER_STATUS.PENDING,
  });

  // Apply shipping captured at PaymentIntent/Checkout creation so the
  // Stripe-created order matches the other payment paths (per-vendor split,
  // selected method, duties).
  const parsedShipping = parseShippingMetadata(metadata);
  allocateSubOrderShipping(
    subOrders as Array<{
      vendorId: { toString: () => string };
      shippingCost?: number;
      shippingMethod?: unknown;
    }>,
    {
      vendorShippingCosts: parsedShipping.vendorShippingCosts,
      orderShippingCost: parseFloat(shipping || "0"),
      orderShippingMethod: parsedShipping.shippingMethod,
    },
  );

  const hasPreorder = items.some(
    (item) => item.purchaseType === PURCHASE_TYPE.PREORDER,
  );
  const preorderReleaseDate = getPreorderReleaseDateForOrder(items);
  const preorderItems = items.filter(
    (item) => item.purchaseType === PURCHASE_TYPE.PREORDER,
  );
  const preorderPaymentModes = new Set(
    preorderItems.map((item) => item.preorderPaymentMode || "full"),
  );
  const preorderPaymentMode =
    preorderPaymentModes.size === 1
      ? Array.from(preorderPaymentModes)[0]
      : hasPreorder
        ? "full"
        : undefined;
  const preorderDepositAmount = preorderItems.reduce(
    (sum, item) => sum + Number(item.preorderDepositAmount || 0),
    0,
  );
  const preorderOutstandingAmount = preorderItems.reduce(
    (sum, item) => sum + Number(item.preorderOutstandingAmount || 0),
    0,
  );

  let createdOrder;
  try {
    createdOrder = await Order.create({
      customerId: userId,
      orderNumber,
      items: items.map((item) => ({
        productId: item.productId._id,
        variantId: item.variantId,
        vendorId: getOrderItemVendorId(item.productId.vendorId, vendorContext),
        name: item.productId.name,
        sku: item.productId.sku || "",
        quantity: item.quantity,
        price: item.price,
        image: item.productId.images?.[0],
        purchaseType: item.purchaseType || PURCHASE_TYPE.STANDARD,
        preorderReleaseDate: item.preorderReleaseDate,
        preorderMessage: item.preorderMessage,
        preorderStatus:
          item.purchaseType === PURCHASE_TYPE.PREORDER
            ? PREORDER_ITEM_STATUS.RESERVED
            : undefined,
        preorderPaymentMode: item.preorderPaymentMode,
        preorderDepositAmount: item.preorderDepositAmount,
        preorderOutstandingAmount: item.preorderOutstandingAmount,
        preorderSupplierEta: item.preorderSupplierEta,
        preorderBatchName: item.preorderBatchName,
        customs: buildOrderItemCustomsSnapshot({
          productShipping: item.productId.shipping,
          variantShipping: item.variantId
            ? item.productId.variants?.find(
                (candidate) =>
                  candidate._id.toString() === String(item.variantId),
              )
            : undefined,
        }),
      })),
      subOrders,
      shippingAddress,
      billingAddress,
      paymentMethod: "card",
      paymentStatus:
        preorderOutstandingAmount > 0
          ? PAYMENT_STATUS.PARTIALLY_PAID
          : PAYMENT_STATUS.PAID,
      stripePaymentIntentId: paymentIntent.id,
      paymentId: paymentIntent.id,
      subtotal: parseFloat(subtotal || "0"),
      shippingCost: parseFloat(shipping || "0"),
      shippingMethod: parsedShipping.shippingMethod,
      customs: parsedShipping.customs,
      tax: parseFloat(tax || "0"),
      discount: parseFloat(discount || "0"),
      coupon:
        couponCode && couponCode.trim()
          ? {
              code: couponCode.trim().toUpperCase(),
              type: couponType || undefined,
              value: couponValue ? Number(couponValue) : undefined,
              couponId: couponId || undefined,
              usageIncremented: false,
            }
          : undefined,
      total: parseFloat(total || "0"),
      channel: "online",
      hasPreorder,
      preorderStatus: hasPreorder ? PREORDER_ITEM_STATUS.RESERVED : undefined,
      preorderReleaseDate,
      preorderAcknowledgedAt: hasPreorder ? new Date() : undefined,
      preorderPaymentMode,
      preorderDepositAmount,
      preorderOutstandingAmount,
      status: hasPreorder ? ORDER_STATUS.PREORDERED : ORDER_STATUS.PROCESSING,
    });
  } catch (err: unknown) {
    // Concurrent webhook + verify race: another caller already created it.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      const raced = await Order.findOne({
        stripePaymentIntentId: paymentIntent.id,
      }).lean();
      if (raced) {
        return {
          created: false,
          orderId: String(raced._id),
          orderNumber: raced.orderNumber,
        };
      }
    }
    throw err;
  }

  await ensureChargeTransaction({
    _id: String(createdOrder._id),
    orderNumber: createdOrder.orderNumber,
    paymentMethod: createdOrder.paymentMethod,
    paymentStatus: createdOrder.paymentStatus,
    paymentId: createdOrder.paymentId,
    stripePaymentIntentId: createdOrder.stripePaymentIntentId,
    paypalCaptureId: createdOrder.paypalCaptureId,
    subtotal: createdOrder.subtotal,
    shippingCost: createdOrder.shippingCost,
    tax: createdOrder.tax,
    discount: createdOrder.discount,
    total: createdOrder.total,
    currency: settings.general?.defaultCurrency,
    channel: createdOrder.channel || "online",
    createdAt: createdOrder.createdAt,
  });

  await applyCouponUsageForOrder(String(createdOrder._id)).catch((err) =>
    console.error("Failed to apply coupon usage on Stripe payment intent:", err),
  );

  try {
    if (hasPreorder) {
      await reservePreorderQuantity(getOrderPreorderLines(items));
      await markOrderPreorderReserved(String(createdOrder._id)).catch((err) =>
        console.error(
          "Failed to mark preorder reserved on Stripe payment intent:",
          err,
        ),
      );
    } else {
      await decrementInventory(
        items.map((item) => ({
          productId: String(item.productId._id),
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );
      await markOrderInventoryReserved(String(createdOrder._id)).catch((err) =>
        console.error(
          "Failed to mark inventory reserved on Stripe payment intent:",
          err,
        ),
      );
      revalidateProductContent({
        slugs: items
          .map((item) =>
            (item.productId as { slug?: string } | null)?.slug,
          )
          .filter(
            (slug): slug is string =>
              typeof slug === "string" && slug.length > 0,
          ),
      });
    }
  } catch (err) {
    if (err instanceof InsufficientStockError || err instanceof PreorderUnavailableError) {
      await Order.updateOne(
        { _id: createdOrder._id },
        { $set: { status: ORDER_STATUS.CANCELLED } },
      );
      await reverseCouponUsageForOrder(String(createdOrder._id)).catch(
        (reverseErr) =>
          console.error(
            "Failed to reverse coupon usage after stock cancel:",
            reverseErr,
          ),
      );
      return {
        created: false,
        orderId: String(createdOrder._id),
        orderNumber: createdOrder.orderNumber,
      };
    }
    throw err;
  }

  await markCheckoutRecovered({
    cartId,
    orderId: createdOrder._id,
    paymentEvent: {
      gateway: "stripe",
      status: "succeeded",
      paymentId: paymentIntent.id,
      message: "Stripe PaymentIntent succeeded",
    },
  }).catch((err) =>
    console.error("Failed to mark abandoned checkout recovered:", err),
  );

  await Cart.findByIdAndUpdate(cartId, { $set: { items: [] } });

  const email = paymentIntent.receipt_email || customerEmail;
  if (email) {
    await sendOrderConfirmationEmail(
      {
        orderNumber: createdOrder.orderNumber,
        customerName: shippingAddress.fullName || "Customer",
        customerEmail: email,
        items: createdOrder.items.map(
          (i: {
            name: string;
            quantity: number;
            price: number;
            image?: string;
          }) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            image: i.image,
          }),
        ),
        subtotal: createdOrder.subtotal,
        shipping: createdOrder.shippingCost,
        tax: createdOrder.tax,
        total: createdOrder.total,
        shippingAddress: createdOrder.shippingAddress,
        paymentMethod: createdOrder.paymentMethod,
      },
      settings,
    );
  }

  await notifyOrderCreatedParticipants(createdOrder).catch((err) =>
    console.error("Failed to create Stripe payment notifications:", err),
  );

  console.log("Order created successfully:", orderNumber);

  return {
    created: true,
    orderId: String(createdOrder._id),
    orderNumber: createdOrder.orderNumber,
  };
}

/**
 * Idempotently create an order for a completed Stripe Checkout Session.
 */
export async function finalizeStripeCheckoutSessionOrder(
  session: Stripe.Checkout.Session,
  settings: SettingsDocument,
): Promise<FinalizeStripeOrderResult> {
  const { metadata } = session;

  if (!metadata) {
    console.error("No metadata in checkout session");
    return { created: false };
  }

  const {
    userId,
    cartId,
    shippingAddress: shippingAddressStr,
    billingAddress: billingAddressStr,
    subtotal,
    shipping,
    tax,
    discount,
    total,
    couponCode,
    couponType,
    couponValue,
    couponId,
  } = metadata;

  const existingOrder = await Order.findOne({
    stripeSessionId: session.id,
  }).lean();
  if (existingOrder) {
    return {
      created: false,
      orderId: String(existingOrder._id),
      orderNumber: existingOrder.orderNumber,
    };
  }

  let shippingAddress: StripeOrderShippingAddress;
  try {
    shippingAddress = JSON.parse(shippingAddressStr);
  } catch {
    console.error("Failed to parse shipping address");
    return { created: false };
  }
  let billingAddress: StripeOrderShippingAddress = shippingAddress;
  if (billingAddressStr) {
    try {
      billingAddress = JSON.parse(billingAddressStr);
    } catch {
      billingAddress = shippingAddress;
    }
  }

  const cart = await Cart.findById(cartId)
    .populate({
      path: "items.productId",
      select: "name price images vendorId stock sku slug shipping variants",
      populate: { path: "vendorId", select: "_id" },
    })
    .lean();

  if (!cart || !cart.items || cart.items.length === 0) {
    console.error("Cart not found or empty:", cartId);
    return { created: false };
  }

  const items = cart.items as StripeOrderCartItem[];

  const orderNumber = await getNextOnlineOrderNumber(settings.orders?.prefix);

  const vendorContext = await resolveOrderVendorContext({
    isMultiVendorEnabled: Boolean(settings.multiVendorMode?.enabled),
  });
  const vendorGroups = groupItemsByOrderVendor(
    items,
    vendorContext,
    (item) => item.productId.vendorId,
  );
  const subOrders = await buildVendorSubOrders(vendorGroups, {
    getProductId: (item) => item.productId._id,
    getVariantId: (item) => item.variantId,
    getName: (item) => item.productId.name,
    getSku: (item) => item.productId.sku,
    getQuantity: (item) => item.quantity,
    getPrice: (item) => item.price,
    getImage: (item) => item.productId.images?.[0],
    getPurchaseType: (item) => item.purchaseType || PURCHASE_TYPE.STANDARD,
    getPreorderReleaseDate: (item) => item.preorderReleaseDate,
    getPreorderMessage: (item) => item.preorderMessage,
    getPreorderStatus: (item) =>
      item.purchaseType === PURCHASE_TYPE.PREORDER
        ? PREORDER_ITEM_STATUS.RESERVED
        : undefined,
    getPreorderPaymentMode: (item) => item.preorderPaymentMode,
    getPreorderDepositAmount: (item) => item.preorderDepositAmount,
    getPreorderOutstandingAmount: (item) => item.preorderOutstandingAmount,
    getPreorderSupplierEta: (item) => item.preorderSupplierEta,
    getPreorderBatchName: (item) => item.preorderBatchName,
    getCustoms: (item) => buildOrderItemCustomsSnapshot({
      productShipping: item.productId.shipping,
      variantShipping: item.variantId
        ? item.productId.variants?.find(
            (candidate) => candidate._id.toString() === String(item.variantId),
          )
        : undefined,
    }),
    fallbackCommissionPercent:
      settings.orders?.commission?.vendorRate ?? DEFAULT_VENDOR_COMMISSION_RATE,
    status: items.some((item) => item.purchaseType === PURCHASE_TYPE.PREORDER)
      ? ORDER_STATUS.PREORDERED
      : ORDER_STATUS.PENDING,
  });

  // Apply shipping captured at PaymentIntent/Checkout creation so the
  // Stripe-created order matches the other payment paths (per-vendor split,
  // selected method, duties).
  const parsedShipping = parseShippingMetadata(metadata);
  allocateSubOrderShipping(
    subOrders as Array<{
      vendorId: { toString: () => string };
      shippingCost?: number;
      shippingMethod?: unknown;
    }>,
    {
      vendorShippingCosts: parsedShipping.vendorShippingCosts,
      orderShippingCost: parseFloat(shipping || "0"),
      orderShippingMethod: parsedShipping.shippingMethod,
    },
  );

  const hasPreorder = items.some(
    (item) => item.purchaseType === PURCHASE_TYPE.PREORDER,
  );
  const preorderReleaseDate = getPreorderReleaseDateForOrder(items);
  const preorderItems = items.filter(
    (item) => item.purchaseType === PURCHASE_TYPE.PREORDER,
  );
  const preorderPaymentModes = new Set(
    preorderItems.map((item) => item.preorderPaymentMode || "full"),
  );
  const preorderPaymentMode =
    preorderPaymentModes.size === 1
      ? Array.from(preorderPaymentModes)[0]
      : hasPreorder
        ? "full"
        : undefined;
  const preorderDepositAmount = preorderItems.reduce(
    (sum, item) => sum + Number(item.preorderDepositAmount || 0),
    0,
  );
  const preorderOutstandingAmount = preorderItems.reduce(
    (sum, item) => sum + Number(item.preorderOutstandingAmount || 0),
    0,
  );

  let createdOrder;
  try {
    createdOrder = await Order.create({
      customerId: userId,
      orderNumber,
      items: items.map((item) => ({
        productId: item.productId._id,
        variantId: item.variantId,
        vendorId: getOrderItemVendorId(item.productId.vendorId, vendorContext),
        name: item.productId.name,
        sku: item.productId.sku || "",
        quantity: item.quantity,
        price: item.price,
        image: item.productId.images?.[0],
        purchaseType: item.purchaseType || PURCHASE_TYPE.STANDARD,
        preorderReleaseDate: item.preorderReleaseDate,
        preorderMessage: item.preorderMessage,
        preorderStatus:
          item.purchaseType === PURCHASE_TYPE.PREORDER
            ? PREORDER_ITEM_STATUS.RESERVED
            : undefined,
        preorderPaymentMode: item.preorderPaymentMode,
        preorderDepositAmount: item.preorderDepositAmount,
        preorderOutstandingAmount: item.preorderOutstandingAmount,
        preorderSupplierEta: item.preorderSupplierEta,
        preorderBatchName: item.preorderBatchName,
        customs: buildOrderItemCustomsSnapshot({
          productShipping: item.productId.shipping,
          variantShipping: item.variantId
            ? item.productId.variants?.find(
                (candidate) =>
                  candidate._id.toString() === String(item.variantId),
              )
            : undefined,
        }),
      })),
      subOrders,
      shippingAddress,
      billingAddress,
      paymentMethod: "card",
      paymentStatus:
        preorderOutstandingAmount > 0
          ? PAYMENT_STATUS.PARTIALLY_PAID
          : PAYMENT_STATUS.PAID,
      stripeSessionId: session.id,
      stripePaymentIntentId: String(session.payment_intent || ""),
      paymentId: String(session.payment_intent || ""),
      subtotal: parseFloat(subtotal),
      shippingCost: parseFloat(shipping),
      shippingMethod: parsedShipping.shippingMethod,
      customs: parsedShipping.customs,
      tax: parseFloat(tax),
      discount: parseFloat(discount || "0"),
      coupon:
        couponCode && couponCode.trim()
          ? {
              code: couponCode.trim().toUpperCase(),
              type: couponType || undefined,
              value: couponValue ? Number(couponValue) : undefined,
              couponId: couponId || undefined,
              usageIncremented: false,
            }
          : undefined,
      total: parseFloat(total),
      channel: "online",
      hasPreorder,
      preorderStatus: hasPreorder ? PREORDER_ITEM_STATUS.RESERVED : undefined,
      preorderReleaseDate,
      preorderAcknowledgedAt: hasPreorder ? new Date() : undefined,
      preorderPaymentMode,
      preorderDepositAmount,
      preorderOutstandingAmount,
      status: hasPreorder ? ORDER_STATUS.PREORDERED : ORDER_STATUS.PROCESSING,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      const raced = await Order.findOne({
        stripeSessionId: session.id,
      }).lean();
      if (raced) {
        return {
          created: false,
          orderId: String(raced._id),
          orderNumber: raced.orderNumber,
        };
      }
    }
    throw err;
  }

  await ensureChargeTransaction({
    _id: String(createdOrder._id),
    orderNumber: createdOrder.orderNumber,
    paymentMethod: createdOrder.paymentMethod,
    paymentStatus: createdOrder.paymentStatus,
    paymentId: createdOrder.paymentId,
    stripePaymentIntentId: createdOrder.stripePaymentIntentId,
    paypalCaptureId: createdOrder.paypalCaptureId,
    subtotal: createdOrder.subtotal,
    shippingCost: createdOrder.shippingCost,
    tax: createdOrder.tax,
    discount: createdOrder.discount,
    total: createdOrder.total,
    currency: settings.general?.defaultCurrency,
    channel: createdOrder.channel || "online",
    createdAt: createdOrder.createdAt,
  });

  await applyCouponUsageForOrder(String(createdOrder._id)).catch((err) =>
    console.error("Failed to apply coupon usage on Stripe webhook:", err),
  );

  try {
    if (hasPreorder) {
      await reservePreorderQuantity(getOrderPreorderLines(items));
      await markOrderPreorderReserved(String(createdOrder._id)).catch((err) =>
        console.error("Failed to mark preorder reserved on Stripe webhook:", err),
      );
    } else {
      await decrementInventory(
        items.map((item) => ({
          productId: String(item.productId._id),
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );
      await markOrderInventoryReserved(String(createdOrder._id)).catch((err) =>
        console.error("Failed to mark inventory reserved on Stripe webhook:", err),
      );
      revalidateProductContent({
        slugs: items
          .map((item) =>
            (item.productId as { slug?: string } | null)?.slug,
          )
          .filter(
            (slug): slug is string =>
              typeof slug === "string" && slug.length > 0,
          ),
      });
    }
  } catch (err) {
    if (err instanceof InsufficientStockError || err instanceof PreorderUnavailableError) {
      await Order.updateOne(
        { _id: createdOrder._id },
        { $set: { status: ORDER_STATUS.CANCELLED } },
      );
      await reverseCouponUsageForOrder(String(createdOrder._id)).catch(
        (reverseErr) =>
          console.error(
            "Failed to reverse coupon usage after stock cancel:",
            reverseErr,
          ),
      );
      return {
        created: false,
        orderId: String(createdOrder._id),
        orderNumber: createdOrder.orderNumber,
      };
    }
    throw err;
  }

  await markCheckoutRecovered({
    cartId,
    orderId: createdOrder._id,
    paymentEvent: {
      gateway: "stripe",
      status: "succeeded",
      paymentId: session.payment_intent
        ? String(session.payment_intent)
        : session.id,
      message: "Stripe Checkout completed",
    },
  }).catch((err) =>
    console.error("Failed to mark abandoned checkout recovered:", err),
  );

  await Cart.findByIdAndUpdate(cartId, { $set: { items: [] } });

  if (session.customer_email) {
    await sendOrderConfirmationEmail(
      {
        orderNumber: createdOrder.orderNumber,
        customerName: shippingAddress.fullName || "Customer",
        customerEmail: session.customer_email,
        items: createdOrder.items.map(
          (i: {
            name: string;
            quantity: number;
            price: number;
            image?: string;
          }) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            image: i.image,
          }),
        ),
        subtotal: createdOrder.subtotal,
        shipping: createdOrder.shippingCost,
        tax: createdOrder.tax,
        total: createdOrder.total,
        shippingAddress: createdOrder.shippingAddress,
        paymentMethod: createdOrder.paymentMethod,
      },
      settings,
    );
  }

  await notifyOrderCreatedParticipants(createdOrder).catch((err) =>
    console.error("Failed to create Stripe checkout notifications:", err),
  );

  console.log("Order created successfully:", orderNumber);

  return {
    created: true,
    orderId: String(createdOrder._id),
    orderNumber: createdOrder.orderNumber,
  };
}
