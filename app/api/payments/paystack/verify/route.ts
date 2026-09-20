import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import {
  getPaystackCredentials,
  verifyPaystackTransaction,
} from "@/lib/paystack";
import { finalizePaystackOrder } from "@/lib/paystack-orders";
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
        "payments:paystack-verify",
        "strict",
        session.user.role,
      );
    } else if (cartSessionId) {
      rateLimitBySession(
        request,
        cartSessionId,
        "payments:paystack-verify",
        "strict",
      );
    } else {
      rateLimitByIP(request, "strict");
    }

    const body = (await request.json()) as { reference?: string };
    const reference = body?.reference;
    if (!reference) {
      throw new ValidationError("Paystack transaction reference is required");
    }

    await connectDB();
    const settings = await getSettings();
    const paystack = settings.payment?.paystack;

    if (!paystack?.enabled) {
      throw new ValidationError("Paystack is disabled");
    }

    const creds = getPaystackCredentials({
      publicKey: paystack.publicKey,
      secretKey: paystack.secretKey,
    });
    const transaction = await verifyPaystackTransaction({ creds, reference });

    const result = await finalizePaystackOrder({
      reference,
      transaction,
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
