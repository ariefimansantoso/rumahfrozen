import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { ORDER_STATUS } from "@/config/app.config";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getSettings } from "@/models/settings.model";
import { isValidObjectId } from "@/lib/api/validate";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import {
  PREORDER_ITEM_STATUS,
  PURCHASE_TYPE,
  releaseSubOrderPreorders,
} from "@/lib/preorders";
import { reverseCouponUsageForOrder } from "@/lib/coupons";
import { notifyPreorderCustomerUpdate } from "@/lib/notifications";
import { withApi } from "@/lib/api/handler";

export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const user = session.user as unknown as IUser;
    const canEdit = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_ORDERS,
    );
    const canManage = canEdit
      ? true
      : await hasVendorPermission(user, VENDOR_PERMISSIONS.MANAGE_ORDERS);
    if (!canEdit && !canManage && !isAdmin(user)) {
      throw new AuthorizationError("You do not have permission to edit orders");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:preorders:update",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Pre-order");

    const body = (await request.json().catch(() => ({}))) as {
      action?: "ready" | "cancel";
    };

    const order = await Order.findOne({
      _id: id,
      hasPreorder: true,
      "subOrders.vendorId": vendor._id,
    });
    if (!order) return notFoundResponse("Pre-order");

    const subOrder = order.subOrders.find(
      (sub: { vendorId?: { toString: () => string } }) =>
        sub.vendorId?.toString() === vendor._id.toString(),
    );
    if (!subOrder) return notFoundResponse("Pre-order");

    if (body.action === "ready") {
      subOrder.status = ORDER_STATUS.PROCESSING;
      const outstandingAmount = Number(order.preorderOutstandingAmount || 0);
      const nextPreorderStatus =
        outstandingAmount > 0
          ? PREORDER_ITEM_STATUS.PAYMENT_DUE
          : PREORDER_ITEM_STATUS.READY;
      subOrder.items.forEach(
        (item: { purchaseType?: string; preorderStatus?: string }) => {
          if (item.purchaseType === PURCHASE_TYPE.PREORDER) {
            item.preorderStatus = nextPreorderStatus;
          }
        },
      );

      const statuses: string[] = order.subOrders.map(
        (sub: { status: string }) => sub.status,
      );
      if (statuses.every((status) => status === ORDER_STATUS.PROCESSING)) {
        order.status =
          outstandingAmount > 0 ? ORDER_STATUS.PREORDERED : ORDER_STATUS.PROCESSING;
        order.preorderStatus = nextPreorderStatus;
        order.items.forEach(
          (item: { purchaseType?: string; preorderStatus?: string }) => {
            if (item.purchaseType === PURCHASE_TYPE.PREORDER) {
              item.preorderStatus = nextPreorderStatus;
            }
          },
        );
      } else {
        order.preorderStatus = PREORDER_ITEM_STATUS.PARTIALLY_READY;
      }
      await order.save();
      await notifyPreorderCustomerUpdate(
        String(order.customerId),
        order.orderNumber,
        order.preorderStatus === PREORDER_ITEM_STATUS.PARTIALLY_READY
          ? "partially_ready"
          : outstandingAmount > 0
            ? "payment_due"
            : "ready",
        String(order._id),
        {
          releaseDate: order.preorderReleaseDate,
          outstandingAmount,
        },
      ).catch((err) =>
        console.error("Failed to notify preorder ready customer:", err),
      );
      return successResponse(order);
    }

    if (body.action === "cancel") {
      const canDelete = await hasVendorPermission(
        user,
        VENDOR_PERMISSIONS.DELETE_ORDERS,
      );
      if (!canDelete && !canManage && !isAdmin(user)) {
        throw new AuthorizationError("You do not have permission to cancel orders");
      }

      subOrder.status = ORDER_STATUS.CANCELLED;
      subOrder.items.forEach(
        (item: { purchaseType?: string; preorderStatus?: string }) => {
          if (item.purchaseType === PURCHASE_TYPE.PREORDER) {
            item.preorderStatus = PREORDER_ITEM_STATUS.CANCELLED;
          }
        },
      );

      const statuses: string[] = order.subOrders.map(
        (sub: { status: string }) => sub.status,
      );
      if (statuses.every((status) => status === ORDER_STATUS.CANCELLED)) {
        order.status = ORDER_STATUS.CANCELLED;
        order.preorderStatus = PREORDER_ITEM_STATUS.CANCELLED;
        order.cancelledAt = new Date();
        order.items.forEach(
          (item: { purchaseType?: string; preorderStatus?: string }) => {
            if (item.purchaseType === PURCHASE_TYPE.PREORDER) {
              item.preorderStatus = PREORDER_ITEM_STATUS.CANCELLED;
            }
          },
        );
      }
      await order.save();

      await releaseSubOrderPreorders({
        orderId: String(order._id),
        vendorId: String(vendor._id),
      }).catch((err) =>
        console.error("Failed to release vendor preorder quota:", err),
      );
      if (order.status === ORDER_STATUS.CANCELLED) {
        await reverseCouponUsageForOrder(String(order._id)).catch((err) =>
          console.error("Failed to reverse coupon usage:", err),
        );
      }
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
