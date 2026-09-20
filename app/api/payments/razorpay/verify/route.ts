import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import {
  captureRazorpayPayment,
  fetchRazorpayPayment,
  getRazorpayCredentials,
  getRazorpayCurrencyExponent,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay";
import { finalizeRazorpayOrder } from "@/lib/razorpay-orders";
import {
  rateLimitByIP,
  rateLimitBySession,
  rateLimitByUser,
} from "@/lib/api/rate-limit-middleware";
import { ValidationError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(
  { auth: "optional" },
  async ({ request, session }) => {
    const cartSessionId = request.cookies?.get("cart_session")?.value;

    if (session?.user?.id) {
      rateLimitByUser(
        request,
        session.user.id,
        "payments:razorpay-verify",
        "strict",
        session.user.role,
      );
    } else if (cartSessionId) {
      rateLimitBySession(
        request,
        cartSessionId,
        "payments:razorpay-verify",
        "strict",
      );
    } else {
      rateLimitByIP(request, "strict");
    }

    const body = (await request.json()) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const razorpayOrderId = body?.razorpay_order_id;
    const razorpayPaymentId = body?.razorpay_payment_id;
    const razorpaySignature = body?.razorpay_signature;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new ValidationError("Razorpay payment verification data is missing");
    }

    await connectDB();
    const settings = await getSettings();
    const razorpay = settings.payment?.razorpay;

    if (!razorpay?.enabled) {
      throw new ValidationError("Razorpay is disabled");
    }

    const creds = getRazorpayCredentials({
      keyId: razorpay.keyId,
      keySecret: razorpay.keySecret,
    });

    const isValidSignature = verifyRazorpayPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      keySecret: creds.keySecret,
    });

    if (!isValidSignature) {
      throw new ValidationError("Razorpay payment signature mismatch");
    }

    let payment = await fetchRazorpayPayment({
      creds,
      paymentId: razorpayPaymentId,
    });

    if (payment.status === "authorized" && payment.captured !== true) {
      const paymentCurrency = String(
        payment.currency ||
        settings.general?.defaultCurrency || "INR"
      ).toUpperCase();
      const currencyExponent = getRazorpayCurrencyExponent(paymentCurrency);
      payment = await captureRazorpayPayment({
        creds,
        paymentId: razorpayPaymentId,
        amount: Number(payment.amount || 0) / 10 ** currencyExponent,
        currency: paymentCurrency,
      });
    }

    const result = await finalizeRazorpayOrder({
      razorpayOrderId,
      payment,
      settings,
      sessionUserId: session?.user?.id,
      cartSessionId,
      customerEmail: session?.user?.email,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        alreadyPaid: result.alreadyPaid,
      },
    });
  },
);
