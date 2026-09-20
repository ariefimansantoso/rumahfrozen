import { Cart } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(
  {},
  async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) throw new ValidationError("Recovery token is required");

    const cart = await Cart.findOne({
      $or: [{ checkoutToken: token }, { recoveryToken: token }],
      "items.0": { $exists: true },
    });

    if (!cart) return notFoundResponse("Checkout");

    if (cart.status !== "recovered") {
      cart.status = "active";
      cart.lastActionAt = new Date();
      await cart.save();
    }

    const totalItems = cart.items.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0,
    );
    const subtotal = cart.items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0,
    );

    const response = successResponse({
      cartId: String(cart._id),
      items: cart.items,
      totalItems,
      subtotal,
    });

    if (cart.sessionId) {
      response.headers.set(
        "Set-Cookie",
        `cart_session=${cart.sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
          60 * 60 * 24 * 30
        }`,
      );
    }

    return response;
  },
);
