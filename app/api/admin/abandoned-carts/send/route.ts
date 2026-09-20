import { Cart } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";

export const POST = withApi({ auth: "admin" }, async ({ request }) => {
  const body = await request.json();
  const { cartId } = body as { cartId?: string };
  if (!cartId) throw new ValidationError("cartId is required");

  const cart = await Cart.findById(cartId);
  if (!cart) return notFoundResponse("Cart");

  if (!cart.recoveryToken) {
    cart.recoveryToken = crypto.randomUUID();
  }
  cart.emailSentAt = new Date();
  await cart.save();

  // In a full implementation, send email using existing email settings.
  return successResponse(
    { recoveryToken: cart.recoveryToken },
    "Recovery email prepared",
  );
});
