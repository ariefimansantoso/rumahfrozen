import { mongoose } from "@/lib/db";
import { VENDOR_STATUS } from "@/config/app.config";
import { DEFAULT_VENDOR_PERMISSIONS, VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IVendor, Address, BankDetails } from "@/types";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";

const { Schema, models, model } = mongoose;
const existingVendorModel = models.Vendor as typeof models.Vendor | undefined;
if (
  existingVendorModel &&
  (!existingVendorModel.schema.path("permissions") ||
    !existingVendorModel.schema.path("shareSettings"))
) {
  delete models.Vendor;
}

/**
 * Address Sub-Schema
 * All fields are optional to support partial address input
 */
const AddressSchema = new Schema<Address>(
  {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

/**
 * Bank Details Sub-Schema
 * All fields are optional to support partial bank details input
 */
const BankDetailsSchema = new Schema<BankDetails>(
  {
    accountName: { type: String },
    accountNumber: { type: String },
    bankName: { type: String },
    routingNumber: { type: String },
    swiftCode: { type: String },
  },
  { _id: false },
);

/**
 * Social Links Sub-Schema
 */
const SocialLinksSchema = new Schema(
  {
    website: { type: String },
    facebook: { type: String },
    instagram: { type: String },
    twitter: { type: String },
  },
  { _id: false },
);

const CustomShareButtonSchema = new Schema(
  {
    id: { type: String },
    label: { type: String },
    urlTemplate: { type: String },
    enabled: { type: Boolean, default: true },
    icon: { type: String },
  },
  { _id: false },
);

const VendorShareSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    copyLink: { type: Boolean, default: true },
    facebook: { type: Boolean, default: true },
    twitter: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
    telegram: { type: Boolean, default: false },
    pinterest: { type: Boolean, default: false },
    linkedin: { type: Boolean, default: false },
    email: { type: Boolean, default: true },
    custom: { type: [CustomShareButtonSchema], default: [] },
  },
  { _id: false },
);

const VendorNotificationPreferencesSchema = new Schema(
  {
    newOrders: { type: Boolean, default: true },
    orderUpdates: { type: Boolean, default: true },
    lowStock: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
  },
  { _id: false },
);

const VendorPayoutSettingsSchema = new Schema(
  {
    schedule: {
      type: String,
      enum: ["weekly", "biweekly", "monthly"],
      default: "weekly",
    },
    minimumAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

/**
 * Per-vendor shipping profile. Mirrors the platform shipping shape (zones,
 * rates, fallback, local pickup) so the shared engine can rate a vendor's
 * items against their own rules when admin enables vendor shipping.
 */
const VendorShippingRateSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["flat", "free_over", "subtotal_range", "weight_range"],
      default: "flat",
    },
    price: { type: Number, default: 0 },
    freeOver: Number,
    minSubtotal: Number,
    maxSubtotal: Number,
    minWeight: Number,
    maxWeight: Number,
    pricePerWeightUnit: Number,
    minDays: Number,
    maxDays: Number,
    active: { type: Boolean, default: true },
  },
  { _id: false },
);

const VendorShippingZoneSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    countries: { type: [String], default: [] },
    regions: { type: [String], default: [] },
    rates: { type: [VendorShippingRateSchema], default: [] },
  },
  { _id: false },
);

const VendorShippingSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    weightUnit: { type: String, enum: ["kg", "lb"], default: "kg" },
    origin: {
      type: new Schema(
        {
          country: { type: String, default: "" },
          state: String,
          city: String,
          postalCode: String,
          address1: String,
          address2: String,
        },
        { _id: false },
      ),
      default: undefined,
    },
    delivery: {
      type: new Schema(
        {
          processingDaysMin: { type: Number, default: 0 },
          processingDaysMax: { type: Number, default: 0 },
          showEstimatedDelivery: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    zones: { type: [VendorShippingZoneSchema], default: [] },
    fallbackRate: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          name: { type: String, default: "Standard" },
          price: { type: Number, default: 0 },
          minDays: Number,
          maxDays: Number,
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    localPickup: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          pickupAddress: String,
          instructions: String,
          readyInDaysMin: Number,
          readyInDaysMax: Number,
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { _id: false },
);

/**
 * Vendor Schema
 */
const VendorSchema = new Schema<IVendor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    storeName: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
      maxlength: [100, "Store name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    logo: {
      type: String,
    },
    banner: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(VENDOR_STATUS),
      default: VENDOR_STATUS.PENDING,
    },
    commission: {
      type: Number,
      default: DEFAULT_VENDOR_COMMISSION_RATE,
      min: [0, "Commission cannot be negative"],
      max: [100, "Commission cannot exceed 100%"],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalSales: {
      type: Number,
      default: 0,
      min: 0,
    },
    permissions: {
      type: [String],
      enum: Object.values(VENDOR_PERMISSIONS),
      default: DEFAULT_VENDOR_PERMISSIONS,
    },
    bankDetails: {
      type: BankDetailsSchema,
    },
    address: {
      type: AddressSchema,
    },
    socialLinks: {
      type: SocialLinksSchema,
    },
    shareSettings: {
      type: VendorShareSettingsSchema,
      default: () => ({}),
    },
    notificationPreferences: {
      type: VendorNotificationPreferencesSchema,
      default: () => ({}),
    },
    payoutSettings: {
      type: VendorPayoutSettingsSchema,
      default: () => ({}),
    },
    shipping: {
      type: VendorShippingSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
VendorSchema.index({ status: 1 });
VendorSchema.index({ isDefault: 1 });
VendorSchema.index({ storeName: "text", description: "text" });

// Virtual for user
VendorSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

// Virtual for products
VendorSchema.virtual("products", {
  ref: "Product",
  localField: "_id",
  foreignField: "vendorId",
});

export const Vendor = models.Vendor || model<IVendor>("Vendor", VendorSchema);
