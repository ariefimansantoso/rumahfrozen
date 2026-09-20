import {
  getStripeForSecretKey,
  isStripeSecretKeyConfigured,
} from "@/lib/stripe";
import {
  capturePayPalOrder as _capturePayPalOrder,
  refundPayPalCapture,
  type PayPalMode,
} from "@/lib/paypal";
import {
  getRazorpayCredentials,
  isRazorpayConfigured,
  refundRazorpayPayment,
} from "@/lib/razorpay";
import {
  getPaystackCredentials,
  isPaystackConfigured,
  refundPaystackTransaction,
} from "@/lib/paystack";
import { getSettings } from "@/models/settings.model";

// Reference unused import to keep tree-shaking happy without breaking types.
void _capturePayPalOrder;

export type RefundGatewayResult = {
  /** Whether the gateway was actually called. */
  gatewayCalled: boolean;
  /** Provider that handled the refund (or "manual" if recorded only). */
  provider: string;
  /** Provider-specific refund identifier, when available. */
  externalRefundId?: string;
  /** Provider-specific refund status string, when available. */
  status?: string;
};

type OrderRefundContext = {
  paymentMethod?: string;
  channel?: string;
  paymentId?: string;
  stripePaymentIntentId?: string;
  paypalCaptureId?: string;
  razorpayPaymentId?: string;
  paystackTransactionId?: string;
  currency?: string;
};

function normalizeMethod(value?: string) {
  return String(value || "").toLowerCase();
}

/**
 * Process a refund through the appropriate payment gateway.
 *
 * Supported automatic refunds: Stripe (card), PayPal, Razorpay, Paystack.
 * Manual record-only paths: COD, manual, and POS channels — the caller is
 * expected to record a PaymentTransaction even when no gateway is called.
 *
 * Set `manual: true` to skip the gateway and treat the refund as already
 * settled out-of-band (e.g., refunded via a provider dashboard or in cash).
 */
export async function refundOrderPayment(params: {
  order: OrderRefundContext;
  amount: number;
  reason?: string;
  manual?: boolean;
}): Promise<RefundGatewayResult> {
  const { order, amount, reason, manual } = params;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Refund amount must be greater than 0");
  }

  const channel = normalizeMethod(order.channel);
  const method = normalizeMethod(order.paymentMethod);

  // POS, COD, manual, or explicit manual flag → no gateway call.
  if (
    manual ||
    channel === "pos" ||
    method === "cod" ||
    method === "manual" ||
    method === "cash"
  ) {
    return { gatewayCalled: false, provider: manual ? "manual" : method || "manual" };
  }

  // Stripe card payments
  if (method === "card" || method === "stripe") {
    const intentId = order.stripePaymentIntentId || order.paymentId;
    if (!intentId) {
      throw new Error(
        "Cannot refund via Stripe: order is missing a payment intent ID",
      );
    }
    const settings = await getSettings();
    const stripeSettings = settings.payment?.stripe;
    if (
      !stripeSettings?.enabled ||
      !isStripeSecretKeyConfigured(stripeSettings.secretKey)
    ) {
      throw new Error("Stripe is not configured for refunds");
    }
    // Use the same secret-key resolution as checkout so a merchant configured
    // via Settings UI (rather than env vars) can still issue refunds.
    const stripe = getStripeForSecretKey(stripeSettings.secretKey);
    const refund = await stripe.refunds.create({
      payment_intent: intentId,
      amount: Math.round(amount * 100),
      reason: "requested_by_customer",
      metadata: reason ? { note: reason.slice(0, 500) } : undefined,
    });
    return {
      gatewayCalled: true,
      provider: "stripe",
      externalRefundId: refund.id,
      status: refund.status || undefined,
    };
  }

  // PayPal
  if (method === "paypal") {
    const captureId = order.paypalCaptureId;
    if (!captureId) {
      throw new Error(
        "Cannot refund via PayPal: order is missing a capture ID",
      );
    }
    const settings = await getSettings();
    const paypal = settings.payment?.paypal;
    if (!paypal?.enabled || !paypal.clientId || !paypal.clientSecret) {
      throw new Error("PayPal is not configured for refunds");
    }
    const result = await refundPayPalCapture({
      creds: {
        clientId: paypal.clientId,
        clientSecret: paypal.clientSecret,
        mode: ((paypal.mode as PayPalMode) || "sandbox") as PayPalMode,
      },
      captureId,
      amount,
      currency: order.currency,
      reason,
    });
    return {
      gatewayCalled: true,
      provider: "paypal",
      externalRefundId: result.refundId,
      status: result.status,
    };
  }

  // Razorpay
  if (method === "razorpay") {
    const paymentId = order.razorpayPaymentId || order.paymentId;
    if (!paymentId) {
      throw new Error(
        "Cannot refund via Razorpay: order is missing a payment ID",
      );
    }
    const settings = await getSettings();
    const razorpay = settings.payment?.razorpay;
    if (
      !razorpay?.enabled ||
      !isRazorpayConfigured(razorpay.keyId, razorpay.keySecret)
    ) {
      throw new Error("Razorpay is not configured for refunds");
    }
    const creds = getRazorpayCredentials({
      keyId: razorpay.keyId,
      keySecret: razorpay.keySecret,
    });
    const result = await refundRazorpayPayment({
      creds,
      paymentId,
      amount,
      currency: order.currency,
      notes: reason ? { reason: reason.slice(0, 255) } : undefined,
    });
    return {
      gatewayCalled: true,
      provider: "razorpay",
      externalRefundId: result.id,
      status: result.status,
    };
  }

  // Paystack
  if (method === "paystack") {
    const reference = order.paystackTransactionId || order.paymentId;
    if (!reference) {
      throw new Error(
        "Cannot refund via Paystack: order is missing a transaction reference",
      );
    }
    const settings = await getSettings();
    const paystack = settings.payment?.paystack;
    if (
      !paystack?.enabled ||
      !isPaystackConfigured(paystack.secretKey)
    ) {
      throw new Error("Paystack is not configured for refunds");
    }
    const creds = getPaystackCredentials({
      secretKey: paystack.secretKey,
      publicKey: paystack.publicKey,
    });
    const result = await refundPaystackTransaction({
      creds,
      transaction: reference,
      amount,
      currency: order.currency,
      reason,
    });
    return {
      gatewayCalled: true,
      provider: "paystack",
      externalRefundId: String(result.id),
      status: result.status,
    };
  }

  throw new Error(
    `Automatic refund is not supported for payment method "${method}". Pass manual: true to record an out-of-band refund.`,
  );
}
