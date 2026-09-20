import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { StaffProfile, User } from "@/models";
import { getSettings } from "@/models/settings.model";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { USER_ROLES } from "@/config/app.config";
import {
  ALL_STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  VENDOR_PERMISSIONS,
  type StaffPermission,
  type VendorPermission,
} from "@/config/permissions.config";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateQuery } from "@/lib/api/validate";
import { AdminListQuerySchema } from "@/lib/validations";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  handleApiError,
} from "@/lib/api/errors";
import { STAFF_USER_ROLES, isStaffRole } from "@/lib/staff-role";
import { hasVendorPermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const { session, vendor } = await requireVendorStaffPermission(
      request,
      [
        VENDOR_PERMISSIONS.VIEW_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
      ],
      "vendor:staff:list",
      "lenient",
    );

    const { page, limit, search } = validateQuery(request, AdminListQuerySchema);
    const statusParam = request.nextUrl.searchParams.get("status");
    const skip = (page - 1) * limit;

    const profiles = await StaffProfile.find({ vendorIds: vendor._id }).lean();
    const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

    const userQuery: Record<string, unknown> = {
      _id: { $in: profiles.map((profile) => profile.userId) },
      role: { $in: STAFF_USER_ROLES },
    };

    if (search) {
      userQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (statusParam === "active") {
      userQuery.status = { $in: ["active", null] };
    } else if (statusParam === "inactive") {
      userQuery.status = "inactive";
    } else if (statusParam === "banned") {
      userQuery.status = "banned";
    }

    const [users, total] = await Promise.all([
      User.find(userQuery)
        .select("name email image phone status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(userQuery),
    ]);

    return paginatedResponse(
      users.map((user) => ({
        ...user,
        staffProfile: profileMap.get(String(user._id)) || null,
      })),
      page,
      limit,
      total,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, vendor } = await requireVendorStaffPermission(
      request,
      [
        VENDOR_PERMISSIONS.CREATE_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
      ],
      "vendor:staff:create",
      "moderate",
    );

    const body = await request.json();
    const {
      name,
      email,
      phone,
      status,
      permissions,
      department,
      notes,
      isActive,
    } = body;

    if (!name?.trim()) throw new ValidationError("Name is required");
    if (!email?.trim()) throw new ValidationError("Email is required");

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    const hasValidStatus = ["active", "inactive", "banned"].includes(status);
    let userId: string;

    if (existingUser) {
      if (isStaffRole(existingUser.role)) {
        throw new ValidationError("This user is already a staff member");
      }
      if (
        existingUser.role === USER_ROLES.ADMIN ||
        existingUser.role === USER_ROLES.VENDOR
      ) {
        throw new ValidationError(
          `This user already has the ${existingUser.role} role`,
        );
      }

      const userUpdate: Record<string, unknown> = {
        role: USER_ROLES.STAFF,
        roles: [USER_ROLES.STAFF],
      };
      if (name?.trim()) userUpdate.name = name.trim();
      if (phone !== undefined) userUpdate.phone = phone?.trim() || undefined;
      if (hasValidStatus) userUpdate.status = status;

      await User.updateOne({ _id: existingUser._id }, { $set: userUpdate });
      userId = String(existingUser._id);
    } else {
      const newUser = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || undefined,
        role: USER_ROLES.STAFF,
        roles: [USER_ROLES.STAFF],
        emailVerified: false,
        ...(hasValidStatus ? { status } : {}),
      });
      userId = String(newUser._id);
    }

    const existingProfile = await StaffProfile.findOne({ userId });
    if (existingProfile) {
      throw new ValidationError("Staff profile already exists for this user");
    }

    const staffPermissions = sanitizeStaffPermissions(permissions);
    const staffProfile = await StaffProfile.create({
      userId,
      permissions:
        staffPermissions.length > 0
          ? staffPermissions
          : DEFAULT_STAFF_PERMISSIONS,
      vendorIds: [vendor._id],
      assignedBy: session.user.id,
      department: department?.trim() || undefined,
      notes: notes?.trim() || undefined,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    const user = await User.findById(userId)
      .select("name email image phone status createdAt")
      .lean();

    return createdResponse({ ...user, staffProfile });
  } catch (error) {
    return handleApiError(error);
  }
}

async function requireVendorStaffPermission(
  request: NextRequest,
  permissions: VendorPermission[],
  limiterKey: string,
  limiterMode: "lenient" | "moderate" | "strict",
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AuthenticationError();
  if (session.user.role !== USER_ROLES.VENDOR) throw new AuthorizationError();

  rateLimitByUser(
    request,
    session.user.id,
    limiterKey,
    limiterMode,
    session.user.role,
  );

  await connectDB();
  const settings = await getSettings();
  if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

  const vendor = await requireApprovedVendorByUserId(session.user.id);
  const ok = await Promise.all(
    permissions.map((permission) =>
      hasVendorPermission(
        session.user as unknown as { id?: string; role?: typeof USER_ROLES.VENDOR },
        permission,
      ),
    ),
  );
  if (!ok.some(Boolean)) throw new AuthorizationError();

  return { session, vendor };
}

function sanitizeStaffPermissions(input: unknown): StaffPermission[] {
  if (!Array.isArray(input)) return [];
  const valid = input.filter(
    (permission: unknown): permission is StaffPermission =>
      typeof permission === "string" &&
      ALL_STAFF_PERMISSIONS.includes(permission as StaffPermission),
  );
  return Array.from(new Set(valid));
}
