import { mongoose } from "@/lib/db";

const { Schema, models, model } = mongoose;

export const PAYOUT_STATUSES = [
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
] as const;

const PayoutSchema = new Schema(
  {
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
      index: true,
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "USD",
    },
    orderIds: {
      type: [Schema.Types.ObjectId],
      ref: "Order",
      default: [],
    },
    grossSales: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    adjustments: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: PAYOUT_STATUSES,
      default: "pending",
      index: true,
    },
    paidAt: {
      type: Date,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    paidBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

PayoutSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
PayoutSchema.index({ periodStart: 1, periodEnd: 1 });

export const Payout = models.Payout || model("Payout", PayoutSchema);
