import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import { AuthorizationError, ValidationError } from "@/lib/api/errors";
import { ORDER_STATUS, USER_ROLES } from "@/config/app.config";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { isValidObjectId } from "@/lib/api/validate";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffOrderScopeFilter,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import {
  PREORDER_ITEM_STATUS,
  PURCHASE_TYPE,
  releaseOrderPreorders,
} from "@/lib/preorders";
import { reverseCouponUsageForOrder } from "@/lib/coupons";
import { notifyPreorderCustomerUpdate } from "@/lib/notifications";
import { withApi } from "@/lib/api/handler";

export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.EDIT_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:preorders:update",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Pre-order");

    const body = (await request.json().catch(() => ({}))) as {
      action?: "ready" | "payment_due" | "cancel" | "delay";
      releaseDate?: string;
      reason?: string;
    };

    const scopeQuery = mergeScopeFilter(
      { _id: id, hasPreorder: true },
      buildStaffOrderScopeFilter(access.staffScope),
    );
    const before = await Order.findOne(scopeQuery).lean();
    if (!before) return notFoundResponse("Pre-order");

    if (body.action === "ready" || body.action === "payment_due") {
      const outstandingAmount = Number(before.preorderOutstandingAmount || 0);
      const shouldRequestPayment =
        body.action === "payment_due" || outstandingAmount > 0;
      const nextOrderStatus = shouldRequestPayment
        ? ORDER_STATUS.PREORDERED
        : ORDER_STATUS.PROCESSING;
      const nextPreorderStatus = shouldRequestPayment
        ? PREORDER_ITEM_STATUS.PAYMENT_DUE
        : PREORDER_ITEM_STATUS.READY;
      const order = await Order.findOneAndUpdate(
        scopeQuery,
        {
          $set: {
            status: nextOrderStatus,
            preorderStatus: nextPreorderStatus,
            statusChangedBy: session.user.id,
            ...(shouldRequestPayment ? {} : { processingAt: new Date() }),
            "items.$[item].preorderStatus": nextPreorderStatus,
            "subOrders.$[].status": nextOrderStatus,
            "subOrders.$[].items.$[subItem].preorderStatus":
              nextPreorderStatus,
          },
        },
        {
          new: true,
          arrayFilters: [
            { "item.purchaseType": PURCHASE_TYPE.PREORDER },
            { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
          ],
        },
      );
      if (!order) return notFoundResponse("Pre-order");
      await notifyPreorderCustomerUpdate(
        String(order.customerId),
        order.orderNumber,
        shouldRequestPayment ? "payment_due" : "ready",
        String(order._id),
        {
          releaseDate: order.preorderReleaseDate,
          outstandingAmount,
        },
      ).catch((err) =>
        console.error("Failed to notify preorder customer:", err),
      );
      return successResponse(order);
    }

    if (body.action === "delay") {
      const releaseDate = body.releaseDate ? new Date(body.releaseDate) : null;
      if (!releaseDate || Number.isNaN(releaseDate.getTime())) {
        throw new ValidationError("A valid release date is required");
      }
      const reason =
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim().slice(0, 500)
          : undefined;
      const previousReleaseDate = before.preorderReleaseDate;

      const order = await Order.findOneAndUpdate(
        scopeQuery,
        {
          $set: {
            preorderStatus: PREORDER_ITEM_STATUS.DELAYED,
            preorderReleaseDate: releaseDate,
            preorderOriginalReleaseDate:
              before.preorderOriginalReleaseDate ||
              before.preorderReleaseDate ||
              releaseDate,
            preorderDelayReason: reason,
            preorderReleaseDateUpdatedAt: new Date(),
            preorderCustomerNotifiedAt: new Date(),
            statusChangedBy: session.user.id,
            "items.$[item].preorderReleaseDate": releaseDate,
            "items.$[item].preorderStatus": PREORDER_ITEM_STATUS.DELAYED,
            "subOrders.$[].items.$[subItem].preorderReleaseDate": releaseDate,
            "subOrders.$[].items.$[subItem].preorderStatus":
              PREORDER_ITEM_STATUS.DELAYED,
          },
        },
        {
          new: true,
          arrayFilters: [
            { "item.purchaseType": PURCHASE_TYPE.PREORDER },
            { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
          ],
        },
      );
      if (!order) return notFoundResponse("Pre-order");
      await notifyPreorderCustomerUpdate(
        String(order.customerId),
        order.orderNumber,
        "delayed",
        String(order._id),
        {
          releaseDate,
          previousReleaseDate,
          reason,
        },
      ).catch((err) =>
        console.error("Failed to notify preorder delay customer:", err),
      );
      return successResponse(order);
    }

    if (body.action === "cancel") {
      const canCancel =
        session.user.role === USER_ROLES.ADMIN ||
        !access.staffPermissions ||
        access.staffPermissions.includes(STAFF_PERMISSIONS.DELETE_ORDERS) ||
        access.staffPermissions.includes(STAFF_PERMISSIONS.MANAGE_ORDERS);
      if (!canCancel) {
        throw new AuthorizationError("You do not have permission to cancel orders");
      }

      const order = await Order.findOneAndUpdate(
        scopeQuery,
        {
          $set: {
            status: ORDER_STATUS.CANCELLED,
            preorderStatus: PREORDER_ITEM_STATUS.CANCELLED,
            cancelledAt: new Date(),
            statusChangedBy: session.user.id,
            "items.$[item].preorderStatus": PREORDER_ITEM_STATUS.CANCELLED,
            "subOrders.$[].status": ORDER_STATUS.CANCELLED,
            "subOrders.$[].items.$[subItem].preorderStatus":
              PREORDER_ITEM_STATUS.CANCELLED,
          },
        },
        {
          new: true,
          arrayFilters: [
            { "item.purchaseType": PURCHASE_TYPE.PREORDER },
            { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
          ],
        },
      );
      if (!order) return notFoundResponse("Pre-order");

      await releaseOrderPreorders(id).catch((err) =>
        console.error("Failed to release preorder quota:", err),
      );
      await reverseCouponUsageForOrder(id).catch((err) =>
        console.error("Failed to reverse coupon usage:", err),
      );
      await notifyPreorderCustomerUpdate(
        String(order.customerId),
        order.orderNumber,
        "cancelled",
        String(order._id),
        { releaseDate: order.preorderReleaseDate },
      ).catch((err) =>
        console.error("Failed to notify preorder cancellation customer:", err),
      );
      return successResponse(order);
    }

    throw new ValidationError("Unsupported preorder action");
  },
);
