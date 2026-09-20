import { connectDB } from "@/lib/db";
import { getSettings, Payout } from "@/models";
import type { IUser } from "@/types";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { paginatedResponse } from "@/lib/api/response";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { withApi } from "@/lib/api/handler";

export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_PAYOUTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError("You do not have permission to view payouts");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:payouts:list",
      "lenient",
      session.user.role,
    );

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const status = (searchParams.get("status") || "all").trim().toLowerCase();
    const search = (searchParams.get("search") || "").trim();
    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const query: Record<string, unknown> = { vendorId: vendor._id };
    if (status !== "all") query.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.payoutNumber = { $regex: escaped, $options: "i" };
    }

    const skip = (page - 1) * limit;
    const allowedSortFields = new Set([
      "createdAt",
      "payoutNumber",
      "status",
      "netAmount",
      "periodStart",
      "periodEnd",
    ]);
    const effectiveSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [effectiveSortBy]: sortDirection };
    const [rows, total] = await Promise.all([
      Payout.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Payout.countDocuments(query),
    ]);

    return paginatedResponse(rows as Record<string, unknown>[], page, limit, total);
  },
);
