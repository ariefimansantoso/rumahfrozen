/**
 * Notification Model
 * In-app notifications for users
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export enum NotificationType {
  ORDER_PLACED = "order_placed",
  ORDER_STATUS = "order_status",
  ORDER_DELIVERED = "order_delivered",
  PAYMENT_RECEIVED = "payment_received",
  REVIEW_RECEIVED = "review_received",
  RETURN_REQUEST = "return_request",
  VENDOR_APPLICATION = "vendor_application",
  PRODUCT_LOW_STOCK = "product_low_stock",
  COUPON_APPLIED = "coupon_applied",
  SUPPORT_MESSAGE = "support_message",
  SYSTEM = "system",
}

const existingNotificationModel = mongoose.models.Notification as
  | Model<INotification>
  | undefined;
const existingNotificationTypePath = existingNotificationModel?.schema.path(
  "type",
) as
  | { enumValues?: string[] }
  | undefined;
if (
  existingNotificationModel &&
  !Object.values(NotificationType).every((type) =>
    existingNotificationTypePath?.enumValues?.includes(type),
  )
) {
  delete mongoose.models.Notification;
}

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    link: {
      type: String,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });

// Auto-delete old notifications after 30 days
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
