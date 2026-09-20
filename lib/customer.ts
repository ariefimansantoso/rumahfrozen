import { connectDB } from "@/lib/db";
import { CustomerProfile, Order, Review, Wishlist } from "@/models";
import type { LoyaltyTier, CustomerStats } from "@/types";
import { Types } from "mongoose";

/**
 * Loyalty tier thresholds based on lifetime points
 */
export const LOYALTY_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
} as const;

/**
 * Compute the loyalty tier based on lifetime points earned
 */
export function computeLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= LOYALTY_THRESHOLDS.platinum) return "platinum";
  if (lifetimePoints >= LOYALTY_THRESHOLDS.gold) return "gold";
  if (lifetimePoints >= LOYALTY_THRESHOLDS.silver) return "silver";
  return "bronze";
}

/**
 * Compute loyalty points earned from an order total (1 point per dollar)
 */
export function computePointsFromOrder(orderTotal: number): number {
  return Math.floor(orderTotal);
}

/**
 * Ensure a customer profile exists for the given userId.
 * Creates one with defaults if it doesn't exist, then runs an initial stats refresh.
 */
export async function ensureCustomerProfile(userId: string) {
  await connectDB();

  let profile = await CustomerProfile.findOne({ userId }).lean();
  if (!profile) {
    profile = (
      await CustomerProfile.create({ userId: new Types.ObjectId(userId) })
    ).toObject();
    // Backfill stats for users who may already have orders/reviews/wishlists
    await refreshCustomerStats(userId);
    profile = await CustomerProfile.findOne({ userId }).lean();
  }
  return profile;
}

/**
 * Recompute and update cached stats from source collections (Order, Review, Wishlist).
 * Called after order completion, review creation, wishlist changes, etc.
 * Uses aggregation pipelines for efficiency.
 */
export async function refreshCustomerStats(userId: string) {
  await connectDB();

  const userObjectId = new Types.ObjectId(userId);

  const [orderStats, reviewStats, wishlist] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          customerId: userObjectId,
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
          averageOrderValue: { $avg: "$total" },
          lastOrderDate: { $max: "$createdAt" },
        },
      },
    ]),
    Review.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
    ]),
    Wishlist.findOne({ userId }),
  ]);

  const orderData = orderStats[0] || {
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    lastOrderDate: null,
  };
  const reviewData = reviewStats[0] || {
    totalReviews: 0,
    averageRating: null,
  };

  const stats: CustomerStats = {
    totalOrders: orderData.totalOrders,
    totalSpent: Math.round(orderData.totalSpent * 100) / 100,
    averageOrderValue: Math.round(orderData.averageOrderValue * 100) / 100,
    lastOrderDate: orderData.lastOrderDate,
    totalReviews: reviewData.totalReviews,
    averageRating: reviewData.averageRating
      ? Math.round(reviewData.averageRating * 10) / 10
      : undefined,
    totalWishlistItems: wishlist?.items?.length || 0,
  };

  await CustomerProfile.findOneAndUpdate(
    { userId },
    { $set: { stats, lastActiveAt: new Date() } },
    { upsert: true },
  );

  return stats;
}

/**
 * Add loyalty points after an order is delivered/paid.
 * Automatically recomputes the loyalty tier.
 */
export async function addLoyaltyPoints(userId: string, orderTotal: number) {
  const points = computePointsFromOrder(orderTotal);
  if (points <= 0) return;

  await connectDB();

  const profile = await CustomerProfile.findOneAndUpdate(
    { userId },
    {
      $inc: { loyaltyPoints: points, lifetimePoints: points },
    },
    { new: true, upsert: true },
  );

  if (profile) {
    const newTier = computeLoyaltyTier(profile.lifetimePoints);
    if (newTier !== profile.loyaltyTier) {
      await CustomerProfile.updateOne(
        { userId },
        { $set: { loyaltyTier: newTier } },
      );
    }
  }
}
