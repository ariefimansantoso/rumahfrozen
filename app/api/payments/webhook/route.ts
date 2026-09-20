import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { getStripeForSecretKey } from "@/lib/stripe";
import { getSettings } from "@/models/settings.model";
import { resolveStripeCredentials } from "@/lib/credentials";
import {
  finalizeStripeCheckoutSessionOrder,
  finalizeStripePaymentIntentOrder,
} from "@/lib/stripe-orders";
import Stripe from "stripe";

/**
 * POST /api/payments/webhook
 * Stripe webhook handler
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe signature" },
      { status: 400 },
    );
  }

  await connectDB();
  const settings = await getSettings();
  const stripeCreds = resolveStripeCredentials(settings.payment?.stripe);

  const webhookSecret = stripeCreds.webhookSecret;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const stripeSecretKey = stripeCreds.secretKey;
  if (!stripeSecretKey) {
    console.error("Missing STRIPE_SECRET_KEY");
    return NextResponse.json(
      { error: "Stripe secret key not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripeForSecretKey(stripeSecretKey).webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await finalizeStripeCheckoutSessionOrder(session, settings);
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Checkout session expired:", session.id);
      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await finalizeStripePaymentIntentOrder(paymentIntent, settings);
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log("Payment failed:", paymentIntent.id);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
