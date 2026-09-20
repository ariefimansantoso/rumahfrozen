import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Brand } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { hasVendorPermission } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import {
  getRequestedBrandSlug,
  normalizeBrandSeo,
  BRAND_APPROVAL_STATUS,
} from "@/lib/brands";
import type { IUser } from "@/types";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/vendor/brands/[id]
 * Fetch a single brand for the vendor edit form. Gated behind VIEW_BRANDS.
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    const user = session.user as unknown as IUser;
    const canView = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_BRANDS,
    );
    if (!canView) {
      throw new AuthorizationError("You do not have permission to view brands");
    }

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return notFoundResponse("Invalid brand ID");
    }

    // Only the owning vendor can load their brand into the edit form.
    const brand = await Brand.findOne({
      _id: id,
      deletedAt: null,
      ownerVendorId: vendor._id,
    }).lean();
    if (!brand) return notFoundResponse("Brand");

    return successResponse(brand);
  },
);

/**
 * PUT /api/vendor/brands/[id]
 * Update a brand. Gated behind the EDIT_BRANDS vendor permission.
 */
export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const user = session.user as unknown as IUser;
    const canEdit = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_BRANDS,
    );
    if (!canEdit) {
      throw new AuthorizationError("You do not have permission to edit brands");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:brands:update",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    await requireApprovedVendorByUserId(session.user.id);

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return notFoundResponse("Invalid brand ID");
    }

    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const current = await Brand.findOne({ _id: id, deletedAt: null });
    if (!current) return notFoundResponse("Brand");

    // Owner-scoped: a vendor may only edit a brand they created. Platform
    // ("official") brands and other vendors' brands are off-limits.
    if (
      !current.ownerVendorId ||
      String(current.ownerVendorId) !== String(vendor._id)
    ) {
      throw new AuthorizationError("You can only edit brands you created");
    }

    const body = await request.json();

    const requestedSlug = getRequestedBrandSlug(body);
    if (requestedSlug) {
      const existing = await Brand.findOne({
        slug: requestedSlug,
        _id: { $ne: id },
      });
      if (existing) {
        throw new ValidationError("Brand URL handle is already in use");
      }
      body.slug = requestedSlug;
    }

    const seo = normalizeBrandSeo(body);

    // Vendors cannot set privileged/moderation fields directly.
    const update: Record<string, unknown> = {
      name: body.name ?? current.name,
      description: body.description,
      logo: body.logo,
      website: body.website,
      ...(requestedSlug ? { slug: requestedSlug } : {}),
      ...(seo ? { seo } : { seo: undefined }),
      ...(body.displayOrder !== undefined ? { order: body.displayOrder } : {}),
    };

    // Re-moderation: if an already-approved brand's name or logo changes, send
    // it back to the queue so the edit is reviewed before going live again.
    const nameChanged =
      typeof body.name === "string" && body.name.trim() !== current.name;
    const logoChanged =
      body.logo !== undefined && body.logo !== current.logo;
    if (
      current.approvalStatus === BRAND_APPROVAL_STATUS.APPROVED &&
      (nameChanged || logoChanged)
    ) {
      update.approvalStatus = BRAND_APPROVAL_STATUS.PENDING;
      update.isActive = false;
    }

    const brand = await Brand.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!brand) return notFoundResponse("Brand");

    return successResponse(brand);
  },
);
