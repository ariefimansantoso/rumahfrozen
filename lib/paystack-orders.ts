import { Cart, Order, Product } from "@/models";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/config/app.config";
import { sendOrderConfirmationEmail } from "@/lib/order-emails";
import {
  decrementInventory,
  InsufficientStockError,
} from "@/lib/inventory";
import { markOrderInventoryReserved } from "@/lib/order-inventory";
import {
  getOrderPreorderLines,
  markOrderPreorderReserved,
  PreorderUnavailableError,
  PURCHASE_TYPE,
  reservePreorderQuantity,
} from "@/lib/preorders";
import { ensureChargeTransaction } from "@/lib/payment-transactions";
import {
  applyCouponUsageForOrder,
  reverseCouponUsageForOrder,
} from "@/lib/coupons";
import {
  ConflictError,
  ValidationError,
} from "@/lib/api/errors";
import { markCheckoutRecovered } from "@/lib/abandoned-checkouts";
import { notifyOrderCreatedParticipants } from "@/lib/notifications";
import {
  toPaystackAmountSubunits,
  type PaystackTransaction,
} from "@/lib/paystack";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import type { getSettings } from "@/models/settings.model";

type SettingsDocument = Awaited<ReturnType<typeof getSettings>>;

type FinalizePaystackOrderParams = {
  reference: string;
  transaction: PaystackTransaction;
  settings: SettingsDocument;
  sessionUserId?: string;
  cartSessionId?: string;
  customerEmail?: string;
};

export async function finalizePaystackOrder(
  params: FinalizePaystackOrderParams,
) {
  const orderQuery: Record<string, unknown> = {
    paystackReference: params.reference,
    paymentMethod: "paystack",
  };

  if (params.sessionUserId) {
    orderQuery.customerId = params.sessionUserId;
  }

  const order = await Order.findOne(orderQuery);
  if (!order) {
    throw new ValidationError("Order not found for Paystack transaction");
  }

  if (
    order.paymentStatus === PAYMENT_STATUS.PAID ||
    order.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID
  ) {
    return {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      alreadyPaid: true,
    };
  }

  // If the order was cancelled before capture, refuse to resurrect it.
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new ValidationError(
      "Order was cancelled before payment capture. Please contact support for a refund.",
    );
  }

  if (params.transaction.reference !== params.reference) {
    throw new ValidationError("Paystack reference mismatch");
  }

  if (params.transaction.status !== "success") {
    throw new ValidationError(
      `Paystack transaction not successful: ${params.transaction.status}`,
    );
  }

  const expectedCurrency = (
    params.settings.general?.defaultCurrency || "NGN"
  ).toUpperCase();
  const transactionCurrency = String(
    params.transaction.currency || "",
  ).toUpperCase();
  if (transactionCurrency !== expectedCurrency) {
    throw new ValidationError("Paystack currency mismatch");
  }

  const expectedAmount = toPaystackAmountSubunits(
    Math.max(
      0,
      Number(order.total || 0) - Number(order.preorderOutstandingAmount || 0),
    ),
    expectedCurrency,
  );
  if (Number(params.transaction.amount) !== expectedAmount) {
    throw new ValidationError("Paystack amount mismatch");
  }

  const nextStatus = order.hasPreorder
    ? ORDER_STATUS.PREORDERED
    : ORDER_STATUS.PROCESSING;

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: {
        $nin: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_PAID],
      },
      status: { $ne: ORDER_STATUS.CANCELLED },
    },
    {
      $set: {
        paymentStatus:
          Number(order.preorderOutstandingAmount || 0) > 0
            ? PAYMENT_STATUS.PARTIALLY_PAID
            : PAYMENT_STATUS.PAID,
        status: nextStatus,
        paystackTransactionId: String(params.transaction.id),
        paymentId: String(params.transaction.id),
      },
    },
    { new: true },
  );

  if (!updatedOrder) {
    const freshOrder = await Order.findById(order._id).select(
      "paymentStatus status orderNumber",
    );
    if (
      freshOrder?.paymentStatus === PAYMENT_STATUS.PAID ||
      freshOrder?.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID
    ) {
      return {
        orderId: String(order._id),
        orderNumber: freshOrder.orderNumber,
        alreadyPaid: true,
      };
    }
    if (freshOrder?.status === ORDER_STATUS.CANCELLED) {
      throw new ValidationError(
        "Order was cancelled before payment capture. Please contact support for a refund.",
      );
    }
    throw new ConflictError("Order payment update failed");
  }

  await ensureChargeTransaction({
    _id: String(updatedOrder._id),
    orderNumber: updatedOrder.orderNumber,
    paymentMethod: updatedOrder.paymentMethod,
    paymentStatus: updatedOrder.paymentStatus,
    paymentId: updatedOrder.paymentId,
    stripePaymentIntentId: updatedOrder.stripePaymentIntentId,
    paypalCaptureId: updatedOrder.paypalCaptureId,
    razorpayPaymentId: updatedOrder.razorpayPaymentId,
    paystackTransactionId: updatedOrder.paystackTransactionId,
    subtotal: updatedOrder.subtotal,
    shippingCost: updatedOrder.shippingCost,
    tax: updatedOrder.tax,
    discount: updatedOrder.discount,
    total: updatedOrder.total,
    currency: params.settings.general?.defaultCurrency,
    channel: updatedOrder.channel || "online",
    createdAt: updatedOrder.createdAt,
  });

  await applyCouponUsageForOrder(String(updatedOrder._id)).catch((err) =>
    console.error("Failed to apply coupon usage on Paystack capture:", err),
  );

  try {
    if (updatedOrder.hasPreorder) {
      await reservePreorderQuantity(getOrderPreorderLines(updatedOrder.items));
      await markOrderPreorderReserved(String(updatedOrder._id)).catch((err) =>
        console.error(
          "Failed to mark preorder reserved on Paystack capture:",
          err,
        ),
      );
    } else {
      await decrementInventory(
        updatedOrder.items
          .filter(
            (item: { purchaseType?: string }) =>
              (item.purchaseType || PURCHASE_TYPE.STANDARD) ===
              PURCHASE_TYPE.STANDARD,
          )
          .map(
            (item: {
              productId: unknown;
              variantId?: unknown;
              quantity: number;
            }) => ({
              productId: String(item.productId),
              variantId: item.variantId ? String(item.variantId) : undefined,
              quantity: item.quantity,
            }),
          ),
      );
      await markOrderInventoryReserved(String(updatedOrder._id)).catch((err) =>
        console.error(
          "Failed to mark inventory reserved on Paystack capture:",
          err,
        ),
      );

      const affectedProductIds = Array.from(
        new Set(
          updatedOrder.items
            .filter(
              (item: { purchaseType?: string }) =>
                (item.purchaseType || PURCHASE_TYPE.STANDARD) ===
                PURCHASE_TYPE.STANDARD,
            )
            .map((item: { productId: unknown }) =>
              String(item.productId || "").trim(),
            )
            .filter(Boolean),
        ),
      );
      const affectedSlugs = affectedProductIds.length
        ? (
            await Product.find({ _id: { $in: affectedProductIds } })
              .select("slug")
              .lean()
          ).map((p) => p.slug)
        : [];
      revalidateProductContent({
        slugs: affectedSlugs.filter(
          (slug): slug is string =>
            typeof slug === "string" && slug.length > 0,
        ),
      });
    }
  } catch (err) {
    if (err instanceof InsufficientStockError || err instanceof PreorderUnavailableError) {
      await Order.updateOne(
        { _id: updatedOrder._id },
        { $set: { status: ORDER_STATUS.CANCELLED } },
      );
      await reverseCouponUsageForOrder(String(updatedOrder._id)).catch(
        (reverseErr) =>
          console.error(
            "Failed to reverse coupon usage after Paystack stock cancel:",
            reverseErr,
          ),
      );
      throw new ValidationError(
        "Payment captured but inventory is no longer available. Please contact support for a refund.",
      );
    }
    throw err;
  }

  if (params.sessionUserId || params.cartSessionId) {
    const cart = await Cart.findOne(
      params.sessionUserId
        ? { userId: params.sessionUserId }
        : { sessionId: params.cartSessionId },
    );
    if (cart) {
      await markCheckoutRecovered({
        cartId: cart._id,
        orderId: updatedOrder._id,
        paymentEvent: {
          gateway: "paystack",
          status: "succeeded",
          paymentId: String(params.transaction.id),
          message: "Paystack payment captured",
        },
      }).catch((err) =>
        console.error("Failed to mark abandoned checkout recovered:", err),
      );
      cart.items = [];
      await cart.save();
    }
  } else {
    await Promise.all([
      Cart.findOneAndUpdate(
        { userId: updatedOrder.customerId },
        { $set: { items: [] } },
      ),
      Cart.findByIdAndUpdate(updatedOrder.customerId, { $set: { items: [] } }),
    ]);
  }

  const customerEmail =
    params.customerEmail || params.transaction.customer?.email || undefined;
  if (customerEmail) {
    await sendOrderConfirmationEmail(
      {
        orderNumber: updatedOrder.orderNumber,
        customerName: updatedOrder.shippingAddress?.fullName || "Customer",
        customerEmail,
        items: updatedOrder.items.map(
          (item: {
            name: string;
            quantity: number;
            price: number;
            image?: string;
          }) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
          }),
        ),
        subtotal: updatedOrder.subtotal,
        discount: updatedOrder.discount,
        shipping: updatedOrder.shippingCost,
        tax: updatedOrder.tax,
        total: updatedOrder.total,
        shippingAddress: updatedOrder.shippingAddress,
        paymentMethod: updatedOrder.paymentMethod,
      },
      params.settings,
    );
  }

  await notifyOrderCreatedParticipants(updatedOrder).catch((err) =>
    console.error("Failed to create Paystack order notifications:", err),
  );

  return {
    orderId: String(updatedOrder._id),
    orderNumber: updatedOrder.orderNumber,
    alreadyPaid: false,
  };
}
