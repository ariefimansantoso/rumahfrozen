import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { StaffProfile, User } from "@/models";
import { getSettings } from "@/models/settings.model";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { USER_ROLES } from "@/config/app.config";
import {
  ALL_STAFF_PERMISSIONS,
  VENDOR_PERMISSIONS,
  type StaffPermission,
  type VendorPermission,
} from "@/config/permissions.config";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { setUserRole } from "@/lib/user-role";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  handleApiError,
} from "@/lib/api/errors";
import { STAFF_USER_ROLES } from "@/lib/staff-role";
import { hasVendorPermission } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { vendor } = await requireVendorStaffPermission(
      request,
      [
        VENDOR_PERMISSIONS.VIEW_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
      ],
      "vendor:staff:read",
      "lenient",
    );

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return notFoundResponse("Staff member");

    const profile = await StaffProfile.findOne({
      userId: id,
      vendorIds: vendor._id,
    }).lean();
    if (!profile) return notFoundResponse("Staff member");

    const user = await User.findOne({
      _id: id,
      role: { $in: STAFF_USER_ROLES },
    })
      .select("name email image phone status createdAt")
      .lean();
    if (!user) return notFoundResponse("Staff member");

    return successResponse({ ...user, staffProfile: profile });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { vendor } = await requireVendorStaffPermission(
      request,
      [
        VENDOR_PERMISSIONS.EDIT_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
      ],
      "vendor:staff:update",
      "moderate",
    );

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return notFoundResponse("Staff member");

    const profile = await StaffProfile.findOne({
      userId: id,
      vendorIds: vendor._id,
    }).lean();
    if (!profile) return notFoundResponse("Staff member");

    const user = await User.findOne({
      _id: id,
      role: { $in: STAFF_USER_ROLES },
    }).lean();
    if (!user) return notFoundResponse("Staff member");

    const body = await request.json();
    const { name, phone, status, permissions, department, notes, isActive } =
      body;

    const userUpdate: Record<string, unknown> = {};
    if (name?.trim()) userUpdate.name = name.trim();
    if (phone !== undefined) userUpdate.phone = phone?.trim() || undefined;
    if (status && ["active", "inactive", "banned"].includes(status)) {
      userUpdate.status = status;
    }

    if (Object.keys(userUpdate).length > 0) {
      await User.updateOne({ _id: id }, { $set: userUpdate });
    }

    const profileUpdate: Record<string, unknown> = {};
    if (Array.isArray(permissions)) {
      profileUpdate.permissions = sanitizeStaffPermissions(permissions);
    }
    if (department !== undefined) {
      profileUpdate.department = department?.trim() || undefined;
    }
    if (notes !== undefined) profileUpdate.notes = notes?.trim() || undefined;
    if (typeof isActive === "boolean") profileUpdate.isActive = isActive;

    if (Object.keys(profileUpdate).length > 0) {
      await StaffProfile.updateOne({ userId: id }, { $set: profileUpdate });
    }

    const updatedUser = await User.findById(id)
      .select("name email image phone status createdAt")
      .lean();
    const updatedProfile = await StaffProfile.findOne({ userId: id }).lean();

    return successResponse({ ...updatedUser, staffProfile: updatedProfile });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, vendor } = await requireVendorStaffPermission(
      request,
      [
        VENDOR_PERMISSIONS.DELETE_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STAFF,
        VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
      ],
      "vendor:staff:delete",
      "strict",
    );

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return notFoundResponse("Staff member");
    if (id === session.user.id) {
      throw new ValidationError("Cannot remove your own staff access");
    }

    const profile = await StaffProfile.findOne({
      userId: id,
      vendorIds: vendor._id,
    }).lean();
    if (!profile) return notFoundResponse("Staff member");

    const remainingVendorIds = (profile.vendorIds || [])
      .map(String)
      .filter((vendorId: string) => vendorId !== String(vendor._id));

    if (remainingVendorIds.length > 0) {
      await StaffProfile.updateOne(
        { userId: id },
        { $set: { vendorIds: remainingVendorIds } },
      );
    } else {
      await StaffProfile.deleteOne({ userId: id });
      await setUserRole(id, USER_ROLES.CUSTOMER);
    }

    return successResponse({ message: "Staff member removed successfully" });
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
