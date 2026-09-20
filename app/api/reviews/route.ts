import { connectDB, mongoose } from "@/lib/db";
import { Review, Product, Order } from "@/models";
import { successResponse } from "@/lib/api/response";
import { AuthenticationError, ValidationError } from "@/lib/api/errors";
import { rateLimitByIP, rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { recomputeProductRating } from "@/lib/reviews";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/reviews
 * Get reviews for a product
 */
export const GET = withApi(
  {},
  async ({ request }) => {
    rateLimitByIP(request, "lenient");
    await connectDB();

    const productId = request.nextUrl.searchParams.get("productId");
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") || "10",
      10
    );

    if (!productId) {
      throw new ValidationError({ productId: ["Product ID is required"] });
    }

    const skip = (page - 1) * limit;
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // Fetch the page of reviews and the rating breakdown in one round trip. The
    // aggregate already yields the total (totalReviews), so a separate
    // countDocuments over the same { productId, isApproved } set is redundant.
    const [reviews, stats] = await Promise.all([
      Review.find({ productId, isApproved: true })
        .select(
          "rating title comment images isVerified createdAt reply.comment reply.createdAt reply.updatedAt userId",
        )
        .populate("userId", "name image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.aggregate([
        {
          $match: {
            productId: productObjectId,
            isApproved: true,
          },
        },
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
          },
        },
      ]),
    ]);

    const ratingStats = stats[0] || {
      averageRating: 0,
      totalReviews: 0,
      rating5: 0,
      rating4: 0,
      rating3: 0,
      rating2: 0,
      rating1: 0,
    };

    const total = ratingStats.totalReviews;
    const totalPages = Math.ceil(total / limit);

    return successResponse({
      reviews,
      stats: {
        average: Math.round(ratingStats.averageRating * 10) / 10,
        total: ratingStats.totalReviews,
        breakdown: {
          5: ratingStats.rating5,
          4: ratingStats.rating4,
          3: ratingStats.rating3,
          2: ratingStats.rating2,
          1: ratingStats.rating1,
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

/**
 * POST /api/reviews
 * Create a new review (requires purchase)
 */
export const POST = withApi(
  { auth: "optional" },
  async ({ request, session }) => {
    if (!session) {
      rateLimitByIP(request, "moderate");
      throw new AuthenticationError();
    }

    rateLimitByUser(
      request,
      session.user.id,
      "reviews:create",
      "moderate",
      session.user.role,
    );

    await connectDB();

    const body = await request.json();
    const { productId, orderId, rating, title, comment, images } = body;

    // Validate required fields
    if (!productId)
      throw new ValidationError({ productId: ["Product ID is required"] });
    if (!orderId)
      throw new ValidationError({ orderId: ["Order ID is required"] });
    if (!rating || rating < 1 || rating > 5) {
      throw new ValidationError({ rating: ["Rating must be between 1 and 5"] });
    }
    if (!comment || comment.length < 10) {
      throw new ValidationError({
        comment: ["Comment must be at least 10 characters"],
      });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new ValidationError({ productId: ["Product not found"] });
    }

    // Verify order exists and belongs to user, and contains the product
    const order = await Order.findOne({
      _id: orderId,
      customerId: session.user.id,
      "items.productId": productId,
      status: { $in: ["delivered", "completed"] },
    });

    if (!order) {
      throw new ValidationError({
        orderId: ["You can only review products from completed orders"],
      });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      productId,
      userId: session.user.id,
      orderId,
    });

    if (existingReview) {
      throw new ValidationError({
        review: ["You have already reviewed this product for this order"],
      });
    }

    // Create review
    const review = await Review.create({
      productId,
      userId: session.user.id,
      orderId,
      rating,
      title: title || "",
      comment,
      images: images || [],
      isVerified: true, // Verified purchase
      isApproved: true, // Auto-approve for now
    });

    // Update product rating
    await recomputeProductRating(productId);

    // Update customer profile stats (fire-and-forget)
    import("@/lib/customer")
      .then(({ refreshCustomerStats }) =>
        refreshCustomerStats(session.user.id),
      )
      .catch((err) =>
        console.error("Failed to refresh customer stats:", err),
      );

    return successResponse(review, "Review created successfully", 201);
  },
);
