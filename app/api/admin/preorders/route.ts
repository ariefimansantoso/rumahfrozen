import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { paginatedResponse, successResponse } from "@/lib/api/response";
import { AuthorizationError, ValidationError } from "@/lib/api/errors";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffOrderScopeFilter,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import { ORDER_STATUS, USER_ROLES } from "@/config/app.config";
import {
  PREORDER_ITEM_STATUS,
  PURCHASE_TYPE,
  releaseOrderPreorders,
} from "@/lib/preorders";
import { reverseCouponUsageForOrder } from "@/lib/coupons";
import { notifyPreorderCustomerUpdate } from "@/lib/notifications";
import { withApi } from "@/lib/api/handler";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(orders: Array<Record<string, unknown>>) {
  const headers = [
    "Order",
    "Customer",
    "Email",
    "Preorder status",
    "Fulfillment status",
    "Payment status",
    "Expected release",
    "Total",
    "Created",
  ];
  const rows = orders.map((order) => {
    const customer = order.customerId as
      | { name?: string; email?: string }
      | undefined;
    return [
      order.orderNumber,
      customer?.name || "Customer",
      customer?.email || "",
      order.preorderStatus,
      order.status,
      order.paymentStatus,
      order.preorderReleaseDate
        ? new Date(String(order.preorderReleaseDate)).toISOString()
        : "",
      order.total,
      order.createdAt ? new Date(String(order.createdAt)).toISOString() : "",
    ].map(escapeCsv).join(",");
  });
  return [headers.map(escapeCsv).join(","), ...rows].join("\n");
}

export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:preorders:list",
      "lenient",
      session.user.role,
    );

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "all").trim();
    const view = (searchParams.get("view") || "all").trim();
    const format = (searchParams.get("format") || "").trim();
    const skip = (page - 1) * limit;

    const conditions: Record<string, unknown>[] = [{ hasPreorder: true }];
    if (status !== "all") conditions.push({ preorderStatus: status });
    if (view === "overdue") {
      conditions.push({
        preorderStatus: PREORDER_ITEM_STATUS.RESERVED,
        preorderReleaseDate: { $lt: new Date() },
      });
    }
    if (view === "due_soon") {
      const dueSoon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      conditions.push({
        preorderStatus: PREORDER_ITEM_STATUS.RESERVED,
        preorderReleaseDate: { $gte: new Date(), $lte: dueSoon },
      });
    }
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      conditions.push({
        $or: [
          { orderNumber: { $regex: escapedSearch, $options: "i" } },
          { "items.name": { $regex: escapedSearch, $options: "i" } },
        ],
      });
    }

    const baseQuery = { $and: conditions };
    const query = mergeScopeFilter(
      baseQuery,
      buildStaffOrderScopeFilter(access.staffScope),
    );

    if (format === "csv") {
      const orders = await Order.find(query)
        .populate("customerId", "name email")
        .sort({ preorderReleaseDate: 1, createdAt: -1 })
        .limit(5000)
        .lean();
      return new NextResponse(buildCsv(orders as Array<Record<string, unknown>>), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="preorders-${new Date()
            .toISOString()
            .slice(0, 10)}.csv"`,
        },
      });
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customerId", "name email")
        .sort({ preorderReleaseDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return paginatedResponse(orders, page, limit, total);
  },
);

export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.EDIT_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:preorders:bulk",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const body = (await request.json().catch(() => ({}))) as {
      action?: "ready" | "payment_due" | "cancel" | "delay";
      ids?: string[];
      releaseDate?: string;
      reason?: string;
    };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id)).slice(0, 100)
      : [];
    if (!body.action || ids.length === 0) {
      throw new ValidationError("Select pre-orders and a bulk action");
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
    }

    const scopeQuery = mergeScopeFilter(
      { _id: { $in: ids }, hasPreorder: true },
      buildStaffOrderScopeFilter(access.staffScope),
    );
    const orders = await Order.find(scopeQuery).lean();
    const matchedIds = orders.map((order) => order._id);
    if (matchedIds.length === 0) {
      return successResponse({ matched: 0, modified: 0 });
    }

    if (body.action === "ready" || body.action === "payment_due") {
      const paymentDueOrders = orders.filter(
        (order) =>
          body.action === "payment_due" ||
          Number(order.preorderOutstandingAmount || 0) > 0,
      );
      const readyOrders = orders.filter(
        (order) =>
          body.action === "ready" &&
          Number(order.preorderOutstandingAmount || 0) <= 0,
      );
      const paymentDueIds = paymentDueOrders.map((order) => order._id);
      const readyIds = readyOrders.map((order) => order._id);

      if (readyIds.length > 0) {
        await Order.updateMany(
          { _id: { $in: readyIds } },
          {
            $set: {
              status: ORDER_STATUS.PROCESSING,
              preorderStatus: PREORDER_ITEM_STATUS.READY,
              statusChangedBy: session.user.id,
              processingAt: new Date(),
              "items.$[item].preorderStatus": PREORDER_ITEM_STATUS.READY,
              "subOrders.$[].status": ORDER_STATUS.PROCESSING,
              "subOrders.$[].items.$[subItem].preorderStatus":
                PREORDER_ITEM_STATUS.READY,
            },
          },
          {
            arrayFilters: [
              { "item.purchaseType": PURCHASE_TYPE.PREORDER },
              { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
            ],
          },
        );
      }

      if (paymentDueIds.length > 0) {
        await Order.updateMany(
          { _id: { $in: paymentDueIds } },
          {
            $set: {
              status: ORDER_STATUS.PREORDERED,
              preorderStatus: PREORDER_ITEM_STATUS.PAYMENT_DUE,
              statusChangedBy: session.user.id,
              "items.$[item].preorderStatus": PREORDER_ITEM_STATUS.PAYMENT_DUE,
              "subOrders.$[].status": ORDER_STATUS.PREORDERED,
              "subOrders.$[].items.$[subItem].preorderStatus":
                PREORDER_ITEM_STATUS.PAYMENT_DUE,
            },
          },
          {
            arrayFilters: [
              { "item.purchaseType": PURCHASE_TYPE.PREORDER },
              { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
            ],
          },
        );
      }

      await Promise.allSettled(
        orders.map((order) =>
          notifyPreorderCustomerUpdate(
            String(order.customerId),
            order.orderNumber,
            paymentDueOrders.some(
              (paymentDueOrder) =>
                String(paymentDueOrder._id) === String(order._id),
            )
              ? "payment_due"
              : "ready",
            String(order._id),
            {
              releaseDate: order.preorderReleaseDate,
              outstandingAmount: Number(order.preorderOutstandingAmount || 0),
            },
          ),
        ),
      );
      return successResponse({ matched: matchedIds.length, modified: matchedIds.length });
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
      await Order.updateMany(
        { _id: { $in: matchedIds } },
        {
          $set: {
            preorderStatus: PREORDER_ITEM_STATUS.DELAYED,
            preorderReleaseDate: releaseDate,
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
          arrayFilters: [
            { "item.purchaseType": PURCHASE_TYPE.PREORDER },
            { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
          ],
        },
      );
      await Promise.allSettled(
        orders.map((order) =>
          notifyPreorderCustomerUpdate(
            String(order.customerId),
            order.orderNumber,
            "delayed",
            String(order._id),
            {
              releaseDate,
              previousReleaseDate: order.preorderReleaseDate,
              reason,
            },
          ),
        ),
      );
      return successResponse({ matched: matchedIds.length, modified: matchedIds.length });
    }

    if (body.action === "cancel") {
      await Order.updateMany(
        { _id: { $in: matchedIds } },
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
          arrayFilters: [
            { "item.purchaseType": PURCHASE_TYPE.PREORDER },
            { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
          ],
        },
      );
      await Promise.allSettled(
        orders.map(async (order) => {
          await releaseOrderPreorders(String(order._id));
          await reverseCouponUsageForOrder(String(order._id));
          await notifyPreorderCustomerUpdate(
            String(order.customerId),
            order.orderNumber,
            "cancelled",
            String(order._id),
            { releaseDate: order.preorderReleaseDate },
          );
        }),
      );
      return successResponse({ matched: matchedIds.length, modified: matchedIds.length });
    }

    throw new ValidationError("Unsupported preorder action");
  },
);
