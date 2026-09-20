import { Product, User, Vendor } from "@/models";
import { connectDB } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { requestEmailVerification } from "@/lib/auth";
import { defaultLocale } from "@/config/i18n.config";
import { USER_ACCOUNT_STATUS, USER_ROLES, VENDOR_STATUS } from "@/config/app.config";
import {
  ALL_VENDOR_PERMISSIONS,
  type VendorPermission,
} from "@/config/permissions.config";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { setUserRole } from "@/lib/user-role";
import { isStaffRole } from "@/lib/staff-role";
import { getSettings } from "@/models/settings.model";
import { isValidObjectId } from "@/lib/api/validate";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import {
  DEFAULT_VENDOR_SLUG,
  isDefaultVendorRecord,
  syncDefaultVendorWithSettings,
} from "@/lib/multi-vendor";
import {
  createAuditContext,
  auditDelete,
  auditVendorDecision,
  auditUpdate,
} from "@/lib/audit";
import { sendVendorApprovedEmail } from "@/lib/vendor-emails";
import { notifyVendorApplicationStatus } from "@/lib/notifications";
import { normalizeNotificationSettings } from "@/lib/notification-settings";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { withApi } from "@/lib/api/handler";

function sanitizeVendorPermissions(input: unknown): VendorPermission[] {
  if (!Array.isArray(input)) return [];
  const filtered = input.filter((p: unknown): p is VendorPermission =>
    typeof p === "string" && ALL_VENDOR_PERMISSIONS.includes(p as VendorPermission),
  );
  return Array.from(new Set(filtered));
}

async function assertCanChangeVendorOwnerRole(userId: unknown) {
  const owner = await User.findById(userId).select("role roles").lean();
  const roles = Array.isArray((owner as { roles?: unknown } | null)?.roles)
    ? ((owner as { roles?: string[] }).roles || [])
    : [];
  const role = (owner as { role?: string } | null)?.role;

  if (
    role === USER_ROLES.ADMIN ||
    isStaffRole(role) ||
    roles.includes(USER_ROLES.ADMIN) ||
    roles.some(isStaffRole)
  ) {
    throw new ValidationError(
      "Admin and staff accounts cannot be converted through vendor updates",
    );
  }
}

/**
 * GET /api/admin/vendors/[id]
 * Get single vendor
 */
export const GET = withApi<{ id: string }>(
  { auth: "admin" },
  async ({ params, session }) => {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return notFoundResponse("Vendor");
    }

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    await syncDefaultVendorWithSettings(session.user.id, settings);

    const vendor = await Vendor.findById(id)
      .populate("user", "name email image phone status")
      .lean();

    if (!vendor) {
      return notFoundResponse("Vendor");
    }
    if (isDefaultVendorRecord(vendor)) {
      return notFoundResponse("Vendor");
    }

    return successResponse(vendor);
  },
);

/**
 * PUT /api/admin/vendors/[id]
 * Update vendor status or details
 */
export const PUT = withApi<{ id: string }>(
  { auth: "admin" },
  async ({ request, params, session }) => {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return notFoundResponse("Vendor");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "admin:vendors:update",
      "moderate",
      session.user.role,
    );

    const body = await request.json();

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    await syncDefaultVendorWithSettings(session.user.id, settings);

    const vendorBefore = await Vendor.findById(id)
      .populate("user", "name email status")
      .lean();

    if (!vendorBefore) {
      return notFoundResponse("Vendor");
    }
    if (isDefaultVendorRecord(vendorBefore)) {
      throw new ValidationError(
        "The default store vendor is managed from General Settings",
      );
    }

    const updates: Record<string, unknown> = {};
    const unsetFields: Record<string, "" | 1> = {};
    const userUpdates: Record<string, unknown> = {};

    if (body.status && Object.values(VENDOR_STATUS).includes(body.status)) {
      updates.status = body.status;
    }

    if (body.commission !== undefined) {
      updates.commission = body.commission;
    }

    if (body.permissions !== undefined) {
      const sanitizedPermissions = sanitizeVendorPermissions(body.permissions);
      if (sanitizedPermissions.length === 0) {
        throw new ValidationError("Select at least one valid permission");
      }
      updates.permissions = sanitizedPermissions;
    }

    if (body.storeName !== undefined && String(body.storeName).trim()) {
      updates.storeName = String(body.storeName).trim();
    }

    if (body.description !== undefined) {
      updates.description = String(body.description || "").trim() || undefined;
    }

    if (body.logo !== undefined) {
      const normalizedLogo = String(body.logo || "").trim();
      if (normalizedLogo) {
        updates.logo = normalizedLogo;
      } else {
        unsetFields.logo = "";
      }
    }

    if (body.banner !== undefined) {
      const normalizedBanner = String(body.banner || "").trim();
      if (normalizedBanner) {
        updates.banner = normalizedBanner;
      } else {
        unsetFields.banner = "";
      }
    }

    if (body.slug !== undefined && String(body.slug).trim()) {
      const slug = String(body.slug)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      if (!slug) throw new ValidationError("Invalid store slug");
      if (slug === DEFAULT_VENDOR_SLUG) {
        throw new ValidationError("This store slug is reserved for the default store");
      }

      const existingSlug = await Vendor.findOne({ slug, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (existingSlug) {
        throw new ValidationError("Store slug already exists");
      }

      updates.slug = slug;
    }

    if (body.ownerName !== undefined && String(body.ownerName).trim()) {
      userUpdates.name = String(body.ownerName).trim();
    }

    if (body.ownerPhone !== undefined) {
      userUpdates.phone = String(body.ownerPhone || "").trim() || undefined;
    }

    if (body.ownerEmail !== undefined) {
      const normalizedEmail = String(body.ownerEmail).trim().toLowerCase();
      if (!normalizedEmail) throw new ValidationError("Owner email is required");

      const existingEmailUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: vendorBefore.userId },
      })
        .select("_id")
        .lean();

      if (existingEmailUser) {
        throw new ValidationError("Another user already uses this email");
      }

      userUpdates.email = normalizedEmail;
    }

    if (
      body.userStatus &&
      Object.values(USER_ACCOUNT_STATUS).includes(body.userStatus)
    ) {
      userUpdates.status = body.userStatus;
    }

    if (body.status && body.status !== vendorBefore.status && vendorBefore.userId) {
      await assertCanChangeVendorOwnerRole(vendorBefore.userId);
    }

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      {
        $set: updates,
        ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
      },
      { new: true },
    ).populate("user", "name email status emailVerified");

    if (!vendor) {
      return notFoundResponse("Vendor");
    }

    if (body.status && body.status !== vendorBefore.status && vendor.userId) {
      if (body.status === VENDOR_STATUS.APPROVED) {
        await setUserRole(vendor.userId.toString(), USER_ROLES.VENDOR);
        if (settings.security?.emailVerificationForVendors) {
          userUpdates.emailVerificationRequiredAt = new Date();
        }
        if (!body.userStatus) {
          userUpdates.status = USER_ACCOUNT_STATUS.ACTIVE;
        }
      } else if (
        body.status === VENDOR_STATUS.REJECTED ||
        body.status === VENDOR_STATUS.SUSPENDED
      ) {
        await setUserRole(vendor.userId.toString(), USER_ROLES.CUSTOMER);
        if (!body.userStatus) {
          userUpdates.status = USER_ACCOUNT_STATUS.ACTIVE;
        }
      }
    }

    if (Object.keys(userUpdates).length > 0 && vendor.userId) {
      await User.updateOne({ _id: vendor.userId }, { $set: userUpdates });
    }

    if (
      body.status === VENDOR_STATUS.APPROVED &&
      body.status !== vendorBefore.status &&
      vendor.userId
    ) {
      const notificationSettings = normalizeNotificationSettings(
        settings.notifications,
      );
      const vendorApplicationChannels =
        notificationSettings.vendor.applicationStatus;
      const vendorUser = vendor.user as {
        name?: string;
        email?: string;
        emailVerified?: boolean;
      } | null;
      const vendorEmail = String(userUpdates.email || vendorUser?.email || "");
      if (
        settings.security?.emailVerificationForVendors &&
        vendorEmail &&
        !vendorUser?.emailVerified
      ) {
        await requestEmailVerification(
          vendorEmail,
          `/${defaultLocale}/email-verified`,
        ).catch(
          (error) => {
            console.error("Failed to request vendor email verification:", error);
          },
        );
      }
      if (vendorApplicationChannels.email && vendorEmail) {
        await sendVendorApprovedEmail({
          vendorEmail,
          vendorName: String(userUpdates.name || vendorUser?.name || ""),
          storeName: vendor.storeName,
          settings,
        });
      }
      await notifyVendorApplicationStatus(
        vendor.userId.toString(),
        VENDOR_STATUS.APPROVED,
        { settings, channels: vendorApplicationChannels },
      );
    }

    const auditContext = createAuditContext(request, session);

    if (body.status && body.status !== vendorBefore.status) {
      const decision = body.status as "approved" | "rejected" | "suspended";
      await auditVendorDecision(auditContext, id, decision, vendorBefore.storeName);
    } else if (body.commission !== undefined && body.commission !== vendorBefore.commission) {
      await auditUpdate(
        auditContext,
        "vendor",
        id,
        { commission: vendorBefore.commission },
        { commission: body.commission },
        vendorBefore.storeName,
      );
    }

    revalidateProductContent();

    return successResponse(vendor);
  },
);

/**
 * DELETE /api/admin/vendors/[id]
 * Delete vendor and revert user role
 */
export const DELETE = withApi<{ id: string }>(
  {
    auth: "admin",
    rateLimit: { action: "admin:vendors:delete", preset: "strict" },
  },
  async ({ request, params, session }) => {
    const { id } = params;
    if (!isValidObjectId(id)) {
      return notFoundResponse("Vendor");
    }

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    await syncDefaultVendorWithSettings(session.user.id, settings);

    const vendor = await Vendor.findById(id)
      .populate("user", "name email")
      .lean();

    if (!vendor) {
      return notFoundResponse("Vendor");
    }
    if (isDefaultVendorRecord(vendor)) {
      throw new ValidationError(
        "The default store vendor is managed from General Settings",
      );
    }

    const productCount = await Product.countDocuments({ vendorId: id });
    if (productCount > 0) {
      throw new ValidationError(
        "Cannot delete vendor with existing products. Reassign or delete products first.",
      );
    }

    if (vendor.userId) {
      await assertCanChangeVendorOwnerRole(vendor.userId);
    }

    await Vendor.deleteOne({ _id: id });

    if (vendor.userId) {
      await setUserRole(String(vendor.userId), USER_ROLES.CUSTOMER);
      await User.updateOne(
        { _id: vendor.userId },
        { $set: { status: USER_ACCOUNT_STATUS.ACTIVE } },
      );
    }

    const auditContext = createAuditContext(request, session);
    await auditDelete(
      auditContext,
      "vendor",
      id,
      { storeName: vendor.storeName, userId: String(vendor.userId || "") },
      vendor.storeName,
    );

    revalidateProductContent();

    return successResponse({ message: "Vendor deleted successfully" });
  },
);
