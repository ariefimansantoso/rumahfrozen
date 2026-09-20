import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { AuthorizationError } from "@/lib/api/errors";
import { USER_ACCOUNT_STATUS, USER_ROLES } from "@/config/app.config";
import { validateBody, isValidObjectId } from "@/lib/api/validate";
import { AdminUpdateUserSchema } from "@/lib/validations";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import {
  createAuditContext,
  auditRoleChange,
  auditDelete,
  auditUpdate,
} from "@/lib/audit";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/admin/users/[id]
 * Get single user
 */
export const GET = withApi<{ id: string }>(
  { auth: "admin" },
  async ({ params }) => {
    const { id } = params;

    // Validate ID format
    if (!isValidObjectId(id)) {
      return notFoundResponse("User");
    }

    await connectDB();

    const user = await User.findById(id).select("-password").lean();

    if (!user) {
      return notFoundResponse("User");
    }

    return successResponse(user);
  },
);

/**
 * PUT /api/admin/users/[id]
 * Update user (role, status, etc.)
 */
export const PUT = withApi<{ id: string }>(
  { auth: "admin" },
  async ({ request, params, session }) => {
    const { id } = params;

    // Validate ID format
    if (!isValidObjectId(id)) {
      return notFoundResponse("User");
    }

    // Rate limiting - user updates are sensitive
    rateLimitByUser(
      request,
      session.user.id,
      "admin:users:update",
      "moderate",
      session.user.role
    );

    // Validate request body
    const updates = await validateBody(request, AdminUpdateUserSchema);

    // Prevent admin from modifying themselves via this endpoint
    if (id === session.user.id) {
      throw new AuthorizationError(
        "Cannot update your own account via this endpoint"
      );
    }

    await connectDB();

    // Get user before update for audit logging
    const userBefore = await User.findById(id).select("-password").lean();
    if (!userBefore) {
      return notFoundResponse("User");
    }

    // Filter to allowed updates only
    const allowedUpdates: Record<string, unknown> = {};
    if (updates.role && Object.values(USER_ROLES).includes(updates.role)) {
      allowedUpdates.role = updates.role;
    }
    if (updates.name) allowedUpdates.name = updates.name;
    if (updates.phone !== undefined) allowedUpdates.phone = updates.phone;
    if (updates.status && Object.values(USER_ACCOUNT_STATUS).includes(updates.status)) {
      allowedUpdates.status = updates.status;
    } else if (typeof updates.banned === "boolean") {
      allowedUpdates.status = updates.banned
        ? USER_ACCOUNT_STATUS.BANNED
        : USER_ACCOUNT_STATUS.ACTIVE;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: allowedUpdates },
      { new: true }
    ).select("-password");

    if (!user) {
      return notFoundResponse("User");
    }

    // Audit logging
    const auditContext = createAuditContext(request, session);

    // Special audit for role changes
    if (updates.role && updates.role !== userBefore.role) {
      await auditRoleChange(
        auditContext,
        id,
        userBefore.role,
        updates.role,
        userBefore.email
      );
    } else if (Object.keys(allowedUpdates).length > 0) {
      // General update audit
      await auditUpdate(
        auditContext,
        "user",
        id,
        userBefore as unknown as Record<string, unknown>,
        user.toObject() as unknown as Record<string, unknown>,
        userBefore.email
      );
    }

    return successResponse(user);
  },
);

/**
 * DELETE /api/admin/users/[id]
 * Delete user
 */
export const DELETE = withApi<{ id: string }>(
  { auth: "admin" },
  async ({ request, params, session }) => {
    const { id } = params;

    // Validate ID format
    if (!isValidObjectId(id)) {
      return notFoundResponse("User");
    }

    // Rate limiting - deletions are very sensitive
    rateLimitByUser(
      request,
      session.user.id,
      "admin:users:delete",
      "strict",
      session.user.role
    );

    if (id === session.user.id) {
      throw new AuthorizationError("Cannot delete yourself");
    }

    await connectDB();

    // Get user before deletion for audit logging
    const user = await User.findById(id).select("-password").lean();
    if (!user) {
      return notFoundResponse("User");
    }

    await User.findByIdAndDelete(id);

    // Audit log the deletion
    const auditContext = createAuditContext(request, session);
    await auditDelete(
      auditContext,
      "user",
      id,
      {
        email: user.email,
        name: user.name,
        role: user.role,
      },
      user.email
    );

    return successResponse({ message: "User deleted successfully" });
  },
);
