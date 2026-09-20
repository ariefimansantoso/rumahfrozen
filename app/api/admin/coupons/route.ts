import { Coupon } from "@/models";
import { successResponse, paginatedResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { AdminListQuerySchema, CreateCouponSchema } from "@/lib/validations";
import { auditCreate, createAuditContext } from "@/lib/audit";

/**
 * GET /api/admin/coupons
 * Get all coupons (admin only)
 */
export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:coupons:list", preset: "lenient" },
  },
  async ({ request }) => {
    const { page, limit, search, status } = validateQuery(
      request,
      AdminListQuerySchema,
    );

    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { label: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Coupon.countDocuments(query),
    ]);

    return paginatedResponse(coupons, page, limit, total);
  },
);

/**
 * POST /api/admin/coupons
 * Create a new coupon (admin only)
 */
export const POST = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:coupons:create", preset: "moderate" },
  },
  async ({ request, session }) => {
    const body = await validateBody(request, CreateCouponSchema);

    const code =
      typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) throw new ValidationError({ code: ["Coupon code is required"] });

    const perUserLimit =
      typeof (body as { perUserLimit?: unknown }).perUserLimit === "number"
        ? (body as { perUserLimit: number }).perUserLimit
        : typeof (body as { userLimit?: unknown }).userLimit === "number"
          ? (body as { userLimit: number }).userLimit
          : undefined;

    // Check if code already exists
    const existing = await Coupon.findOne({ code });
    if (existing) {
      throw new ValidationError({ code: ["This coupon code already exists"] });
    }

    const payload = Object.fromEntries(
      Object.entries(body as unknown as Record<string, unknown>).filter(
        ([key]) => key !== "userLimit" && key !== "excludedCategories",
      ),
    );
    if (payload.type === "free_shipping") {
      payload.value = 0;
    }

    const coupon = await Coupon.create({
      ...payload,
      code,
      perUserLimit,
      createdBy: session.user.id,
    });

    const auditContext = createAuditContext(request, session);
    await auditCreate(
      auditContext,
      "coupon",
      String(coupon._id),
      coupon.toObject() as unknown as Record<string, unknown>,
    );

    return successResponse(coupon, "Coupon created successfully", 201);
  },
);
