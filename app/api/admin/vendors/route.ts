import { connectDB } from "@/lib/db";
import { User, Vendor } from "@/models";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { USER_ACCOUNT_STATUS, USER_ROLES, VENDOR_STATUS } from "@/config/app.config";
import {
  ALL_VENDOR_PERMISSIONS,
  DEFAULT_VENDOR_PERMISSIONS,
  type VendorPermission,
} from "@/config/permissions.config";
import { getSettings } from "@/models/settings.model";
import { validateQuery } from "@/lib/api/validate";
import { AdminListQuerySchema } from "@/lib/validations";
import { setUserRole } from "@/lib/user-role";
import { isStaffRole } from "@/lib/staff-role";
import {
  DEFAULT_VENDOR_SLUG,
  getExternalVendorFilter,
  syncDefaultVendorWithSettings,
} from "@/lib/multi-vendor";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";
import { withApi } from "@/lib/api/handler";

function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizeVendorPermissions(input: unknown): VendorPermission[] {
  if (!Array.isArray(input)) return [];
  const filtered = input.filter((p: unknown): p is VendorPermission =>
    typeof p === "string" && ALL_VENDOR_PERMISSIONS.includes(p as VendorPermission),
  );
  return Array.from(new Set(filtered));
}

/**
 * GET /api/admin/vendors
 * Get all vendors with search and filter
 */
export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:vendors:list", preset: "lenient" },
  },
  async ({ request, session }) => {
    const { page, limit, search, status, sortOrder } = validateQuery(
      request,
      AdminListQuerySchema,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    await syncDefaultVendorWithSettings(session.user.id, settings);

    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = getExternalVendorFilter();

    if (search) {
      query.$or = [
        { storeName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .populate("user", "name email image status")
        .sort({ createdAt: sortOrder === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(query),
    ]);

    return paginatedResponse(vendors, page, limit, total);
  },
);

/**
 * POST /api/admin/vendors
 * Create a vendor and attach it to a user account
 */
export const POST = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:vendors:create", preset: "moderate" },
  },
  async ({ request, session }) => {
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    await syncDefaultVendorWithSettings(session.user.id, settings);

    const body = await request.json();
    const storeName = String(body.storeName || "").trim();
    const ownerName = String(body.ownerName || "").trim();
    const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();
    const ownerPhone = String(body.ownerPhone || "").trim();

    if (!storeName) throw new ValidationError("Store name is required");
    if (!ownerName) throw new ValidationError("Owner name is required");
    if (!ownerEmail) throw new ValidationError("Owner email is required");

    const requestedSlug = String(body.slug || "").trim();
    const baseSlug = toSlug(requestedSlug || storeName);
    if (!baseSlug) throw new ValidationError("Invalid store slug");
    if (baseSlug === DEFAULT_VENDOR_SLUG) {
      throw new ValidationError("This store slug is reserved for the default store");
    }

    const existingUser = await User.findOne({ email: ownerEmail })
      .select("_id role roles")
      .lean();

    let userId: string;
    if (existingUser) {
      const existingRoles = Array.isArray(
        (existingUser as { roles?: unknown }).roles,
      )
        ? ((existingUser as { roles?: string[] }).roles || [])
        : [];
      if (
        existingUser.role === USER_ROLES.ADMIN ||
        isStaffRole(existingUser.role) ||
        existingRoles.includes(USER_ROLES.ADMIN) ||
        existingRoles.some(isStaffRole)
      ) {
        throw new ValidationError(`User already has ${existingUser.role} role`);
      }
      const existingVendor = await Vendor.findOne({ userId: existingUser._id })
        .select("_id")
        .lean();
      if (existingVendor) {
        throw new ValidationError("A vendor profile already exists for this user");
      }

      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            name: ownerName,
            phone: ownerPhone || undefined,
            status: body.userStatus || USER_ACCOUNT_STATUS.ACTIVE,
          },
        },
      );
      userId = String(existingUser._id);
    } else {
      const user = await User.create({
        name: ownerName,
        email: ownerEmail,
        phone: ownerPhone || undefined,
        role: USER_ROLES.CUSTOMER,
        roles: [USER_ROLES.CUSTOMER],
        status: body.userStatus || USER_ACCOUNT_STATUS.ACTIVE,
      });
      userId = String(user._id);
    }

    const slugExists = await Vendor.findOne({ slug: baseSlug }).select("_id").lean();
    const finalSlug = slugExists ? `${baseSlug}-${Date.now()}` : baseSlug;

    const requestedPermissions = sanitizeVendorPermissions(body.permissions);
    if (Array.isArray(body.permissions) && requestedPermissions.length === 0) {
      throw new ValidationError("Select at least one valid permission");
    }

    const status =
      body.status && Object.values(VENDOR_STATUS).includes(body.status)
        ? body.status
        : VENDOR_STATUS.PENDING;

    const vendor = await Vendor.create({
      userId,
      storeName,
      slug: finalSlug,
      description: body.description ? String(body.description).trim() : undefined,
      logo: body.logo ? String(body.logo).trim() : undefined,
      banner: body.banner ? String(body.banner).trim() : undefined,
      commission:
        typeof body.commission === "number"
          ? Math.max(0, Math.min(100, body.commission))
          : (settings.orders?.commission?.vendorRate ??
            DEFAULT_VENDOR_COMMISSION_RATE),
      permissions:
        requestedPermissions.length > 0
          ? requestedPermissions
          : DEFAULT_VENDOR_PERMISSIONS,
      status,
    });

    if (status === VENDOR_STATUS.APPROVED) {
      await setUserRole(userId, USER_ROLES.VENDOR);
    }

    const createdVendor = await Vendor.findById(vendor._id)
      .populate("user", "name email image phone status")
      .lean();

    if (status === VENDOR_STATUS.APPROVED) {
      revalidateProductContent();
    }

    return createdResponse(createdVendor);
  },
);
