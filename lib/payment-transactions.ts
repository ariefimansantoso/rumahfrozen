import { PaymentTransaction } from "@/models";

type OrderLike = {
  _id: string;
  orderNumber: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
  stripePaymentIntentId?: string;
  paypalCaptureId?: string;
  razorpayPaymentId?: string;
  paystackTransactionId?: string;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  discount?: number;
  total?: number;
  currency?: string;
  channel?: string;
  posLocationId?: string;
  paymentMetadata?: Record<string, unknown>;
  createdAt?: Date | string;
};

export function getPaymentProviderFromOrder(order: OrderLike): string {
  const method = String(order.paymentMethod || "").toLowerCase();
  const channel = String(order.channel || "").toLowerCase();

  if (channel === "pos") {
    if (method === "cash") return "pos_cash";
    if (method === "card") return "pos_card";
    if (method === "manual") return "pos_manual";
    return method ? `pos_${method}` : "pos";
  }

  if (method === "card") return "stripe";
  if (method === "paypal") return "paypal";
  if (method === "razorpay") return "razorpay";
  if (method === "paystack") return "paystack";
  if (method === "cod") return "cod";
  if (method === "manual") return "manual";
  return method || "manual";
}

function getChargeExternalId(order: OrderLike): string | undefined {
  return (
    order.stripePaymentIntentId ||
    order.paypalCaptureId ||
    order.razorpayPaymentId ||
    order.paystackTransactionId ||
    order.paymentId ||
    undefined
  );
}

function getCurrency(order: OrderLike): string {
  const currency = String(order.currency || "").trim().toUpperCase();
  return currency || "USD";
}

function buildChargePayload(order: OrderLike, status: "pending" | "succeeded") {
  const gross = Number(order.total || 0);
  const externalId = getChargeExternalId(order);

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    type: "charge",
    status,
    provider: getPaymentProviderFromOrder(order),
    paymentMethod: order.paymentMethod || "manual",
    currency: getCurrency(order),
    grossAmount: gross,
    feeAmount: 0,
    netAmount: gross,
    refundedAmount: 0,
    externalId,
    metadata: {
      subtotal: Number(order.subtotal || 0),
      shippingCost: Number(order.shippingCost || 0),
      tax: Number(order.tax || 0),
      discount: Number(order.discount || 0),
      channel: order.channel || "online",
      posLocationId: order.posLocationId,
      source: "order-sync",
      ...(order.paymentMetadata || {}),
    },
    createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
  };
}

export async function ensureChargeTransaction(order: OrderLike) {
  const status = String(order.paymentStatus || "");
  if (status !== "paid" && status !== "partially_refunded" && status !== "refunded") {
    return;
  }

  const existing = await PaymentTransaction.findOne({
    orderId: order._id,
    type: "charge",
  })
    .select("_id status")
    .lean();

  const payload = buildChargePayload(order, "succeeded");

  if (existing) {
    await PaymentTransaction.updateOne(
      { _id: existing._id },
      {
        $set: {
          status: "succeeded",
          provider: payload.provider,
          paymentMethod: payload.paymentMethod,
          currency: payload.currency,
          grossAmount: payload.grossAmount,
          feeAmount: payload.feeAmount,
          netAmount: payload.netAmount,
          externalId: payload.externalId,
          metadata: payload.metadata,
        },
      },
    );
    if (existing.status !== "succeeded") {
      const { notifyAdminsPaymentReceived } = await import("@/lib/notifications");
      await notifyAdminsPaymentReceived({
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        amount: payload.grossAmount,
        currency: payload.currency,
        paymentMethod: payload.paymentMethod,
      });
    }
    return;
  }

  await PaymentTransaction.create(payload);
  const { notifyAdminsPaymentReceived } = await import("@/lib/notifications");
  await notifyAdminsPaymentReceived({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    amount: payload.grossAmount,
    currency: payload.currency,
    paymentMethod: payload.paymentMethod,
  });
}

export async function ensurePendingChargeTransaction(order: OrderLike) {
  const status = String(order.paymentStatus || "");
  if (status !== "pending" && status !== "partially_paid") return;

  const existing = await PaymentTransaction.findOne({
    orderId: order._id,
    type: "charge",
  })
    .select("_id")
    .lean();

  if (existing) return;

  await PaymentTransaction.create(buildChargePayload(order, "pending"));
}

export async function createRefundTransaction(params: {
  order: OrderLike;
  amount: number;
  reason?: string;
  createdBy?: string;
  /** Refund identifier returned by the payment gateway, when applicable. */
  externalRefundId?: string;
  /** Whether the refund was issued automatically via the gateway. */
  gatewayCalled?: boolean;
}) {
  const safeAmount = Math.max(0, Number(params.amount || 0));
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return null;

  const gross = Number(params.order.total || 0);
  const chargeExternalId = getChargeExternalId(params.order);

  const txn = await PaymentTransaction.create({
    orderId: params.order._id,
    orderNumber: params.order.orderNumber,
    type: "refund",
    status: "succeeded",
    provider: getPaymentProviderFromOrder(params.order),
    paymentMethod: params.order.paymentMethod || "manual",
    currency: getCurrency(params.order),
    grossAmount: safeAmount,
    feeAmount: 0,
    netAmount: -safeAmount,
    refundedAmount: safeAmount,
    externalId: params.externalRefundId || chargeExternalId,
    note: params.reason,
    metadata: {
      source: params.gatewayCalled === false ? "admin-refund-manual" : "admin-refund",
      channel: params.order.channel || "online",
      posLocationId: params.order.posLocationId,
      orderGrossAmount: gross,
      gatewayCalled: params.gatewayCalled !== false,
      chargeExternalId,
      gatewayRefundId: params.externalRefundId,
    },
    createdBy: params.createdBy,
  });

  await PaymentTransaction.updateMany(
    {
      orderId: params.order._id,
      type: "charge",
    },
    {
      $inc: { refundedAmount: safeAmount, netAmount: -safeAmount },
    },
  );

  return txn;
}
