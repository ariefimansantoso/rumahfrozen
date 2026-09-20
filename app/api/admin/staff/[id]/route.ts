import { connectDB } from "@/lib/db";
import { User, StaffProfile } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { USER_ROLES } from "@/config/app.config";
import { createAuditContext, auditUpdate, auditDelete } from "@/lib/audit";
import { Types } from "mongoose";
import { ALL_STAFF_PERMISSIONS } from "@/config/permissions.config";
import type { StaffPermission } from "@/config/permissions.config";
import { STAFF_USER_ROLES } from "@/lib/staff-role";
import { isVendorScopedStaff } from "@/lib/admin-staff-scope";
import { setUserRole } from "@/lib/user-role";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/admin/staff/[id]
 * Get a single staff member with their profile
 */
export const GET = withApi<{ id: string }>(
  { auth: "admin" },
  async ({ params }) => {
    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return notFoundResponse("Staff member");
    }

    await connectDB();

    // id is the user _id
    const user = await User.findOne({
      _id: id,
      role: { $in: STAFF_USER_ROLES },
    })
      .select("name email image phone status createdAt")
      .lean();

    if (!user) {
      return notFoundResponse("Staff member");
    }

    // Vendor-owned staff are out of scope for the admin.
    if (await isVendorScopedStaff(id)) {
      return notFoundResponse("Staff member");
    }

    const staffProfile = await StaffProfile.findOne({ userId: id }).lean();

    return successResponse({
      ...user,
      staffProfile: staffProfile || null,
    });
  },
);

/**
 * PUT /api/admin/staff/[id]
 * Update staff member info and permissions
 */
export const PUT = withApi<{ id: string }>(
  {
    auth: "admin",
    rateLimit: { action: "admin:staff:update", preset: "moderate" },
  },
  async ({ request, params, session }) => {
    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return notFoundResponse("Staff member");
    }

    await connectDB();

    const user = await User.findOne({
      _id: id,
      role: { $in: STAFF_USER_ROLES },
    }).lean();

    if (!user) {
      return notFoundResponse("Staff member");
    }

    // Vendor-owned staff are out of scope for the admin.
    if (await isVendorScopedStaff(id)) {
      return notFoundResponse("Staff member");
    }

    const body = await request.json();
    const {
      name,
      phone,
      status,
      permissions,
      vendorIds,
      locationIds,
      fulfillmentRegions,
      department,
      notes,
      isActive,
    } = body;

    // Update user fields
    const userUpdate: Record<string, unknown> = {};
    if (name?.trim()) userUpdate.name = name.trim();
    if (phone !== undefined) userUpdate.phone = phone?.trim() || undefined;
    if (status && ["active", "inactive", "banned"].includes(status)) {
      userUpdate.status = status;
    }

    if (Object.keys(userUpdate).length > 0) {
      await User.updateOne({ _id: id }, { $set: userUpdate });
    }

    // Update staff profile
    const profileUpdate: Record<string, unknown> = {};
    if (Array.isArray(permissions)) {
      const validPerms = permissions.filter((p: string) =>
        ALL_STAFF_PERMISSIONS.includes(p as StaffPermission),
      );
      profileUpdate.permissions = validPerms;
    }
    if (Array.isArray(vendorIds)) {
      profileUpdate.vendorIds = sanitizeObjectIdList(vendorIds);
    }
    if (Array.isArray(locationIds)) {
      profileUpdate.locationIds = sanitizeStringList(locationIds);
    }
    if (Array.isArray(fulfillmentRegions)) {
      profileUpdate.fulfillmentRegions = sanitizeStringList(fulfillmentRegions);
    }
    if (department !== undefined)
      profileUpdate.department = department?.trim() || undefined;
    if (notes !== undefined) profileUpdate.notes = notes?.trim() || undefined;
    if (typeof isActive === "boolean") profileUpdate.isActive = isActive;

    if (Object.keys(profileUpdate).length > 0) {
      await StaffProfile.updateOne(
        { userId: id },
        {
          $set: profileUpdate,
          $setOnInsert: {
            userId: id,
            assignedBy: session.user.id,
          },
        },
        { upsert: true },
      );
    }

    // Audit
    const auditContext = createAuditContext(request, session);
    await auditUpdate(
      auditContext,
      "user",
      id,
      { user, role: "staff" } as unknown as Record<string, unknown>,
      {
        ...userUpdate,
        ...profileUpdate,
      } as unknown as Record<string, unknown>,
      user.email,
    );

    // Return updated data
    const updatedUser = await User.findById(id)
      .select("name email image phone status createdAt")
      .lean();
    const updatedProfile = await StaffProfile.findOne({ userId: id }).lean();

    return successResponse({
      ...updatedUser,
      staffProfile: updatedProfile,
    });
  },
);

/**
 * DELETE /api/admin/staff/[id]
 * Remove staff role and profile (reverts to customer)
 */
export const DELETE = withApi<{ id: string }>(
  {
    auth: "admin",
    rateLimit: { action: "admin:staff:delete", preset: "strict" },
  },
  async ({ request, params, session }) => {
    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return notFoundResponse("Staff member");
    }

    if (id === session.user.id) {
      throw new ValidationError("Cannot remove your own staff access");
    }

    await connectDB();

    const user = await User.findOne({
      _id: id,
      role: { $in: STAFF_USER_ROLES },
    }).lean();

    if (!user) {
      return notFoundResponse("Staff member");
    }

    // Vendor-owned staff are out of scope for the admin.
    if (await isVendorScopedStaff(id)) {
      return notFoundResponse("Staff member");
    }

    // Revert to customer role and keep the denormalized roles array in sync.
    await setUserRole(id, USER_ROLES.CUSTOMER);

    // Remove staff profile
    await StaffProfile.deleteOne({ userId: id });

    // Audit
    const auditContext = createAuditContext(request, session);
    await auditDelete(
      auditContext,
      "user",
      id,
      { name: user.name, email: user.email, action: "staff_removed" },
      user.email,
    );

    return successResponse({ message: "Staff member removed successfully" });
  },
);

function sanitizeObjectIdList(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((value) => String(value || "").trim())
        .filter((value) => Types.ObjectId.isValid(value)),
    ),
  );
}

function sanitizeStringList(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}
