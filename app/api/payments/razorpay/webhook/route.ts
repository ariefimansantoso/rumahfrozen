import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import {
  type RazorpayPayment,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import { finalizeRazorpayOrder } from "@/lib/razorpay-orders";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: RazorpayPayment;
    };
    order?: {
      entity?: {
        id?: string;
      };
    };
  };
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Razorpay signature" },
      { status: 400 },
    );
  }

  await connectDB();
  const settings = await getSettings();
  const webhookSecret =
    settings.payment?.razorpay?.webhookSecret ||
    process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing RAZORPAY_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const isValidSignature = verifyRazorpayWebhookSignature({
    body,
    signature,
    webhookSecret,
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(body) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const razorpayOrderId =
      payment?.order_id || event.payload?.order?.entity?.id;

    if (payment && razorpayOrderId) {
      await finalizeRazorpayOrder({
        razorpayOrderId,
        payment,
        settings,
        customerEmail: payment.email || undefined,
      });
    }
  }

  return NextResponse.json({ received: true });
}
