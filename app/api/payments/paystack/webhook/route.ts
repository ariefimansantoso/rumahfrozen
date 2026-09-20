import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import {
  getPaystackCredentials,
  type PaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/paystack";
import { finalizePaystackOrder } from "@/lib/paystack-orders";

type PaystackWebhookPayload = {
  event?: string;
  data?: PaystackTransaction;
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Paystack signature" },
      { status: 400 },
    );
  }

  await connectDB();
  const settings = await getSettings();
  const paystack = settings.payment?.paystack;
  const creds = getPaystackCredentials({
    publicKey: paystack?.publicKey,
    secretKey: paystack?.secretKey,
  });

  const isValidSignature = verifyPaystackWebhookSignature({
    body,
    signature,
    secretKey: creds.secretKey,
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: PaystackWebhookPayload;
  try {
    event = JSON.parse(body) as PaystackWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "charge.success" && event.data?.reference) {
    try {
      const transaction = await verifyPaystackTransaction({
        creds,
        reference: event.data.reference,
      });
      await finalizePaystackOrder({
        reference: event.data.reference,
        transaction,
        settings,
        customerEmail: transaction.customer?.email,
      });
    } catch (error) {
      console.error("Failed to finalize Paystack webhook transaction:", error);
    }
  }

  return NextResponse.json({ received: true });
}
