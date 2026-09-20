import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { connectDB } from "@/lib/db";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { Coupon } from "@/models";
import { getSettings } from "@/models/settings.model";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { paginatedResponse, successResponse } from "@/lib/api/response";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { AdminListQuerySchema, CreateCouponSchema } from "@/lib/validations";
import { auditCreate, createAuditContext } from "@/lib/audit";
import type { IUser } from "@/types";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/vendor/coupons
 * Get coupons for the current vendor.
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_DISCOUNTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to view discounts",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:coupons:list",
      "lenient",
      session.user.role,
    );

    const { page, limit, search, status } = validateQuery(
      request,
      AdminListQuerySchema,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = { vendorId: vendor._id };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { label: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Coupon.countDocuments(query),
    ]);

    return paginatedResponse(coupons, page, limit, total);
  },
);

/**
 * POST /api/vendor/coupons
 * Create a coupon for the current vendor.
 */
export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.CREATE_DISCOUNTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to create discounts",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:coupons:create",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const body = await validateBody(request, CreateCouponSchema);
    const code =
      typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) throw new ValidationError({ code: ["Coupon code is required"] });

    const existing = await Coupon.findOne({ code });
    if (existing) {
      throw new ValidationError({ code: ["This coupon code already exists"] });
    }

    const perUserLimit =
      typeof (body as { perUserLimit?: unknown }).perUserLimit === "number"
        ? (body as { perUserLimit: number }).perUserLimit
        : typeof (body as { userLimit?: unknown }).userLimit === "number"
          ? (body as { userLimit: number }).userLimit
          : undefined;

    const payload = Object.fromEntries(
      Object.entries(body as unknown as Record<string, unknown>).filter(
        ([key]) => key !== "userLimit" && key !== "excludedCategories",
      ),
    );
    if (payload.type === "free_shipping") {
      payload.value = 0;
    }

    const coupon = await Coupon.create({
      ...payload,
      code,
      vendorId: vendor._id,
      perUserLimit,
      createdBy: session.user.id,
    });

    const auditContext = createAuditContext(request, session);
    await auditCreate(
      auditContext,
      "coupon",
      String(coupon._id),
      coupon.toObject() as unknown as Record<string, unknown>,
    );

    return successResponse(coupon, "Coupon created successfully", 201);
  },
);
