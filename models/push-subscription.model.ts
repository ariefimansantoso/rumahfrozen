/**
 * Browser Push Subscription Model
 * Stores per-browser Web Push endpoints for authenticated users.
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPushSubscription extends Document {
  userId: string;
  role?: string;
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  locale?: string;
  userAgent?: string;
  isActive: boolean;
  lastSeenAt: Date;
  failedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
    },
    endpoint: {
      type: String,
      required: true,
    },
    expirationTime: {
      type: Number,
      default: null,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
    locale: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: () => new Date(),
    },
    failedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

PushSubscriptionSchema.index({ userId: 1, isActive: 1, updatedAt: -1 });
PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

export const PushSubscription: Model<IPushSubscription> =
  mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>(
    "PushSubscription",
    PushSubscriptionSchema,
  );
