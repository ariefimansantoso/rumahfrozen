import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { connectDB } from "@/lib/db";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { Coupon } from "@/models";
import { getSettings } from "@/models/settings.model";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody, isValidObjectId } from "@/lib/api/validate";
import { UpdateCouponSchema } from "@/lib/validations";
import { auditDelete, auditUpdate, createAuditContext } from "@/lib/audit";
import type { IUser } from "@/types";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/vendor/coupons/[id]
 * Get a single vendor coupon.
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
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
      "vendor:coupons:read",
      "lenient",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Coupon");

    const coupon = await Coupon.findOne({ _id: id, vendorId: vendor._id }).lean();
    if (!coupon) return notFoundResponse("Coupon");

    return successResponse(coupon);
  },
);

/**
 * PUT /api/vendor/coupons/[id]
 * Update a vendor coupon.
 */
export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_DISCOUNTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to edit discounts",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:coupons:update",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Coupon");

    const body = await validateBody(request, UpdateCouponSchema);
    const mutableBody = body as Record<string, unknown> & {
      userLimit?: unknown;
      perUserLimit?: unknown;
    };

    delete mutableBody.code;
    delete mutableBody.createdBy;
    delete mutableBody.usedCount;
    delete mutableBody.vendorId;
    delete mutableBody.excludedCategories;

    if (
      typeof mutableBody.perUserLimit !== "number" &&
      typeof mutableBody.userLimit === "number"
    ) {
      mutableBody.perUserLimit = mutableBody.userLimit;
    }
    delete mutableBody.userLimit;

    if (mutableBody.type === "free_shipping") {
      mutableBody.value = 0;
    }

    const before = await Coupon.findOne({ _id: id, vendorId: vendor._id }).lean();
    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, vendorId: vendor._id },
      { $set: mutableBody },
      { new: true, runValidators: true },
    ).lean();

    if (!coupon) return notFoundResponse("Coupon");

    const auditContext = createAuditContext(request, session);
    await auditUpdate(
      auditContext,
      "coupon",
      id,
      (before || {}) as unknown as Record<string, unknown>,
      coupon as unknown as Record<string, unknown>,
    );

    return successResponse(coupon);
  },
);

/**
 * DELETE /api/vendor/coupons/[id]
 * Delete a vendor coupon.
 */
export const DELETE = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.DELETE_DISCOUNTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to delete discounts",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:coupons:delete",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Coupon");

    const before = await Coupon.findOne({ _id: id, vendorId: vendor._id }).lean();
    const coupon = await Coupon.findOneAndDelete({
      _id: id,
      vendorId: vendor._id,
    });

    if (!coupon) return notFoundResponse("Coupon");

    const auditContext = createAuditContext(request, session);
    await auditDelete(
      auditContext,
      "coupon",
      id,
      (before || coupon.toObject()) as unknown as Record<string, unknown>,
    );

    return successResponse({ message: "Coupon deleted successfully" });
  },
);
