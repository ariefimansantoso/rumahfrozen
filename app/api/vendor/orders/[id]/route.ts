import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { z } from "zod";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { PAYMENT_STATUS } from "@/config/app.config";
import type { IUser } from "@/types";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { isValidObjectId, validateBody } from "@/lib/api/validate";
import { UpdateOrderStatusSchema } from "@/lib/validations";
import { auditUpdate, createAuditContext } from "@/lib/audit";
import { restoreSubOrderInventory } from "@/lib/order-inventory";
import { releaseSubOrderPreorders } from "@/lib/preorders";
import { getOrderStatusActionByTarget } from "@/lib/order-status-workflow";
import { reverseCouponUsageForOrder } from "@/lib/coupons";
import { notifyOrderStatus } from "@/lib/notifications";
import { withApi } from "@/lib/api/handler";

const VendorUpdateOrderSchema = UpdateOrderStatusSchema.partial()
  .extend({
    paymentStatus: z.literal(PAYMENT_STATUS.PAID).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.trackingNumber !== undefined ||
      value.paymentStatus !== undefined,
    { message: "No updates provided" },
  );

/**
 * GET /api/vendor/orders/[id]
 * Get a single order by ID (vendor's sub-order only)
 * Requires: VIEW_ORDERS permission
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    // Check RBAC permission
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_ORDERS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError("You do not have permission to view orders");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:orders:read",
      "lenient",
      session.user.role
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Order");
    const order = await Order.findOne({
      _id: id,
      "subOrders.vendorId": vendor._id,
    })
      .populate("customerId", "name email phone")
      .lean();

    if (!order) {
      return notFoundResponse("Order");
    }

    // Filter to only vendor's sub-order
    const vendorOrder = {
      ...order,
      subOrders: order.subOrders.filter(
        (sub: { vendorId?: { toString: () => string } }) =>
          sub.vendorId?.toString() === vendor._id.toString(),
      ),
    };

    return successResponse(vendorOrder);
  },
);

/**
 * PUT /api/vendor/orders/[id]
 * Update vendor's sub-order status (e.g., shipped, delivered)
 * Requires: EDIT_ORDERS permission
 */
export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    // Check RBAC permission
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_ORDERS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to edit orders",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:orders:update",
      "moderate",
      session.user.role
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Order");

    const { status, trackingNumber, paymentStatus } = await validateBody(
      request,
      VendorUpdateOrderSchema,
    );
    if (status === "cancelled") {
      const hasDeletePermission = await hasVendorPermission(
        user,
        VENDOR_PERMISSIONS.DELETE_ORDERS,
      );
      if (!hasDeletePermission && !isAdmin(user)) {
        throw new AuthorizationError(
          "You do not have permission to cancel orders",
        );
      }
    }

    const order = await Order.findOne({
      _id: id,
      "subOrders.vendorId": vendor._id,
    });

    if (!order) {
      return notFoundResponse("Order");
    }

    // Find and update vendor's sub-order
    const subOrderIndex = order.subOrders.findIndex(
      (sub: { vendorId?: { toString: () => string } }) =>
        sub.vendorId?.toString() === vendor._id.toString(),
    );

    if (subOrderIndex === -1) {
      return notFoundResponse("Sub-order");
    }

    const before = order.toObject() as unknown as Record<string, unknown>;
    const currentSubStatus = order.subOrders[subOrderIndex].status as string;

    if (paymentStatus === PAYMENT_STATUS.PAID) {
      if (
        order.paymentStatus !== PAYMENT_STATUS.PENDING &&
        order.paymentStatus !== PAYMENT_STATUS.PARTIALLY_PAID
      ) {
        throw new ValidationError("Only unpaid orders can be marked as paid");
      }
      order.paymentStatus = PAYMENT_STATUS.PAID;
    }

    if (status) {
      // Validate sub-order status transition
      const transition = getOrderStatusActionByTarget(currentSubStatus, status);
      if (!transition) {
        throw new ValidationError(
          `Cannot transition sub-order from "${currentSubStatus}" to "${status}"`
        );
      }

      order.subOrders[subOrderIndex].status = status;

      if (status === "shipped") {
        order.subOrders[subOrderIndex].shippedAt = new Date();
        if (trackingNumber) {
          order.subOrders[subOrderIndex].trackingNumber = trackingNumber;
        }
      }

      if (status === "delivered") {
        order.subOrders[subOrderIndex].deliveredAt = new Date();
      }

      // Restore inventory for vendor's items when sub-order is cancelled.
      // The helper claims the restore atomically, so a sub-order that was
      // never reserved (abandoned pending order) is a no-op; one that has
      // already been restored cannot be restored a second time.
      if (status === "cancelled" && currentSubStatus !== "cancelled") {
        await restoreSubOrderInventory({
          orderId: String(order._id),
          vendorId: String(vendor._id),
        }).catch((err) =>
          console.error(
            "Failed to restore inventory on vendor sub-order cancel:",
            err,
          ),
        );
        await releaseSubOrderPreorders({
          orderId: String(order._id),
          vendorId: String(vendor._id),
        }).catch((err) =>
          console.error(
            "Failed to release preorder quota on vendor sub-order cancel:",
            err,
          ),
        );
      }
    }

    // Check if all sub-orders have the same status to update overall order
    const allStatuses = order.subOrders.map(
      (sub: { status: string }) => sub.status,
    );
    const uniqueStatuses = [...new Set(allStatuses)];

    if (uniqueStatuses.length === 1) {
      order.status = uniqueStatuses[0];
    } else if (
      allStatuses.every((s: string) => s === "delivered" || s === "cancelled")
    ) {
      order.status = "delivered";
    } else if (allStatuses.some((s: string) => s === "shipped")) {
      order.status = "processing";
    }

    const previousOverallStatus = (before as { status?: string })?.status;
    await order.save();

    if (status && order.customerId) {
      await notifyOrderStatus(
        String(order.customerId),
        order.orderNumber,
        status,
        String(order._id),
      ).catch((err) =>
        console.error("Failed to create vendor order status notification:", err),
      );
    }

    if (
      order.status === "cancelled" &&
      previousOverallStatus !== "cancelled"
    ) {
      await reverseCouponUsageForOrder(String(order._id)).catch((err) =>
        console.error("Failed to reverse coupon usage on vendor cancel:", err),
      );
    }

    const auditContext = createAuditContext(request, session);
    await auditUpdate(
      auditContext,
      "order",
      id,
      before,
      order.toObject() as unknown as Record<string, unknown>,
    );

    return successResponse(order);
  },
);
