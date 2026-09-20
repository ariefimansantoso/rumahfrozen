import { connectDB } from "@/lib/db";
import { AuthorizationError, ValidationError } from "@/lib/api/errors";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import { isValidObjectId, validateBody } from "@/lib/api/validate";
import { AdminUpdateReturnRequestSchema } from "@/lib/validations";
import { Order, PaymentTransaction, ReturnRequest } from "@/models";
import type { ReturnRequestItem } from "@/models/return-request.model";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { PAYMENT_STATUS, USER_ROLES } from "@/config/app.config";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { RETURN_REFUND_STATUS, RETURN_STATUS } from "@/lib/returns";
import { getSettings } from "@/models/settings.model";
import { refundOrderPayment } from "@/lib/order-refund";
import {
  createRefundTransaction,
  ensureChargeTransaction,
} from "@/lib/payment-transactions";
import { restoreOrderInventory } from "@/lib/order-inventory";
import { notifyReturnRequestCustomer } from "@/lib/notifications";
import { withApi } from "@/lib/api/handler";

function getTimestampUpdate(status?: string) {
  const now = new Date();
  if (status === RETURN_STATUS.APPROVED) return { approvedAt: now };
  if (status === RETURN_STATUS.REJECTED) return { rejectedAt: now };
  if (status === RETURN_STATUS.RECEIVED) return { receivedAt: now };
  if (status === RETURN_STATUS.INSPECTED) return { inspectedAt: now };
  if (status === RETURN_STATUS.REFUNDED) return { refundedAt: now, closedAt: now };
  if (status === RETURN_STATUS.CLOSED) return { closedAt: now };
  if (status === RETURN_STATUS.CANCELLED) return { closedAt: now };
  return {};
}

export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:returns:read",
      "lenient",
      session.user.role,
    );

    await connectDB();
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Return request");

    const returnRequest = await ReturnRequest.findOne({
      _id: id,
      $or: [{ ownerType: "admin" }, { ownerType: { $exists: false } }],
    })
      .populate("customerId", "name email phone")
      .lean();
    if (!returnRequest) return notFoundResponse("Return request");

    return successResponse(returnRequest);
  },
);

export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.EDIT_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:returns:update",
      "moderate",
      session.user.role,
    );

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Return request");
    const body = await validateBody(request, AdminUpdateReturnRequestSchema);

    await connectDB();
    const settings = await getSettings();

    const before = await ReturnRequest.findOne({
      _id: id,
      $or: [{ ownerType: "admin" }, { ownerType: { $exists: false } }],
    }).lean();
    if (!before) return notFoundResponse("Return request");

    const updates: Record<string, unknown> = {
      updatedBy: session.user.id,
      ...getTimestampUpdate(body.status),
    };
    if (body.status) updates.status = body.status;
    if (body.adminNote !== undefined) updates.adminNote = body.adminNote;
    if (body.rejectionReason !== undefined) {
    }
    if (body.carrier !== undefined) updates["shipment.carrier"] = body.carrier;
    if (body.trackingNumber !== undefined) {
      updates["shipment.trackingNumber"] = body.trackingNumber;
      updates.status = RETURN_STATUS.IN_TRANSIT;
    }

    if (body.receivedItems) {
      const items = (before.items as ReturnRequestItem[]).map((item) => {
        const received = body.receivedItems?.find(
          (entry) => entry.orderItemIndex === item.orderItemIndex,
        );
        if (!received) return item;
        return {
          ...item,
          quantityReceived: Math.min(
            Number(item.quantityApproved || item.quantityRequested || 0),
            Number(received.quantityReceived || 0),
          ),
          condition: received.condition || item.condition,
          restockable: received.restockable ?? item.restockable,
        };
      });
      updates.items = items;
      updates.receivedAt = new Date();
      updates.status = body.status || RETURN_STATUS.RECEIVED;
    }

    if (body.status === RETURN_STATUS.REJECTED) {
      updates.refundStatus = RETURN_REFUND_STATUS.NOT_REQUIRED;
    }

    let refundAmount = 0;
    let refundTxnId: string | undefined;
    let gatewayResult:
      | Awaited<ReturnType<typeof refundOrderPayment>>
      | null = null;

    if (body.refundAmount !== undefined) {
      if (session.user.role !== USER_ROLES.ADMIN) {
        throw new AuthorizationError("Only admins can issue refunds");
      }
      refundAmount = Number(body.refundAmount || 0);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new ValidationError("Refund amount must be greater than 0");
      }
      if (
        before.status === RETURN_STATUS.REJECTED ||
        before.status === RETURN_STATUS.CANCELLED
      ) {
        throw new ValidationError("Rejected or cancelled returns cannot be refunded");
      }

      const order = await Order.findById(before.orderId).lean();
      if (!order) throw new ValidationError("Order not found for this return");
      if (
        order.paymentStatus !== PAYMENT_STATUS.PAID &&
        order.paymentStatus !== PAYMENT_STATUS.PARTIALLY_REFUNDED
      ) {
        throw new ValidationError("Refunds can only be issued for paid orders");
      }

      const total = Number(order.total || 0);
      const [refundSummary] = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: "refund",
            status: "succeeded",
          },
        },
        { $group: { _id: null, totalRefunded: { $sum: "$grossAmount" } } },
      ]);
      const alreadyRefunded = Number(refundSummary?.totalRefunded || 0);
      const nextRefunded = alreadyRefunded + refundAmount;
      if (nextRefunded > total + 0.01) {
        throw new ValidationError("Refund amount exceeds order total");
      }

      gatewayResult = await refundOrderPayment({
        order: {
          paymentMethod: order.paymentMethod,
          channel: order.channel,
          paymentId: order.paymentId,
          stripePaymentIntentId: order.stripePaymentIntentId,
          paypalCaptureId: order.paypalCaptureId,
          razorpayPaymentId: order.razorpayPaymentId,
          paystackTransactionId: order.paystackTransactionId,
          currency: settings.general?.defaultCurrency,
        },
        amount: refundAmount,
        reason: body.refundReason || `Return ${before.returnNumber}`,
        manual: Boolean(body.manualRefund),
      });

      const paymentStatus =
        nextRefunded >= total - 0.01
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;
      const orderAfterRefund = await Order.findByIdAndUpdate(
        order._id,
        { $set: { paymentStatus } },
        { new: true },
      ).lean();
      if (!orderAfterRefund) throw new ValidationError("Order refund update failed");

      await ensureChargeTransaction({
        _id: String(orderAfterRefund._id),
        orderNumber: orderAfterRefund.orderNumber,
        paymentMethod: orderAfterRefund.paymentMethod,
        paymentStatus: orderAfterRefund.paymentStatus,
        paymentId: orderAfterRefund.paymentId,
        stripePaymentIntentId: orderAfterRefund.stripePaymentIntentId,
        paypalCaptureId: orderAfterRefund.paypalCaptureId,
        razorpayPaymentId: orderAfterRefund.razorpayPaymentId,
        paystackTransactionId: orderAfterRefund.paystackTransactionId,
        subtotal: orderAfterRefund.subtotal,
        shippingCost: orderAfterRefund.shippingCost,
        tax: orderAfterRefund.tax,
        discount: orderAfterRefund.discount,
        total: orderAfterRefund.total,
        currency: settings.general?.defaultCurrency,
        channel: orderAfterRefund.channel || "online",
        posLocationId: orderAfterRefund.posLocationId
          ? String(orderAfterRefund.posLocationId)
          : undefined,
        createdAt: orderAfterRefund.createdAt,
      });

      const txn = await createRefundTransaction({
        order: {
          _id: String(orderAfterRefund._id),
          orderNumber: orderAfterRefund.orderNumber,
          paymentMethod: orderAfterRefund.paymentMethod,
          paymentStatus: orderAfterRefund.paymentStatus,
          paymentId: orderAfterRefund.paymentId,
          stripePaymentIntentId: orderAfterRefund.stripePaymentIntentId,
          paypalCaptureId: orderAfterRefund.paypalCaptureId,
          razorpayPaymentId: orderAfterRefund.razorpayPaymentId,
          paystackTransactionId: orderAfterRefund.paystackTransactionId,
          subtotal: orderAfterRefund.subtotal,
          shippingCost: orderAfterRefund.shippingCost,
          tax: orderAfterRefund.tax,
          discount: orderAfterRefund.discount,
          total: orderAfterRefund.total,
          currency: settings.general?.defaultCurrency,
          channel: orderAfterRefund.channel || "online",
          posLocationId: orderAfterRefund.posLocationId
            ? String(orderAfterRefund.posLocationId)
            : undefined,
          createdAt: orderAfterRefund.createdAt,
        },
        amount: refundAmount,
        reason: body.refundReason || `Return ${before.returnNumber}`,
        createdBy: session.user.id,
        externalRefundId: gatewayResult.externalRefundId,
        gatewayCalled: gatewayResult.gatewayCalled,
      });
      refundTxnId = txn ? String(txn._id) : undefined;

      if (body.restoreInventoryOnRefund) {
        await restoreOrderInventory(String(order._id)).catch((err) =>
          console.error("Failed to restore inventory on return refund:", err),
        );
      }

      updates.status =
        refundAmount >= Number(before.estimatedRefund?.total || 0) - 0.01
          ? RETURN_STATUS.REFUNDED
          : RETURN_STATUS.PARTIALLY_REFUNDED;
      updates.refundStatus =
        gatewayResult.gatewayCalled === false
          ? RETURN_REFUND_STATUS.MANUAL_REQUIRED
          : RETURN_REFUND_STATUS.SUCCEEDED;
      updates.refundedAt = new Date();
      updates.closedAt = updates.status === RETURN_STATUS.REFUNDED ? new Date() : undefined;
      updates.actualRefund = {
        amount: refundAmount,
        paymentTransactionId: refundTxnId,
        provider: gatewayResult.provider,
        externalRefundId: gatewayResult.externalRefundId,
      };
    }

    const returnRequest = await ReturnRequest.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate("customerId", "name email phone")
      .lean();

    if (!returnRequest) return notFoundResponse("Return request");
    const statusChanged =
      returnRequest.status && String(returnRequest.status) !== String(before.status);
    const refundStatusChanged =
      returnRequest.refundStatus &&
      String(returnRequest.refundStatus) !== String(before.refundStatus);
    if (statusChanged || refundStatusChanged || body.refundAmount !== undefined) {
      await notifyReturnRequestCustomer(
        returnRequest,
        String(returnRequest.status),
        settings,
      ).catch((err) =>
        console.error("Failed to create return customer notification:", err),
      );
    }
    return successResponse(returnRequest);
  },
);
