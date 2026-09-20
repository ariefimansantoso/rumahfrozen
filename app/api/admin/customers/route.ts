import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import { CustomerProfile, User } from "@/models";
import { paginatedResponse, createdResponse } from "@/lib/api/response";
import { ConflictError, ApiError } from "@/lib/api/errors";
import { USER_ACCOUNT_STATUS, USER_ROLES } from "@/config/app.config";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { AdminCreateCustomerSchema, CustomerListQuerySchema } from "@/lib/validations";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { ensureCustomerProfile } from "@/lib/customer";
import {
  createAuditContext,
  auditCreate,
} from "@/lib/audit";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import { notifyAdminsNewCustomer } from "@/lib/notifications";
import {
  buildStaffOrderScopeFilter,
  hasStaffScope,
} from "@/lib/staff-scope";
import { Order } from "@/models";
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
 * GET /api/admin/customers
 * Get paginated customer list with filters
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    let staffScope = undefined as
      | Awaited<ReturnType<typeof assertAdminOrStaffPermissions>>["staffScope"]
      | undefined;
    if (session.user.role !== USER_ROLES.ADMIN) {
      const access = await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [STAFF_PERMISSIONS.VIEW_CUSTOMERS],
      );
      staffScope = access.staffScope;
    }

    rateLimitByUser(
      request,
      session.user.id,
      "admin:customers:list",
      "lenient",
      session.user.role
    );

    const {
      page,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
      loyaltyTier,
      tag,
      minSpent,
      maxSpent,
    } = validateQuery(request, CustomerListQuerySchema);

    await connectDB();

    const skip = (page - 1) * limit;

    // Build aggregation pipeline to join CustomerProfile with User
    const pipeline: PipelineStage[] = [];

    // Lookup user data
    pipeline.push({
      $lookup: {
        from: "user",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $project: {
              name: 1,
              email: 1,
              image: 1,
              phone: 1,
              role: 1,
              status: 1,
              createdAt: 1,
            },
          },
        ],
      },
    });

    pipeline.push({ $unwind: "$user" });

    // Match filters
    const andConditions: Record<string, unknown>[] = [];
    if (hasStaffScope(staffScope)) {
      const customerIds = await Order.distinct(
        "customerId",
        buildStaffOrderScopeFilter(staffScope),
      );
      andConditions.push({ userId: { $in: customerIds } });
    }

    if (search) {
      andConditions.push({
        $or: [
          { "user.name": { $regex: search, $options: "i" } },
          { "user.email": { $regex: search, $options: "i" } },
        ],
      });
    }

    if (loyaltyTier) {
      andConditions.push({ loyaltyTier });
    }

    if (
      status &&
      status !== "all" &&
      Object.values(USER_ACCOUNT_STATUS).includes(
        status as (typeof USER_ACCOUNT_STATUS)[keyof typeof USER_ACCOUNT_STATUS],
      )
    ) {
      if (status === USER_ACCOUNT_STATUS.ACTIVE) {
        // Legacy users without status should behave like active accounts.
        andConditions.push({
          $or: [
            { "user.status": USER_ACCOUNT_STATUS.ACTIVE },
            { "user.status": { $exists: false } },
            { "user.status": null },
          ],
        });
      } else {
        andConditions.push({ "user.status": status });
      }
    }

    if (tag) {
      andConditions.push({ tags: tag });
    }

    if (minSpent !== undefined || maxSpent !== undefined) {
      const totalSpentFilter: Record<string, number> = {};
      if (minSpent !== undefined) totalSpentFilter.$gte = minSpent;
      if (maxSpent !== undefined) totalSpentFilter.$lte = maxSpent;
      andConditions.push({ "stats.totalSpent": totalSpentFilter });
    }

    if (andConditions.length === 1) {
      pipeline.push({ $match: andConditions[0] });
    } else if (andConditions.length > 1) {
      pipeline.push({ $match: { $and: andConditions } });
    }

    // Sort
    const sortField = sortBy || "createdAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortDir } });

    // Count total before pagination
    const countPipeline: PipelineStage[] = [...pipeline, { $count: "total" }];

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const [customers, countResult] = await Promise.all([
      CustomerProfile.aggregate(pipeline),
      CustomerProfile.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total || 0;

    return paginatedResponse(customers, page, limit, total);
  },
);

/**
 * POST /api/admin/customers
 * Create a new customer with profile
 */
export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    if (session.user.role !== USER_ROLES.ADMIN) {
      await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [
          STAFF_PERMISSIONS.CREATE_CUSTOMERS,
          STAFF_PERMISSIONS.MANAGE_CUSTOMERS,
        ],
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "admin:customers:create",
      "moderate",
      session.user.role
    );

    const parsed = await validateBody(request, AdminCreateCustomerSchema);
    const email = parsed.email.trim().toLowerCase();
    const shippingAddress = normalizeShippingAddress(parsed.shippingAddress);

    await connectDB();

    const existingUser = await User.findOne({ email }).select("_id role").lean();
    if (existingUser) {
      throw new ConflictError("A user with this email already exists");
    }

    const user = await User.create({
      name: parsed.name.trim(),
      email,
      phone: parsed.phone?.trim() || undefined,
      addresses: shippingAddress ? [shippingAddress] : [],
      role: USER_ROLES.CUSTOMER,
      roles: [USER_ROLES.CUSTOMER],
      status: parsed.status || USER_ACCOUNT_STATUS.ACTIVE,
    });

    const baseProfile = await ensureCustomerProfile(user._id.toString());
    if (!baseProfile) {
      throw new ApiError("Failed to initialize customer profile", 500);
    }

    const tags =
      parsed.tags?.map((tag) => tag.trim()).filter(Boolean) || undefined;

    const profileUpdates: Record<string, unknown> = {};
    if (tags) profileUpdates.tags = Array.from(new Set(tags));
    if (parsed.notes !== undefined) profileUpdates.notes = parsed.notes;
    if (parsed.loyaltyPoints !== undefined) {
      profileUpdates.loyaltyPoints = parsed.loyaltyPoints;
    }
    if (parsed.loyaltyTier !== undefined) profileUpdates.loyaltyTier = parsed.loyaltyTier;
    if (parsed.acquisitionSource !== undefined) {
      profileUpdates.acquisitionSource = parsed.acquisitionSource;
    }
    if (shippingAddress) profileUpdates.shippingAddress = shippingAddress;

    if (Object.keys(profileUpdates).length > 0) {
      await CustomerProfile.updateOne(
        { _id: baseProfile._id },
        { $set: profileUpdates },
      );
    }

    const profile = await CustomerProfile.findById(baseProfile._id)
      .populate({
        path: "userId",
        select: "name email image phone role status createdAt",
      })
      .lean();

    const auditContext = createAuditContext(request, session);
    await auditCreate(
      auditContext,
      "user",
      user._id.toString(),
      {
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        customerProfileId: String(baseProfile._id),
      },
      user.email,
    );

    await notifyAdminsNewCustomer({
      customerId: user._id.toString(),
      name: user.name,
      email: user.email,
      createdBy: session.user.id,
    });

    return createdResponse(
      { profile },
      "Customer created successfully",
    );
  },
);
