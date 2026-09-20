import { connectDB } from "@/lib/db";
import { User, StaffProfile } from "@/models";
import {
  createdResponse,
  paginatedResponse,
} from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { USER_ROLES } from "@/config/app.config";
import { validateQuery } from "@/lib/api/validate";
import { AdminListQuerySchema } from "@/lib/validations";
import {
  ALL_STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
} from "@/config/permissions.config";
import type { StaffPermission } from "@/config/permissions.config";
import { STAFF_USER_ROLES, isStaffRole } from "@/lib/staff-role";
import { getVendorScopedStaffUserIds } from "@/lib/admin-staff-scope";
import { Types } from "mongoose";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/admin/staff
 * List all staff members with their profiles
 */
export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:staff:list", preset: "lenient" },
  },
  async ({ request }) => {
    const { page, limit, search } = validateQuery(
      request,
      AdminListQuerySchema,
    );

    const statusParam = request.nextUrl.searchParams.get("status");

    await connectDB();

    const skip = (page - 1) * limit;

    // Admins only manage platform staff; exclude staff owned by a vendor.
    const vendorScopedUserIds = await getVendorScopedStaffUserIds();

    // First get all staff user IDs
    const staffQuery: Record<string, unknown> = {
      role: { $in: STAFF_USER_ROLES },
      _id: { $nin: vendorScopedUserIds },
    };

    if (search) {
      staffQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (statusParam === "active") {
      staffQuery.status = { $in: ["active", null] };
    } else if (statusParam === "inactive") {
      staffQuery.status = "inactive";
    } else if (statusParam === "banned") {
      staffQuery.status = "banned";
    }

    const [users, total] = await Promise.all([
      User.find(staffQuery)
        .select("name email image phone status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(staffQuery),
    ]);

    // Get staff profiles for these users
    const userIds = users.map((u) => u._id);
    const profiles = await StaffProfile.find({
      userId: { $in: userIds },
    }).lean();

    const profileMap = new Map(
      profiles.map((p) => [p.userId.toString(), p]),
    );

    const staffList = users.map((user) => {
      const profile = profileMap.get(user._id.toString());
      return {
        ...user,
        staffProfile: profile || null,
      };
    });

    return paginatedResponse(staffList, page, limit, total);
  },
);

/**
 * POST /api/admin/staff
 * Create a new staff member
 */
export const POST = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:staff:create", preset: "moderate" },
  },
  async ({ request, session }) => {
    const body = await request.json();
    const {
      name,
      email,
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

    if (!name?.trim()) throw new ValidationError("Name is required");
    if (!email?.trim()) throw new ValidationError("Email is required");

    // Check if user already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    }).lean();

    let userId: string;
    const hasValidStatus = ["active", "inactive", "banned"].includes(status);

    if (existingUser) {
      // If user exists and is already a seller, return error
      if (isStaffRole(existingUser.role)) {
        throw new ValidationError("This user is already a staff member");
      }
      // If user exists with another role, update to staff
      if (
        existingUser.role === USER_ROLES.ADMIN ||
        existingUser.role === USER_ROLES.VENDOR
      ) {
        throw new ValidationError(
          `This user already has the ${existingUser.role} role`,
        );
      }
      // Update customer to staff
      const userUpdate: Record<string, unknown> = {
        role: USER_ROLES.STAFF,
        roles: [USER_ROLES.STAFF],
      };
      if (name?.trim()) userUpdate.name = name.trim();
      if (phone !== undefined) userUpdate.phone = phone?.trim() || undefined;
      if (hasValidStatus) userUpdate.status = status;

      await User.updateOne(
        { _id: existingUser._id },
        { $set: userUpdate },
      );
      userId = existingUser._id.toString();
    } else {
      // Create new user with staff role
      const newUserPayload: Record<string, unknown> = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || undefined,
        role: USER_ROLES.STAFF,
        roles: [USER_ROLES.STAFF],
        emailVerified: false,
      };
      if (hasValidStatus) {
        newUserPayload.status = status;
      }

      const newUser = await User.create({
        ...newUserPayload,
      });
      userId = newUser._id.toString();
    }

    // Check if staff profile already exists
    const existingProfile = await StaffProfile.findOne({ userId });
    if (existingProfile) {
      throw new ValidationError("Staff profile already exists for this user");
    }

    // Create staff profile
    const staffPermissions = sanitizeStaffPermissions(permissions);

    const staffProfile = await StaffProfile.create({
      userId,
      permissions:
        staffPermissions.length > 0
          ? staffPermissions
          : DEFAULT_STAFF_PERMISSIONS,
      vendorIds: sanitizeObjectIdList(vendorIds),
      locationIds: sanitizeStringList(locationIds),
      fulfillmentRegions: sanitizeStringList(fulfillmentRegions),
      assignedBy: session.user.id,
      department: department?.trim() || undefined,
      notes: notes?.trim() || undefined,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    const user = await User.findById(userId)
      .select("name email image phone status createdAt")
      .lean();

    return createdResponse({
      ...user,
      staffProfile,
    });
  },
);

function sanitizeStaffPermissions(input: unknown): StaffPermission[] {
  if (!Array.isArray(input)) return [];
  const valid = input.filter(
    (permission: unknown): permission is StaffPermission =>
      typeof permission === "string" &&
      ALL_STAFF_PERMISSIONS.includes(permission as StaffPermission),
  );
  return Array.from(new Set(valid));
}

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
