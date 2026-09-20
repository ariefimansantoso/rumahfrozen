import { Order } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { AuthorizationError } from "@/lib/api/errors";
import { restoreOrderInventory } from "@/lib/order-inventory";
import { releaseOrderPreorders } from "@/lib/preorders";
import { reverseCouponUsageForOrder } from "@/lib/coupons";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/orders/[id]
 * Get a single order by ID
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    const { id } = params;
    const order = await Order.findOne({
      _id: id,
      customerId: session.user.id,
    }).lean();

    if (!order) {
      return notFoundResponse("Order");
    }

    return successResponse(order);
  },
);

/**
 * PUT /api/orders/[id]
 * Update order (customer can only cancel pending orders)
 */
export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const { id } = params;
    const body = await request.json();

    const order = await Order.findOne({
      _id: id,
      customerId: session.user.id,
    });

    if (!order) {
      return notFoundResponse("Order");
    }

    // Customers can only cancel pending orders
    if (
      body.status === "cancelled" &&
      (order.status === "pending" || order.status === "preordered")
    ) {
      order.status = "cancelled";
      // Update all sub-orders
      order.subOrders.forEach((subOrder: { status: string }) => {
        subOrder.status = "cancelled";
      });
      await order.save();

      // Restore inventory only for sub-orders that actually had a reservation.
      // For abandoned PayPal/Razorpay/Paystack pending orders no decrement
      // ever happened, so this safely no-ops.
      await restoreOrderInventory(String(order._id)).catch((err) =>
        console.error("Failed to restore inventory on customer cancel:", err),
      );
      await releaseOrderPreorders(String(order._id)).catch((err) =>
        console.error("Failed to release preorder quota on customer cancel:", err),
      );

      await reverseCouponUsageForOrder(String(order._id)).catch((err) =>
        console.error("Failed to reverse coupon usage on customer cancel:", err),
      );

      return successResponse(order);
    }

    throw new AuthorizationError("You can only cancel pending orders");
  },
);
