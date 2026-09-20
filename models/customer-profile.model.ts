import { mongoose } from "@/lib/db";
import type { ICustomerProfile } from "@/types";
import type { Model } from "mongoose";

const { Schema, models, model } = mongoose;

/**
 * Email Notification Preferences Sub-Schema
 */
const EmailNotificationsSchema = new Schema(
  {
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false },
    newsletter: { type: Boolean, default: false },
    priceDrops: { type: Boolean, default: false },
    backInStock: { type: Boolean, default: false },
  },
  { _id: false },
);

const CustomerShippingAddressSchema = new Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    apartment: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String },
    isDefault: { type: Boolean, default: true },
    label: { type: String, default: "home" },
  },
  { _id: false },
);

/**
 * Customer Stats Cache Sub-Schema
 */
const CustomerStatsSchema = new Schema(
  {
    totalOrders: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    averageOrderValue: { type: Number, default: 0, min: 0 },
    lastOrderDate: { type: Date },
    totalReviews: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, min: 0, max: 5 },
    totalWishlistItems: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

/**
 * Loyalty Tiers
 */
const LOYALTY_TIERS = ["bronze", "silver", "gold", "platinum"] as const;

/**
 * Customer Profile Schema
 * Stores customer-specific data separate from core User model:
 * loyalty, preferences, marketing settings, cached stats, and segmentation
 */
const CustomerProfileSchema = new Schema<ICustomerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Loyalty & Rewards
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    loyaltyTier: {
      type: String,
      enum: LOYALTY_TIERS,
      default: "bronze",
    },
    lifetimePoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Shopping Preferences
    preferredPaymentMethod: { type: String },
    preferredCurrency: { type: String },
    preferredLanguage: { type: String },
    preferredCategories: [
      { type: Schema.Types.ObjectId, ref: "Category" },
    ],
    sizePreferences: { type: Schema.Types.Mixed },

    // Marketing & Communication
    marketingOptIn: {
      type: Boolean,
      default: false,
    },
    emailNotifications: {
      type: EmailNotificationsSchema,
      default: () => ({}),
    },

    // Cached Stats
    stats: {
      type: CustomerStatsSchema,
      default: () => ({}),
    },

    // Segmentation
    tags: { type: [String], default: [] },
    notes: { type: String, maxlength: 2000 },

    // Acquisition
    acquisitionSource: { type: String },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    shippingAddress: { type: CustomerShippingAddressSchema },

    // Activity
    lastActiveAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
CustomerProfileSchema.index({ loyaltyTier: 1 });
CustomerProfileSchema.index({ "stats.totalSpent": -1 });
CustomerProfileSchema.index({ tags: 1 });
CustomerProfileSchema.index({ lastActiveAt: -1 });

// Virtual for user
CustomerProfileSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

export const CustomerProfile: Model<ICustomerProfile> =
  models.CustomerProfile ||
  model<ICustomerProfile>("CustomerProfile", CustomerProfileSchema);
