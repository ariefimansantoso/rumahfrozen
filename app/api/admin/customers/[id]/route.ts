import { connectDB } from "@/lib/db";
import { CustomerProfile, Order, User } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { AuthorizationError, ConflictError } from "@/lib/api/errors";
import { USER_ROLES } from "@/config/app.config";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { AdminUpdateCustomerProfileSchema } from "@/lib/validations";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import {
  createAuditContext,
  auditDelete,
  auditUpdate,
} from "@/lib/audit";
import { Types } from "mongoose";
import { validateBody } from "@/lib/api/validate";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffOrderScopeFilter,
  hasStaffScope,
  type StaffAccessScope,
} from "@/lib/staff-scope";
import { withApi } from "@/lib/api/handler";

type ShippingAddressInput = {
  firstName?: string;
  lastName?: string;
  street: string;
  city: string;
  state?: string;
  apartment?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
  label?: "home" | "work" | "other";
};

function normalizeShippingAddress(address?: ShippingAddressInput) {
  if (!address) return undefined;
  return {
    firstName: address.firstName?.trim() || undefined,
    lastName: address.lastName?.trim() || undefined,
    street: address.street.trim(),
    city: address.city.trim(),
    state: address.state?.trim() || undefined,
    apartment: address.apartment?.trim() || undefined,
    postalCode: address.postalCode.trim(),
    country: address.country.trim(),
    phone: address.phone?.trim() || undefined,
    isDefault: true,
    label: address.label || "home",
  };
}

/**
 * GET /api/admin/customers/[id]
 * Get a single customer profile with user data
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    let staffScope: StaffAccessScope | undefined;
    if (session.user.role !== USER_ROLES.ADMIN) {
      const access = await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [STAFF_PERMISSIONS.VIEW_CUSTOMERS],
      );
      staffScope = access.staffScope;
    }

    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return notFoundResponse("Customer");
    }

    await connectDB();

    const profile = await CustomerProfile.findById(id)
      .populate({
        path: "userId",
        select: "name email image phone role status createdAt",
      })
      .lean();

    if (!profile) {
      return notFoundResponse("Customer profile");
    }
    if (
      hasStaffScope(staffScope) &&
      !(await isCustomerInStaffScope(getCustomerProfileUserId(profile), staffScope))
    ) {
      return notFoundResponse("Customer profile");
    }

    return successResponse({ profile });
  },
);

/**
 * PUT /api/admin/customers/[id]
 * Update customer profile (admin fields: tags, notes, loyalty, acquisition)
 */
export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    let staffScope: StaffAccessScope | undefined;
    if (session.user.role !== USER_ROLES.ADMIN) {
      const access = await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [
          STAFF_PERMISSIONS.EDIT_CUSTOMERS,
          STAFF_PERMISSIONS.MANAGE_CUSTOMERS,
        ],
      );
      staffScope = access.staffScope;
    }

    rateLimitByUser(
      request,
      session.user.id,
      "admin:customers:update",
      "moderate",
      session.user.role
    );

    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return notFoundResponse("Customer");
    }

    const parsed = await validateBody(request, AdminUpdateCustomerProfileSchema);

    await connectDB();

    const existingProfile = await CustomerProfile.findById(id).lean();
    if (!existingProfile) {
      return notFoundResponse("Customer profile");
    }

    const userId = String(existingProfile.userId);
    if (
      hasStaffScope(staffScope) &&
      !(await isCustomerInStaffScope(userId, staffScope))
    ) {
      return notFoundResponse("Customer profile");
    }

    const existingUser = await User.findById(userId)
      .select("name email phone role status addresses")
      .lean();
    if (!existingUser) {
      return notFoundResponse("Customer user");
    }

    const profileUpdateFields: Record<string, unknown> = {};
    const userUpdateFields: Record<string, unknown> = {};

    if (parsed.tags !== undefined) {
      profileUpdateFields.tags = Array.from(
        new Set(parsed.tags.map((tag) => tag.trim()).filter(Boolean)),
      );
    }
    if (parsed.notes !== undefined) profileUpdateFields.notes = parsed.notes;
    if (parsed.loyaltyPoints !== undefined)
      profileUpdateFields.loyaltyPoints = parsed.loyaltyPoints;
    if (parsed.loyaltyTier !== undefined)
      profileUpdateFields.loyaltyTier = parsed.loyaltyTier;
    if (parsed.acquisitionSource !== undefined)
      profileUpdateFields.acquisitionSource = parsed.acquisitionSource;
    const shippingAddress = normalizeShippingAddress(parsed.shippingAddress);
    if (shippingAddress !== undefined)
      profileUpdateFields.shippingAddress = shippingAddress;

    if (parsed.name !== undefined) userUpdateFields.name = parsed.name.trim();
    if (parsed.phone !== undefined) {
      userUpdateFields.phone = parsed.phone.trim() || undefined;
    }
    if (parsed.email !== undefined) {
      const normalizedEmail = parsed.email.trim().toLowerCase();
      if (normalizedEmail !== existingUser.email) {
        const otherUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: userId },
        })
          .select("_id")
          .lean();
        if (otherUser) {
          throw new ConflictError("Another user already uses this email");
        }
      }
      userUpdateFields.email = normalizedEmail;
    }
    if (parsed.status !== undefined) {
      userUpdateFields.status = parsed.status;
    }
    if (shippingAddress !== undefined) {
      const currentAddresses = Array.isArray(
        (existingUser as { addresses?: unknown[] }).addresses,
      )
        ? ((existingUser as { addresses: ShippingAddressInput[] }).addresses || [])
        : [];
      const remaining = currentAddresses.slice(1).map((address) => ({
        ...address,
        isDefault: false,
      }));
      userUpdateFields.addresses = [shippingAddress, ...remaining];
    }

    if (
      Object.keys(profileUpdateFields).length === 0 &&
      Object.keys(userUpdateFields).length === 0
    ) {
      return successResponse({ message: "No fields to update" });
    }

    if (Object.keys(profileUpdateFields).length > 0) {
      await CustomerProfile.updateOne({ _id: id }, { $set: profileUpdateFields });
    }
    if (Object.keys(userUpdateFields).length > 0) {
      await User.updateOne({ _id: userId }, { $set: userUpdateFields });
    }

    // Audit log
    const auditContext = createAuditContext(request, session);
    const before = {
      profile: existingProfile,
      user: existingUser,
    } as unknown as Record<string, unknown>;
    const after = {
      profile: { ...existingProfile, ...profileUpdateFields },
      user: { ...existingUser, ...userUpdateFields },
    } as unknown as Record<string, unknown>;

    await auditUpdate(
      auditContext,
      "user",
      userId,
      before,
      after,
      existingUser.email,
    );

    return successResponse({ message: "Customer profile updated successfully" });
  },
);

/**
 * DELETE /api/admin/customers/[id]
 * Delete customer profile and associated user account
 */
export const DELETE = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    let staffScope: StaffAccessScope | undefined;
    if (session.user.role !== USER_ROLES.ADMIN) {
      const access = await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [
          STAFF_PERMISSIONS.DELETE_CUSTOMERS,
          STAFF_PERMISSIONS.MANAGE_CUSTOMERS,
        ],
      );
      staffScope = access.staffScope;
    }

    rateLimitByUser(
      request,
      session.user.id,
      "admin:customers:delete",
      "strict",
      session.user.role
    );

    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return notFoundResponse("Customer");
    }

    await connectDB();

    const profile = await CustomerProfile.findById(id)
      .populate({
        path: "userId",
        select: "name email role",
      })
      .lean();
    if (!profile) {
      return notFoundResponse("Customer profile");
    }

    const userFromProfile =
      profile.userId && typeof profile.userId === "object"
        ? (profile.userId as { _id?: Types.ObjectId; name?: string; email?: string; role?: string })
        : null;

    const targetUserId = userFromProfile?._id
      ? String(userFromProfile._id)
      : String(profile.userId);
    if (
      hasStaffScope(staffScope) &&
      !(await isCustomerInStaffScope(targetUserId, staffScope))
    ) {
      return notFoundResponse("Customer profile");
    }

    if (targetUserId === session.user.id) {
      throw new AuthorizationError("Cannot delete your own account");
    }

    await CustomerProfile.deleteOne({ _id: id });
    if (targetUserId) {
      await User.deleteOne({ _id: targetUserId });
    }

    const auditContext = createAuditContext(request, session);
    await auditDelete(
      auditContext,
      "user",
      targetUserId || id,
      {
        customerProfileId: id,
        name: userFromProfile?.name,
        email: userFromProfile?.email,
      },
      userFromProfile?.email,
    );

    return successResponse({ message: "Customer deleted successfully" });
  },
);

async function isCustomerInStaffScope(
  userId: string,
  staffScope?: StaffAccessScope,
) {
  if (!hasStaffScope(staffScope)) return true;
  const count = await Order.countDocuments({
    customerId: userId,
    ...buildStaffOrderScopeFilter(staffScope),
  });
  return count > 0;
}

function getCustomerProfileUserId(profile: { userId?: unknown }) {
  const user = profile.userId;
  if (user && typeof user === "object" && "_id" in user) {
    return String((user as { _id?: unknown })._id || "");
  }
  return String(user || "");
}
