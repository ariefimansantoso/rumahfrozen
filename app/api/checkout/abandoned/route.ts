import { connectDB } from "@/lib/db";
import { Cart } from "@/models";
import { successResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import {
  rateLimitByIP,
  rateLimitBySession,
  rateLimitByUser,
} from "@/lib/api/rate-limit-middleware";
import { updateCheckoutSnapshot } from "@/lib/abandoned-checkouts";
import type { Address } from "@/types";
import { withApi } from "@/lib/api/handler";

type TrackCheckoutBody = {
  locale?: string;
  email?: string;
  phone?: string;
  customerName?: string;
  buyerAcceptsMarketing?: boolean;
  shippingAddress?: Address;
  billingAddress?: TrackCheckoutBody["shippingAddress"];
  subtotalPrice?: number;
  shippingPrice?: number;
  totalTax?: number;
  totalDiscounts?: number;
  totalPrice?: number;
  presentmentCurrency?: string;
};

export const PATCH = withApi(
  { auth: "optional" },
  async ({ request, session }) => {
    const cartSessionId = request.cookies?.get("cart_session")?.value;

    if (session?.user?.id) {
      rateLimitByUser(
        request,
        session.user.id,
        "checkout:abandoned-track",
        "moderate",
        session.user.role,
      );
    } else if (cartSessionId) {
      rateLimitBySession(
        request,
        cartSessionId,
        "checkout:abandoned-track",
        "moderate",
      );
    } else {
      rateLimitByIP(request, "moderate");
    }

    await connectDB();

    const cartQuery = session?.user?.id
      ? { userId: session.user.id }
      : cartSessionId
        ? { sessionId: cartSessionId }
        : null;

    if (!cartQuery) {
      throw new ValidationError({ cart: ["Cart is empty"] });
    }

    const cart = await Cart.findOne(cartQuery);
    if (!cart || !cart.items?.length) {
      throw new ValidationError({ cart: ["Cart is empty"] });
    }

    const body = (await request.json().catch(() => ({}))) as TrackCheckoutBody;
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    await updateCheckoutSnapshot(cart, {
      origin,
      locale: body.locale || "en",
      email: body.email || session?.user?.email,
      phone: body.phone,
      customerName: body.customerName || session?.user?.name,
      customerLocale: body.locale,
      buyerAcceptsMarketing: body.buyerAcceptsMarketing,
      shippingAddress: body.shippingAddress,
      billingAddress: body.billingAddress,
      sourceName: "online_store",
      landingSite: request.headers.get("referer") || undefined,
      subtotalPrice: body.subtotalPrice,
      shippingPrice: body.shippingPrice,
      totalTax: body.totalTax,
      totalDiscounts: body.totalDiscounts,
      totalPrice: body.totalPrice,
      presentmentCurrency: body.presentmentCurrency,
    });

    return successResponse({
      checkoutId: String(cart._id),
      checkoutUrl: cart.checkoutUrl,
    });
  },
);
