import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { CustomerProfile, Review } from "@/models";
import { successResponse } from "@/lib/api/response";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateQuery } from "@/lib/api/validate";
import { AdminReviewListQuerySchema } from "@/lib/validations";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/admin/reviews
 * Get all reviews for admin with stats and filtering.
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_REVIEWS, STAFF_PERMISSIONS.MANAGE_REVIEWS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:reviews:list",
      "lenient",
      session.user.role,
    );

    const {
      page,
      limit,
      search,
      status,
      rating,
      productId,
      hasReply,
      view,
      sortBy,
      sortOrder,
    } = validateQuery(request, AdminReviewListQuerySchema);

    await connectDB();

    const skip = (page - 1) * limit;

    const andConditions: Record<string, unknown>[] = [];

    const effectiveStatus =
      view === "published" || view === "on_hold" ? view : status;
    if (effectiveStatus && effectiveStatus !== "all") {
      andConditions.push({ isApproved: effectiveStatus === "published" });
    }

    const effectiveHasReply =
      view === "with_reply" ? "yes" : view === "no_reply" ? "no" : hasReply;
    if (effectiveHasReply === "yes") {
      andConditions.push({ "reply.comment": { $exists: true, $ne: "" } });
    } else if (effectiveHasReply === "no") {
      andConditions.push({
        $or: [{ reply: { $exists: false } }, { "reply.comment": { $in: [null, ""] } }],
      });
    }

    if (rating !== undefined && rating !== "all") {
      andConditions.push({ rating: Number(rating) });
    }

    if (productId) {
      andConditions.push({ productId: new mongoose.Types.ObjectId(productId) });
    }

    if (search) {
      andConditions.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { comment: { $regex: search, $options: "i" } },
        ],
      });
    }

    const query: Record<string, unknown> =
      andConditions.length > 0 ? { $and: andConditions } : {};

    const allowedSortFields = new Set(["createdAt", "rating", "isApproved"]);
    const effectiveSortBy =
      sortBy && allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [effectiveSortBy]: sortDirection };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [reviews, total, statsAgg, weekDelta] = await Promise.all([
      Review.find(query)
        .populate("userId", "name email image")
        .populate("productId", "name slug images")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(query),
      Review.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
            rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
            rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
            rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
            rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
            rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
            published: {
              $sum: { $cond: [{ $eq: ["$isApproved", true] }, 1, 0] },
            },
            onHold: {
              $sum: { $cond: [{ $eq: ["$isApproved", false] }, 1, 0] },
            },
          },
        },
      ]),
      Review.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    ]);

    const reviewerIds = reviews
      .map((review) => {
        const user = review.userId as unknown;
        if (!user || typeof user !== "object") return null;
        return String((user as { _id?: unknown })._id || "");
      })
      .filter(Boolean);

    const customerProfiles =
      reviewerIds.length > 0
        ? await CustomerProfile.find({ userId: { $in: reviewerIds } })
            .select("_id userId")
            .lean()
        : [];

    const customerProfileByUserId = new Map(
      customerProfiles.map((profile) => [
        String(profile.userId),
        String(profile._id),
      ]),
    );

    const reviewsWithCustomerLinks = reviews.map((review) => {
      const user = review.userId as unknown;
      if (!user || typeof user !== "object") return review;

      const userId = String((user as { _id?: unknown })._id || "");
      const customerProfileId = customerProfileByUserId.get(userId);

      if (!customerProfileId) return review;

      return {
        ...review,
        userId: {
          ...(user as Record<string, unknown>),
          customerProfileId,
        },
      };
    });

    const s = statsAgg[0] || {
      averageRating: 0,
      totalReviews: 0,
      rating5: 0,
      rating4: 0,
      rating3: 0,
      rating2: 0,
      rating1: 0,
      published: 0,
      onHold: 0,
    };

    const totalPages = Math.ceil(total / limit) || 1;

    return successResponse({
      data: reviewsWithCustomerLinks,
      stats: {
        average: Math.round((s.averageRating || 0) * 100) / 100,
        total: s.totalReviews || 0,
        published: s.published || 0,
        onHold: s.onHold || 0,
        weekDelta: weekDelta || 0,
        breakdown: {
          5: s.rating5 || 0,
          4: s.rating4 || 0,
          3: s.rating3 || 0,
          2: s.rating2 || 0,
          1: s.rating1 || 0,
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  },
);
