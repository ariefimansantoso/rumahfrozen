import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Cart, Order, Product } from "@/models";
import { headers } from "next/headers";
import { capturePayPalOrder } from "@/lib/paypal";
import { resolvePayPalCredentials } from "@/lib/credentials";
import { decrementInventory, InsufficientStockError } from "@/lib/inventory";
import { markOrderInventoryReserved } from "@/lib/order-inventory";
import {
  getOrderPreorderLines,
  markOrderPreorderReserved,
  PreorderUnavailableError,
  PURCHASE_TYPE,
  reservePreorderQuantity,
} from "@/lib/preorders";
import { getSettings } from "@/models/settings.model";
import { after, NextRequest, NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/order-emails";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/config/app.config";
import { ensureChargeTransaction } from "@/lib/payment-transactions";
import {
  applyCouponUsageForOrder,
  reverseCouponUsageForOrder,
} from "@/lib/coupons";
import {
  handleApiError,
  ConflictError,
  ValidationError,
} from "@/lib/api/errors";
import { markCheckoutRecovered } from "@/lib/abandoned-checkouts";
import { notifyOrderCreatedParticipants } from "@/lib/notifications";
import { revalidateProductContent } from "@/lib/cache-invalidation";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const cartSessionId = request.cookies?.get("cart_session")?.value;

    const body = (await request.json()) as { orderId?: string };
    const orderId = body?.orderId;
    if (!orderId) throw new ValidationError("PayPal orderId is required");

    await connectDB();
    const settings = await getSettings();

    const paypal = settings.payment?.paypal;
    if (!paypal?.enabled) throw new ValidationError("PayPal is disabled");
    const paypalCreds = resolvePayPalCredentials(paypal);
    if (!paypalCreds.clientId || !paypalCreds.clientSecret) {
      throw new ValidationError("PayPal is not configured");
    }

    const orderQuery: Record<string, unknown> = {
      paypalOrderId: orderId,
      paymentMethod: "paypal",
    };
    if (session?.user?.id) {
      orderQuery.customerId = session.user.id;
    }
    const order = await Order.findOne(orderQuery);
    if (!order) {
      throw new ValidationError("Order not found for PayPal capture");
    }

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      return NextResponse.json({
        success: true,
        data: { orderNumber: order.orderNumber },
      });
    }

    // If the order was cancelled before capture (admin/customer cancel of a
    // pending order), refuse to resurrect it. PayPal will require a separate
    // refund flow to make the customer whole.
    if (order.status === ORDER_STATUS.CANCELLED) {
      throw new ValidationError(
        "Order was cancelled before payment capture. Please contact support for a refund.",
      );
    }

    const capture = await capturePayPalOrder({
      creds: {
        clientId: paypalCreds.clientId,
        clientSecret: paypalCreds.clientSecret,
        mode: paypalCreds.mode,
      },
      orderId,
    });

    if (!capture.captureId) {
      throw new ValidationError("PayPal capture failed: missing capture id");
    }

    const captureStatus =
      capture.raw?.status ||
      capture.raw?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (typeof captureStatus === "string" && captureStatus !== "COMPLETED") {
      throw new ValidationError(
        `PayPal capture not completed: ${captureStatus}`,
      );
    }

    const captureAmount =
      capture.raw?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    const captureCurrency =
      capture.raw?.purchase_units?.[0]?.payments?.captures?.[0]?.amount
        ?.currency_code;

    const expectedCurrency = (
      settings.general?.defaultCurrency || "USD"
    ).toUpperCase();
    if (
      typeof captureCurrency === "string" &&
      captureCurrency !== expectedCurrency
    ) {
      throw new ValidationError("PayPal currency mismatch");
    }
    if (typeof captureAmount === "string") {
      const capturedCents = Math.round(Number(captureAmount) * 100);
      const expectedDueNow = Math.max(
        0,
        Number(order.total || 0) - Number(order.preorderOutstandingAmount || 0),
      );
      const expectedCents = Math.round(expectedDueNow * 100);
      if (Number.isFinite(capturedCents) && capturedCents !== expectedCents) {
        throw new ValidationError("PayPal amount mismatch");
      }
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
          paypalCaptureId: capture.captureId,
          paymentId: capture.captureId,
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
        return NextResponse.json({
          success: true,
          data: { orderNumber: freshOrder.orderNumber },
        });
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
      subtotal: updatedOrder.subtotal,
      shippingCost: updatedOrder.shippingCost,
      tax: updatedOrder.tax,
      discount: updatedOrder.discount,
      total: updatedOrder.total,
      currency: settings.general?.defaultCurrency,
      channel: updatedOrder.channel || "online",
      createdAt: updatedOrder.createdAt,
    });

    await applyCouponUsageForOrder(String(updatedOrder._id)).catch((err) =>
      console.error("Failed to apply coupon usage on PayPal capture:", err),
    );

    try {
      if (updatedOrder.hasPreorder) {
        await reservePreorderQuantity(getOrderPreorderLines(updatedOrder.items));
        await markOrderPreorderReserved(String(updatedOrder._id)).catch((err) =>
          console.error(
            "Failed to mark preorder reserved on PayPal capture:",
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
            "Failed to mark inventory reserved on PayPal capture:",
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
              "Failed to reverse coupon usage after PayPal stock cancel:",
              reverseErr,
            ),
        );
        throw new ValidationError(
          "Payment captured but inventory is no longer available. Please contact support for a refund.",
        );
      }
      throw err;
    }

    const cartQuery = session?.user?.id
      ? { userId: session.user.id }
      : cartSessionId
        ? { sessionId: cartSessionId }
        : null;
    if (cartQuery) {
      const cart = await Cart.findOne(cartQuery);
      if (cart) {
        await markCheckoutRecovered({
          cartId: cart._id,
          orderId: updatedOrder._id,
          paymentEvent: {
            gateway: "paypal",
            status: "succeeded",
            paymentId: capture.captureId,
            message: "PayPal payment captured",
          },
        }).catch((err) =>
          console.error("Failed to mark abandoned checkout recovered:", err),
        );
        cart.items = [];
        await cart.save();
      }
    }

    const customerEmail =
      session?.user?.email || capture.raw?.payer?.email_address;
    // Confirmation email (PDF invoice + SMTP) and notifications run after
    // the response streams so the customer isn't held on the success page.
    after(async () => {
      if (customerEmail) {
        await sendOrderConfirmationEmail(
          {
            orderNumber: updatedOrder.orderNumber,
            customerName: updatedOrder.shippingAddress?.fullName || "Customer",
            customerEmail,
            items: updatedOrder.items.map(
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
            subtotal: updatedOrder.subtotal,
            shipping: updatedOrder.shippingCost,
            tax: updatedOrder.tax,
            total: updatedOrder.total,
            shippingAddress: updatedOrder.shippingAddress,
            paymentMethod: updatedOrder.paymentMethod,
          },
          settings,
        ).catch((err) =>
          console.error("Failed to send PayPal order confirmation email:", err),
        );
      }

      await notifyOrderCreatedParticipants(updatedOrder).catch((err) =>
        console.error("Failed to create PayPal order notifications:", err),
      );
    });

    return NextResponse.json({
      success: true,
      data: { orderNumber: updatedOrder.orderNumber },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
