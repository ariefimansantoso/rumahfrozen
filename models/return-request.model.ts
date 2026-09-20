import { mongoose } from "@/lib/db";
import {
  OPEN_RETURN_STATUSES,
  RETURN_REFUND_STATUS,
  RETURN_STATUS,
  type ReturnRefundStatus,
  type ReturnStatus,
} from "@/lib/returns";

const { Schema, models, model } = mongoose;

export interface ReturnRequestItem {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  orderItemIndex: number;
  name: string;
  sku: string;
  quantityOrdered: number;
  quantityRequested: number;
  quantityApproved: number;
  quantityReceived: number;
  unitPrice: number;
  image?: string;
  condition?: "new" | "opened" | "damaged" | "missing_parts" | "unusable";
  restockable?: boolean;
}

export interface ReturnRequestRefundEstimate {
  itemsSubtotal: number;
  shipping: number;
  tax: number;
  discountAdjustment: number;
  restockingFee: number;
  returnShippingFee: number;
  total: number;
  currency: string;
}

export interface IReturnRequest {
  _id: mongoose.Types.ObjectId;
  returnNumber: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  ownerType: "admin" | "vendor";
  ownerVendorId?: mongoose.Types.ObjectId;
  vendorIds: mongoose.Types.ObjectId[];
  status: ReturnStatus;
  refundStatus: ReturnRefundStatus;
  reason: string;
  customerNote?: string;
  adminNote?: string;
  rejectionReason?: string;
  items: ReturnRequestItem[];
  estimatedRefund: ReturnRequestRefundEstimate;
  actualRefund?: {
    amount?: number;
    paymentTransactionId?: mongoose.Types.ObjectId;
    provider?: string;
    externalRefundId?: string;
  };
  shipment?: {
    carrier?: string;
    trackingNumber?: string;
    labelUrl?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
  };
  createdBy: string;
  updatedBy?: string;
  requestedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  receivedAt?: Date;
  inspectedAt?: Date;
  refundedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnRequestItemSchema = new Schema<ReturnRequestItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    orderItemIndex: { type: Number, required: true, min: 0 },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    quantityOrdered: { type: Number, required: true, min: 1 },
    quantityRequested: { type: Number, required: true, min: 1 },
    quantityApproved: { type: Number, required: true, min: 0, default: 0 },
    quantityReceived: { type: Number, required: true, min: 0, default: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    image: { type: String },
    condition: {
      type: String,
      enum: ["new", "opened", "damaged", "missing_parts", "unusable"],
    },
    restockable: { type: Boolean, default: false },
  },
  { _id: false },
);

const RefundEstimateSchema = new Schema<ReturnRequestRefundEstimate>(
  {
    itemsSubtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    discountAdjustment: { type: Number, required: true, min: 0, default: 0 },
    restockingFee: { type: Number, required: true, min: 0, default: 0 },
    returnShippingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, default: "USD" },
  },
  { _id: false },
);

const ReturnRequestSchema = new Schema<IReturnRequest>(
  {
    returnNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    orderNumber: { type: String, required: true, trim: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ownerType: {
      type: String,
      enum: ["admin", "vendor"],
      default: "admin",
      index: true,
    },
    ownerVendorId: { type: Schema.Types.ObjectId, ref: "Vendor", index: true },
    vendorIds: [{ type: Schema.Types.ObjectId, ref: "Vendor", index: true }],
    status: {
      type: String,
      enum: Object.values(RETURN_STATUS),
      default: RETURN_STATUS.REQUESTED,
      index: true,
    },
    refundStatus: {
      type: String,
      enum: Object.values(RETURN_REFUND_STATUS),
      default: RETURN_REFUND_STATUS.PENDING,
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 100 },
    customerNote: { type: String, trim: true, maxlength: 1000 },
    adminNote: { type: String, trim: true, maxlength: 2000 },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    items: { type: [ReturnRequestItemSchema], required: true },
    estimatedRefund: { type: RefundEstimateSchema, required: true },
    actualRefund: {
      amount: { type: Number, min: 0 },
      paymentTransactionId: { type: Schema.Types.ObjectId, ref: "PaymentTransaction" },
      provider: { type: String, trim: true },
      externalRefundId: { type: String, trim: true },
    },
    shipment: {
      carrier: { type: String, trim: true, maxlength: 100 },
      trackingNumber: { type: String, trim: true, maxlength: 100 },
      labelUrl: { type: String, trim: true },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
    },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now, index: true },
    approvedAt: Date,
    rejectedAt: Date,
    receivedAt: Date,
    inspectedAt: Date,
    refundedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

ReturnRequestSchema.index({ customerId: 1, createdAt: -1 });
ReturnRequestSchema.index({ orderId: 1, status: 1 });
ReturnRequestSchema.index({ vendorIds: 1, createdAt: -1 });
ReturnRequestSchema.index({ ownerType: 1, ownerVendorId: 1, createdAt: -1 });

export const ReturnRequest =
  models.ReturnRequest ||
  model<IReturnRequest>("ReturnRequest", ReturnRequestSchema);

export function getOpenReturnStatusFilter() {
  return { $in: OPEN_RETURN_STATUSES };
}
