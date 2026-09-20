import { mongoose } from "@/lib/db";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/config/app.config";
import type { IOrder, OrderItem, SubOrder, Address } from "@/types";

const { Schema, models, model } = mongoose;

/**
 * Address Sub-Schema
 */
const AddressSchema = new Schema<Address>(
  {
    fullName: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    street: { type: String, required: true },
    apartment: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String },
  },
  { _id: false }
);

/**
 * Order Item Sub-Schema
 */
const OrderItemSchema = new Schema<OrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    image: {
      type: String,
    },
    purchaseType: {
      type: String,
      enum: ["standard", "preorder"],
      default: "standard",
    },
    preorderReleaseDate: {
      type: Date,
    },
    preorderMessage: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    preorderStatus: {
      type: String,
      enum: [
        "reserved",
        "payment_due",
        "delayed",
        "partially_ready",
        "ready",
        "fulfilled",
        "cancelled",
        "expired",
      ],
    },
    preorderPaymentMode: {
      type: String,
      enum: ["full", "deposit", "pay_later"],
    },
    preorderDepositAmount: {
      type: Number,
      min: 0,
    },
    preorderOutstandingAmount: {
      type: Number,
      min: 0,
    },
    preorderSupplierEta: {
      type: Date,
    },
    preorderBatchName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    customs: {
      countryOfOrigin: { type: String, trim: true },
      hsCode: { type: String, trim: true },
      description: { type: String, trim: true, maxlength: 500 },
      weight: { type: Number, min: 0 },
      weightUnit: { type: String, enum: ["g", "kg", "lb", "oz"] },
    },
    // Per-line discount (applied before any order-level discount)
    lineDiscount: {
      type: {
        type: String,
        enum: ["percent", "amount"],
      },
      value: { type: Number, min: 0 },
      amount: { type: Number, min: 0, default: 0 },
    },
    // Per-line note attached by the cashier
    lineNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

/**
 * Sub-Order Schema (for multi-vendor order splitting)
 */
const SubOrderSchema = new Schema<SubOrder>({
  vendorId: {
    type: Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
  },
  items: {
    type: [OrderItemSchema],
    default: [],
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  commission: {
    type: Number,
    required: true,
    min: 0,
  },
  vendorEarnings: {
    type: Number,
    required: true,
    min: 0,
  },
  // Shipping charged for this vendor's shipment. In multi-vendor carts each
  // sub-order is rated independently and the order-level shippingCost is the
  // sum of these.
  shippingCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  shippingMethod: {
    name: { type: String },
    optionId: { type: String },
    minDays: { type: Number },
    maxDays: { type: Number },
  },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING,
  },
  trackingNumber: {
    type: String,
  },
  shippedAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  // True while this sub-order's items currently hold a reservation against
  // product stock. Set to true after a successful decrement, flipped back to
  // false (atomically) when its inventory has been restored. Cancel/refund
  // paths use this to avoid double-restoring or restoring a sub-order that
  // never decremented in the first place (e.g., abandoned PayPal orders).
  inventoryReserved: {
    type: Boolean,
    default: false,
  },
  preorderReserved: {
    type: Boolean,
    default: false,
  },
  payoutStatus: {
    type: String,
    enum: ["unpaid", "scheduled", "paid"],
    default: "unpaid",
    index: true,
  },
  payoutId: {
    type: Schema.Types.ObjectId,
    ref: "Payout",
  },
  payoutDate: {
    type: Date,
  },
});

/**
 * Order Schema
 */
const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
    },
    subOrders: {
      type: [SubOrderSchema],
      default: [],
    },
    shippingAddress: {
      type: AddressSchema,
      required: true,
    },
    billingAddress: {
      type: AddressSchema,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentId: {
      type: String,
    },
    stripeSessionId: {
      type: String,
    },
    stripePaymentIntentId: {
      type: String,
    },
    paypalOrderId: {
      type: String,
      index: true,
    },
    paypalCaptureId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    paystackReference: {
      type: String,
      index: true,
    },
    paystackTransactionId: {
      type: String,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Selected shipping method for single-shipment orders. Multi-vendor orders
    // additionally carry a per-subOrder shippingMethod.
    shippingMethod: {
      name: { type: String },
      optionId: { type: String },
      minDays: { type: Number },
      maxDays: { type: Number },
    },
    // Import duties/customs collected at checkout (DDP) or deferred to the
    // customer on delivery (DDU/DAP).
    customs: {
      dutyAmount: { type: Number, default: 0, min: 0 },
      dutyMode: { type: String, enum: ["DDP", "DDU"] },
      international: { type: Boolean, default: false },
      collectedAtCheckout: { type: Boolean, default: false },
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountMeta: {
      source: {
        type: String,
        enum: ["pos", "coupon", "manual", "other"],
        default: "pos",
      },
      type: {
        type: String,
        enum: ["percent", "amount"],
      },
      value: {
        type: Number,
        min: 0,
      },
      reason: {
        type: String,
        trim: true,
      },
      note: {
        type: String,
        trim: true,
      },
    },
    coupon: {
      code: {
        type: String,
        uppercase: true,
        trim: true,
      },
      type: {
        type: String,
      },
      value: {
        type: Number,
        min: 0,
      },
      couponId: {
        type: Schema.Types.ObjectId,
        ref: "Coupon",
      },
      // Set to true once the coupon's usedCount has actually been
      // incremented for this order. Used to gate decrementing on
      // cancel/refund so we never under- or over-count usage.
      usageIncremented: {
        type: Boolean,
        default: false,
      },
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    hasPreorder: {
      type: Boolean,
      default: false,
      index: true,
    },
    preorderStatus: {
      type: String,
      enum: [
        "reserved",
        "payment_due",
        "delayed",
        "partially_ready",
        "ready",
        "fulfilled",
        "cancelled",
        "expired",
      ],
      index: true,
    },
    preorderReleaseDate: {
      type: Date,
      index: true,
    },
    preorderReserved: {
      type: Boolean,
      default: false,
    },
    preorderAcknowledgedAt: {
      type: Date,
    },
    preorderPaymentMode: {
      type: String,
      enum: ["full", "deposit", "pay_later"],
    },
    preorderDepositAmount: {
      type: Number,
      min: 0,
    },
    preorderOutstandingAmount: {
      type: Number,
      min: 0,
    },
    preorderOriginalReleaseDate: {
      type: Date,
    },
    preorderDelayReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    preorderReleaseDateUpdatedAt: {
      type: Date,
    },
    preorderCustomerNotifiedAt: {
      type: Date,
    },
    channel: {
      type: String,
      enum: ["online", "pos"],
      default: "online",
      index: true,
    },
    posLocationId: {
      type: String,
      index: true,
    },
    staffId: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    trackingNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    carrier: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    processingAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    statusChangedBy: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ customerId: 1, "coupon.code": 1 });
OrderSchema.index({ "subOrders.vendorId": 1 });
OrderSchema.index({ channel: 1, posLocationId: 1 });

// One order per Stripe payment. Partial so the many orders without a Stripe
// id (COD/POS/other gateways, or empty-string values) do not collide. This
// makes finalizeStripe*Order's duplicate-key (11000) guard effective and
// prevents the webhook + /verify fallback from racing into two orders for
// one payment.
OrderSchema.index(
  { stripePaymentIntentId: 1 },
  {
    unique: true,
    partialFilterExpression: { stripePaymentIntentId: { $gt: "" } },
  },
);
OrderSchema.index(
  { stripeSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { stripeSessionId: { $gt: "" } },
  },
);

// Virtual for customer
OrderSchema.virtual("customer", {
  ref: "User",
  localField: "customerId",
  foreignField: "_id",
  justOne: true,
});

export const Order = models.Order || model<IOrder>("Order", OrderSchema);
