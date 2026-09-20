import { Types } from "mongoose";
import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import { CustomerProfile, Order, User } from "@/models";
import { paginatedResponse, createdResponse } from "@/lib/api/response";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ApiError,
} from "@/lib/api/errors";
import { USER_ACCOUNT_STATUS, USER_ROLES } from "@/config/app.config";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getSettings } from "@/models/settings.model";
import { validateBody, validateQuery } from "@/lib/api/validate";
import {
  AdminCreateCustomerSchema,
  CustomerListQuerySchema,
} from "@/lib/validations";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { ensureCustomerProfile } from "@/lib/customer";
import { createAuditContext, auditCreate } from "@/lib/audit";
import { notifyAdminsNewCustomer } from "@/lib/notifications";
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

async function requireVendorOrderPermission(user: IUser) {
  if (isAdmin(user)) return;
  const canCreate = await hasVendorPermission(
    user,
    VENDOR_PERMISSIONS.CREATE_ORDERS,
  );
  if (canCreate) return;
  const canManage = await hasVendorPermission(
    user,
    VENDOR_PERMISSIONS.MANAGE_ORDERS,
  );
  if (canManage) return;
  throw new AuthorizationError(
    "You do not have permission to create orders",
  );
}

/**
 * GET /api/vendor/customers
 * Returns customers who have placed an order containing this vendor's items,
 * plus optionally any newly created (no orders yet) customers. Response shape
 * mirrors /api/admin/customers so the same client mapper can consume it.
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    await requireVendorOrderPermission(session.user as unknown as IUser);

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:customers:list",
      "lenient",
      session.user.role,
    );

    const { page, limit, search, status, sortBy, sortOrder } = validateQuery(
      request,
      CustomerListQuerySchema,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);

    // Customer userIds that have purchased from this vendor.
    const purchaserDocs = await Order.aggregate<{ _id: Types.ObjectId }>([
      { $match: { "subOrders.vendorId": vendor._id } },
      { $group: { _id: "$customerId" } },
    ]);
    const purchaserIds = purchaserDocs
      .map((doc) => doc._id)
      .filter(Boolean);

    if (purchaserIds.length === 0) {
      return paginatedResponse([], page, limit, 0);
    }

    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: { userId: { $in: purchaserIds } } },
      {
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
      },
      { $unwind: "$user" },
    ];

    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        $or: [
          { "user.name": { $regex: search, $options: "i" } },
          { "user.email": { $regex: search, $options: "i" } },
        ],
      });
    }

    if (
      status &&
      status !== "all" &&
      Object.values(USER_ACCOUNT_STATUS).includes(
        status as (typeof USER_ACCOUNT_STATUS)[keyof typeof USER_ACCOUNT_STATUS],
      )
    ) {
      if (status === USER_ACCOUNT_STATUS.ACTIVE) {
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

    if (andConditions.length === 1) {
      pipeline.push({ $match: andConditions[0] });
    } else if (andConditions.length > 1) {
      pipeline.push({ $match: { $and: andConditions } });
    }

    const sortField = sortBy || "createdAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortDir } });

    const countPipeline: PipelineStage[] = [...pipeline, { $count: "total" }];
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
 * POST /api/vendor/customers
 * Vendor-side create-customer used during order creation. Mirrors the admin
 * endpoint but gated by vendor order permissions.
 */
export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    await requireVendorOrderPermission(session.user as unknown as IUser);

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:customers:create",
      "moderate",
      session.user.role,
    );

    const parsed = await validateBody(request, AdminCreateCustomerSchema);
    const email = parsed.email.trim().toLowerCase();
    const shippingAddress = normalizeShippingAddress(parsed.shippingAddress);

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");
    await requireApprovedVendorByUserId(session.user.id);

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
        createdViaVendor: session.user.id,
      },
      user.email,
    );

    await notifyAdminsNewCustomer(
      {
        customerId: user._id.toString(),
        name: user.name,
        email: user.email,
        createdBy: session.user.id,
      },
      { settings },
    );

    return createdResponse({ profile }, "Customer created successfully");
  },
);
