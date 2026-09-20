import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody, isValidObjectId } from "@/lib/api/validate";
import { AdminUpdateOrderSchema } from "@/lib/validations";
import { auditUpdate, createAuditContext } from "@/lib/audit";
import { restoreOrderInventory } from "@/lib/order-inventory";
import { releaseOrderPreorders } from "@/lib/preorders";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffOrderScopeFilter,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import { ORDER_STATUS, PAYMENT_STATUS, USER_ROLES } from "@/config/app.config";
import {
  createRefundTransaction,
  ensureChargeTransaction,
} from "@/lib/payment-transactions";
import { refundOrderPayment } from "@/lib/order-refund";
import { reverseCouponUsageForOrder } from "@/lib/coupons";
import { PaymentTransaction } from "@/models/payment-transaction.model";
import {
  getOrderStatusActionByTarget,
  getOrderStatusTimestampUpdates,
  shouldRestoreInventoryForStatusTransition,
} from "@/lib/order-status-workflow";
import type { StaffPermission } from "@/config/permissions.config";
import { notifyOrderStatus } from "@/lib/notifications";
import { withApi } from "@/lib/api/handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function hasStaffPermission(
  staffPermissions: StaffPermission[] | undefined,
  permission: StaffPermission,
) {
  return !staffPermissions || staffPermissions.includes(permission);
}

/**
 * GET /api/admin/orders/[id]
 * Get a single order by ID
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:orders:read",
      "lenient",
      session.user.role
    );

    await connectDB();

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Order");
    const order = await Order.findOne(
      mergeScopeFilter({ _id: id }, buildStaffOrderScopeFilter(access.staffScope)),
    )
      .populate("customerId", "name email phone")
      .lean();

    if (!order) {
      return notFoundResponse("Order");
    }

    return successResponse(order);
  },
);

/**
 * PUT /api/admin/orders/[id]
 * Update order status
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [
        STAFF_PERMISSIONS.EDIT_ORDERS,
        STAFF_PERMISSIONS.MANAGE_ORDERS,
        STAFF_PERMISSIONS.DELETE_ORDERS,
      ],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:orders:update",
      "moderate",
      session.user.role
    );

    await connectDB();

    const { id } = await params;
    if (!isValidObjectId(id)) return notFoundResponse("Order");

    const body = await validateBody(request, AdminUpdateOrderSchema);
    const isRefundRequest =
      body.refundAmount !== undefined ||
      body.paymentStatus === PAYMENT_STATUS.REFUNDED ||
      body.paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED;
    if (isRefundRequest && session.user.role !== USER_ROLES.ADMIN) {
      throw new AuthorizationError("Only admins can process refunds");
    }

    const canEditOrder =
      hasStaffPermission(access.staffPermissions, STAFF_PERMISSIONS.EDIT_ORDERS) ||
      hasStaffPermission(access.staffPermissions, STAFF_PERMISSIONS.MANAGE_ORDERS);
    const canCancelOrder =
      hasStaffPermission(access.staffPermissions, STAFF_PERMISSIONS.DELETE_ORDERS) ||
      hasStaffPermission(access.staffPermissions, STAFF_PERMISSIONS.MANAGE_ORDERS);

    const allowedUpdates = [
      "status",
      "paymentStatus",
      "notes",
      "trackingNumber",
      "carrier",
      "cancelReason",
    ] as const;
    const updates: Record<string, unknown> = {};
    type Body = typeof body;
    for (const key of allowedUpdates) {
      const k = key as keyof Body;
      if (body[k] !== undefined) {
        updates[key] = body[k] as unknown;
      }
    }

    const before = await Order.findOne(
      mergeScopeFilter({ _id: id }, buildStaffOrderScopeFilter(access.staffScope)),
    ).lean();
    if (!before) return notFoundResponse("Order");

    const isCancelTransition = body.status === ORDER_STATUS.CANCELLED;
    const hasNonCancelStatusUpdate = Boolean(body.status && !isCancelTransition);
    const hasNonStatusUpdate = Boolean(
      body.paymentStatus !== undefined ||
        body.notes !== undefined ||
        body.trackingNumber !== undefined ||
        body.carrier !== undefined ||
        (body.cancelReason !== undefined && !isCancelTransition) ||
        body.refundAmount !== undefined ||
        body.refundReason !== undefined,
    );

    if (isCancelTransition && !canCancelOrder) {
      throw new AuthorizationError("You do not have permission to cancel orders");
    }
    if ((hasNonCancelStatusUpdate || hasNonStatusUpdate) && !canEditOrder) {
      throw new AuthorizationError("You do not have permission to edit orders");
    }

    if (body.status) {
      const currentStatus = before.status as string;
      const transition = getOrderStatusActionByTarget(currentStatus, body.status);
      if (!transition) {
        throw new ValidationError(
          `Cannot transition order from "${currentStatus}" to "${body.status}"`
        );
      }

      const changedAt = new Date();
      Object.assign(updates, getOrderStatusTimestampUpdates(body.status, changedAt));
      updates.statusChangedBy = session.user.id;

      if (body.status === ORDER_STATUS.SHIPPED) {
        if (body.trackingNumber) {
          updates.trackingNumber = body.trackingNumber.trim();
          updates["subOrders.$[].trackingNumber"] = body.trackingNumber.trim();
        }
        if (body.carrier) {
          updates.carrier = body.carrier.trim();
        }
        updates["subOrders.$[].shippedAt"] = changedAt;
      }

      if (body.status === ORDER_STATUS.DELIVERED) {
        updates["subOrders.$[].deliveredAt"] = changedAt;
      }
    }

    if (!body.status && body.trackingNumber) {
      updates.trackingNumber = body.trackingNumber.trim();
      updates["subOrders.$[].trackingNumber"] = body.trackingNumber.trim();
    }
    if (body.carrier) {
      updates.carrier = body.carrier.trim();
    }
    if (body.cancelReason) {
      updates.cancelReason = body.cancelReason.trim();
    }

    let refundAmount = 0;
    let refundGatewayResult:
      | Awaited<ReturnType<typeof refundOrderPayment>>
      | null = null;
    if (
      (body.paymentStatus === PAYMENT_STATUS.REFUNDED ||
        body.paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED) &&
      body.refundAmount === undefined
    ) {
      throw new ValidationError("Refund amount is required to refund an order");
    }

    if (body.refundAmount !== undefined) {
      const parsedRefundAmount = Number(body.refundAmount);
      if (!Number.isFinite(parsedRefundAmount) || parsedRefundAmount <= 0) {
        throw new ValidationError("Refund amount must be greater than 0");
      }
      if (
        before.paymentStatus !== PAYMENT_STATUS.PAID &&
        before.paymentStatus !== PAYMENT_STATUS.PARTIALLY_REFUNDED
      ) {
        throw new ValidationError(
          "Refunds can only be processed for paid orders",
        );
      }

      const total = Number(before.total || 0);
      const [refundSummary] = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: before._id,
            type: "refund",
            status: "succeeded",
          },
        },
        {
          $group: {
            _id: null,
            totalRefunded: { $sum: "$grossAmount" },
          },
        },
      ]);
      const alreadyRefunded = Number(refundSummary?.totalRefunded || 0);
      const nextRefunded = alreadyRefunded + parsedRefundAmount;
      if (nextRefunded > total + 0.01) {
        throw new ValidationError("Refund amount exceeds order total");
      }

      // Call the payment gateway BEFORE persisting the refunded status so a
      // gateway failure leaves the order in its previous state. For COD/POS/
      // manual flows (or when the admin explicitly opts into recording an
      // out-of-band refund), the gateway call is skipped.
      const gatewaySettings = await getSettings();
      try {
        refundGatewayResult = await refundOrderPayment({
          order: {
            paymentMethod: before.paymentMethod,
            channel: before.channel,
            paymentId: before.paymentId,
            stripePaymentIntentId: before.stripePaymentIntentId,
            paypalCaptureId: before.paypalCaptureId,
            razorpayPaymentId: before.razorpayPaymentId,
            paystackTransactionId: before.paystackTransactionId,
            currency: gatewaySettings.general?.defaultCurrency,
          },
          amount: parsedRefundAmount,
          reason: body.refundReason,
          manual: Boolean(body.manualRefund),
        });
      } catch (gatewayError) {
        const message =
          gatewayError instanceof Error
            ? gatewayError.message
            : "Refund failed at the payment gateway";
        throw new ValidationError(message);
      }

      refundAmount = parsedRefundAmount;
      updates.paymentStatus =
        nextRefunded >= total - 0.01
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;
    }

    // If overall status changes, update all sub-orders
    if (updates.status) {
      updates["subOrders.$[].status"] = updates.status;
    }

    const order = await Order.findOneAndUpdate(
      mergeScopeFilter({ _id: id }, buildStaffOrderScopeFilter(access.staffScope)),
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("customerId", "name email")
      .lean();

    if (!order) {
      return notFoundResponse("Order");
    }

    let settingsForSideEffects: Awaited<ReturnType<typeof getSettings>> | null =
      null;
    const getSideEffectSettings = async () => {
      if (!settingsForSideEffects) {
        settingsForSideEffects = await getSettings();
      }
      return settingsForSideEffects;
    };

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      const settings = await getSideEffectSettings();
      await ensureChargeTransaction({
        _id: String(order._id),
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentId: order.paymentId,
        stripePaymentIntentId: order.stripePaymentIntentId,
        paypalCaptureId: order.paypalCaptureId,
        razorpayPaymentId: order.razorpayPaymentId,
        paystackTransactionId: order.paystackTransactionId,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        currency: settings.general?.defaultCurrency,
        channel: order.channel || "online",
        posLocationId: order.posLocationId ? String(order.posLocationId) : undefined,
        createdAt: order.createdAt,
      });
    }

    if (refundAmount > 0) {
      // Optionally restore inventory when the admin opts in. Done after the
      // gateway refund succeeds, before the transaction record so a failure
      // here doesn't block recording. The per-sub-order claim handles the
      // multi-vendor case correctly.
      if (body.restoreInventoryOnRefund) {
        await restoreOrderInventory(id).catch((err) =>
          console.error("Failed to restore inventory on refund:", err),
        );
      }

      const settings = await getSideEffectSettings();
      await createRefundTransaction({
        order: {
          _id: String(order._id),
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          paymentId: order.paymentId,
          stripePaymentIntentId: order.stripePaymentIntentId,
          paypalCaptureId: order.paypalCaptureId,
          razorpayPaymentId: order.razorpayPaymentId,
          paystackTransactionId: order.paystackTransactionId,
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          tax: order.tax,
          discount: order.discount,
          total: order.total,
          currency: settings.general?.defaultCurrency,
          channel: order.channel || "online",
          posLocationId: order.posLocationId ? String(order.posLocationId) : undefined,
          createdAt: order.createdAt,
        },
        amount: refundAmount,
        reason: body.refundReason,
        createdBy: session.user.id,
        externalRefundId: refundGatewayResult?.externalRefundId,
        gatewayCalled: refundGatewayResult?.gatewayCalled,
      });
    }

    // Restore inventory when order is cancelled. The helper claims the
    // restore atomically per sub-order, so abandoned-pending orders (no
    // decrement ever happened) are no-ops, and orders already partly
    // restored by a vendor cancel only restore the remaining sub-orders.
    if (
      body.status &&
      shouldRestoreInventoryForStatusTransition(before.status as string, body.status)
    ) {
      await restoreOrderInventory(id).catch((err) =>
        console.error("Failed to restore inventory on admin cancel:", err),
      );
      await releaseOrderPreorders(id).catch((err) =>
        console.error("Failed to release preorder quota on admin cancel:", err),
      );
    }

    // Reverse coupon usage on cancellation or full refund.
    const movedToCancelled =
      body.status === ORDER_STATUS.CANCELLED &&
      before.status !== ORDER_STATUS.CANCELLED;
    const movedToFullyRefunded =
      updates.paymentStatus === PAYMENT_STATUS.REFUNDED &&
      before.paymentStatus !== PAYMENT_STATUS.REFUNDED;
    if (movedToCancelled || movedToFullyRefunded) {
      await reverseCouponUsageForOrder(id).catch((err) =>
        console.error("Failed to reverse coupon usage:", err),
      );
    }

    // Send customer notification and matching email if status changed.
    if (body.status && order.customerId) {
      const rawCustomerId = (order.customerId as { _id?: unknown })?._id;
      const customerId = rawCustomerId ? String(rawCustomerId) : "";

      if (customerId) {
        await notifyOrderStatus(
          customerId,
          order.orderNumber,
          body.status,
          String(order._id),
        ).catch((err) =>
          console.error("Failed to create order status notification:", err),
        );
      }
    }

    const auditContext = createAuditContext(request, session);
    await auditUpdate(
      auditContext,
      "order",
      id,
      (before || {}) as unknown as Record<string, unknown>,
      order as unknown as Record<string, unknown>,
    );

    return successResponse(order);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/admin/orders/[id]
 * Delete an order (soft delete - set to cancelled)
 */
export const DELETE = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.DELETE_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:orders:cancel",
      "moderate",
      session.user.role
    );

    await connectDB();

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Order");

    const before = await Order.findOne(
      mergeScopeFilter({ _id: id }, buildStaffOrderScopeFilter(access.staffScope)),
    ).lean();
    if (!before) return notFoundResponse("Order");

    if (before.status === "cancelled") {
      return successResponse({ message: "Order is already cancelled" });
    }

    const transition = getOrderStatusActionByTarget(
      before.status as string,
      ORDER_STATUS.CANCELLED,
    );
    if (!transition) {
      throw new ValidationError(
        `Cannot transition order from "${before.status}" to "${ORDER_STATUS.CANCELLED}"`,
      );
    }

    const cancelledAt = new Date();
    const order = await Order.findOneAndUpdate(
      mergeScopeFilter({ _id: id }, buildStaffOrderScopeFilter(access.staffScope)),
      {
        $set: {
          status: ORDER_STATUS.CANCELLED,
          "subOrders.$[].status": ORDER_STATUS.CANCELLED,
          cancelledAt,
          statusChangedBy: session.user.id,
        },
      },
      { new: true }
    );

    if (!order) {
      return notFoundResponse("Order");
    }

    // Restore inventory atomically per sub-order so we never double-restore.
    await restoreOrderInventory(id).catch((err) =>
      console.error("Failed to restore inventory on admin DELETE:", err),
    );
    await releaseOrderPreorders(id).catch((err) =>
      console.error("Failed to release preorder quota on admin DELETE:", err),
    );

    // Reverse coupon usage for cancelled orders that previously consumed it.
    await reverseCouponUsageForOrder(id).catch((err) =>
      console.error("Failed to reverse coupon usage on cancel:", err),
    );

    const auditContext = createAuditContext(request, session);
    await auditUpdate(
      auditContext,
      "order",
      id,
      before as unknown as Record<string, unknown>,
      order.toObject() as unknown as Record<string, unknown>,
    );

    return successResponse({ message: "Order cancelled successfully" });
  },
);
