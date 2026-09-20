import { mongoose } from "@/lib/db";
import { USER_ACCOUNT_STATUS, USER_ROLES } from "@/config/app.config";
import type { IUser, Address } from "@/types";
import type { Model } from "mongoose";

const { Schema, models, model } = mongoose;

type UserDoc = IUser & {
  password?: string;
};

/**
 * Address Sub-Schema
 */
const AddressSchema = new Schema<Address>(
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
    isDefault: { type: Boolean, default: false },
    label: { type: String, default: "home" },
  },
  { _id: false },
);

/**
 * User Schema
 */
const UserSchema = new Schema<UserDoc>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CUSTOMER,
    },
    roles: {
      type: [String],
      enum: Object.values(USER_ROLES),
      default: [USER_ROLES.CUSTOMER],
    },
    status: {
      type: String,
      enum: Object.values(USER_ACCOUNT_STATUS),
      default: USER_ACCOUNT_STATUS.ACTIVE,
    },
    phone: {
      type: String,
      trim: true,
    },
    addresses: {
      type: [AddressSchema],
      default: [],
    },
    // 2FA fields
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
    },
    emailVerifiedAt: {
      type: Date,
    },
    emailVerificationRequiredAt: {
      type: Date,
    },
    emailVerificationAudience: {
      type: String,
      enum: [USER_ROLES.CUSTOMER, USER_ROLES.VENDOR],
      default: USER_ROLES.CUSTOMER,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "user",
  },
);

// Indexes
UserSchema.index({ role: 1 });
UserSchema.index({ roles: 1 });

// Virtual for vendor profile
UserSchema.virtual("vendorProfile", {
  ref: "Vendor",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

export const User = ((models.User as Model<UserDoc> | undefined) ??
  model<UserDoc>("User", UserSchema, "user")) as Model<UserDoc>;
