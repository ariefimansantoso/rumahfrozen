import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { paginatedResponse } from "@/lib/api/response";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { sanitizeSearchString } from "@/lib/api/validate";
import { PURCHASE_TYPE } from "@/lib/preorders";
import { withApi } from "@/lib/api/handler";

export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
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
      "vendor:preorders:list",
      "lenient",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );
    const search = sanitizeSearchString(
      (searchParams.get("search") || "").trim(),
    );
    const status = (searchParams.get("status") || "all").trim();
    const view = (searchParams.get("view") || "all").trim();
    const skip = (page - 1) * limit;

    const elemMatch: Record<string, unknown> = { vendorId: vendor._id };
    if (status !== "all") {
      elemMatch.items = {
        $elemMatch: {
          purchaseType: PURCHASE_TYPE.PREORDER,
          preorderStatus: status,
        },
      };
    }
    const conditions: Record<string, unknown>[] = [
      { hasPreorder: true },
      { subOrders: { $elemMatch: elemMatch } },
    ];
    if (view === "overdue") {
      conditions.push({
        preorderStatus: "reserved",
        preorderReleaseDate: { $lt: new Date() },
      });
    }
    if (view === "due_soon") {
      const dueSoon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      conditions.push({
        preorderStatus: "reserved",
        preorderReleaseDate: { $gte: new Date(), $lte: dueSoon },
      });
    }
    if (search) {
      conditions.push({
        $or: [
          { orderNumber: { $regex: search, $options: "i" } },
          { "items.name": { $regex: search, $options: "i" } },
        ],
      });
    }

    const query = { $and: conditions };
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customerId", "name email")
        .sort({ preorderReleaseDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const vendorOrders = orders.map((order) => ({
      ...order,
      subOrders: order.subOrders.filter(
        (sub: { vendorId?: { toString: () => string } }) =>
          sub.vendorId?.toString() === vendor._id.toString(),
      ),
    }));

    return paginatedResponse(vendorOrders, page, limit, total);
  },
);
