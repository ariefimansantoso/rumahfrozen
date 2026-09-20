import { mongoose } from "@/lib/db";

const { Schema, models, model } = mongoose;

export const PAYMENT_TRANSACTION_TYPES = [
  "charge",
  "refund",
  "adjustment",
] as const;

export const PAYMENT_TRANSACTION_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
] as const;

const PaymentTransactionSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      index: true,
    },
    payoutId: {
      type: Schema.Types.ObjectId,
      ref: "Payout",
      index: true,
    },
    type: {
      type: String,
      enum: PAYMENT_TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: PAYMENT_TRANSACTION_STATUSES,
      required: true,
      default: "succeeded",
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      lowercase: true,
      default: "manual",
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      lowercase: true,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "USD",
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    feeAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
    },
    refundedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    externalId: {
      type: String,
      trim: true,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

PaymentTransactionSchema.index({ createdAt: -1 });
PaymentTransactionSchema.index({ type: 1, status: 1, createdAt: -1 });
PaymentTransactionSchema.index({ vendorId: 1, createdAt: -1 });

export const PaymentTransaction =
  models.PaymentTransaction ||
  model("PaymentTransaction", PaymentTransactionSchema);
