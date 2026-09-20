/**
 * POST /api/admin/settings/test-payment
 * Test Stripe/PayPal/Razorpay/Paystack credentials (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { USER_ROLES } from "@/config/app.config";
import { getSettings } from "@/models/settings.model";
import { connectDB } from "@/lib/db";
import { getStripeForSecretKey } from "@/lib/stripe";
import { getPayPalAccessToken } from "@/lib/paypal";
import {
  getRazorpayCredentials,
  testRazorpayCredentials,
} from "@/lib/razorpay";
import {
  getPaystackCredentials,
  testPaystackCredentials,
} from "@/lib/paystack";
import {
  resolvePayPalCredentials,
  resolveStripeCredentials,
} from "@/lib/credentials";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }
    if (session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 },
      );
    }
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    await connectDB();
    const settings = await getSettings();

    const body = (await request.json()) as { provider?: string } | undefined;
    const provider = body?.provider;

    if (provider === "stripe") {
      const secretKey = resolveStripeCredentials(
        settings.payment?.stripe,
      ).secretKey;
      if (!secretKey) {
        return NextResponse.json(
          { success: false, message: "Stripe secret key is missing" },
          { status: 400 },
        );
      }

      await getStripeForSecretKey(secretKey).accounts.retrieve();

      return NextResponse.json({ success: true, message: "Stripe is connected" });
    }

    if (provider === "paypal") {
      const { clientId, clientSecret, mode } = resolvePayPalCredentials(
        settings.payment?.paypal,
      );

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { success: false, message: "PayPal credentials are missing" },
          { status: 400 },
        );
      }

      await getPayPalAccessToken({
        clientId,
        clientSecret,
        mode,
      });

      return NextResponse.json({ success: true, message: "PayPal is connected" });
    }

    if (provider === "razorpay") {
      const razorpay = settings.payment?.razorpay;
      const creds = getRazorpayCredentials({
        keyId: razorpay?.keyId,
        keySecret: razorpay?.keySecret,
      });

      await testRazorpayCredentials(creds);

      return NextResponse.json({
        success: true,
        message: "Razorpay is connected",
      });
    }

    if (provider === "paystack") {
      const paystack = settings.payment?.paystack;
      const creds = getPaystackCredentials({
        publicKey: paystack?.publicKey,
        secretKey: paystack?.secretKey,
      });

      await testPaystackCredentials(creds);

      return NextResponse.json({
        success: true,
        message: "Paystack is connected",
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid provider" },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to test payment" },
      { status: 500 },
    );
  }
}
