import { mongoose } from "@/lib/db";
import {
  STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  ALL_STAFF_PERMISSIONS,
} from "@/config/permissions.config";
import type { Types } from "mongoose";
import type { StaffPermission } from "@/config/permissions.config";
import type { StaffAccessScope } from "@/lib/staff-scope";

const { Schema, models, model } = mongoose;

export interface IStaffProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  permissions: StaffPermission[];
  vendorIds?: Types.ObjectId[];
  locationIds?: string[];
  fulfillmentRegions?: string[];
  assignedBy: Types.ObjectId;
  department?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StaffProfileSchema = new Schema<IStaffProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    permissions: {
      type: [String],
      enum: Object.values(STAFF_PERMISSIONS),
      default: DEFAULT_STAFF_PERMISSIONS,
    },
    vendorIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Vendor" }],
      default: [],
    },
    locationIds: {
      type: [String],
      default: [],
      set: (values: unknown[]) =>
        Array.isArray(values)
          ? values.map((value) => String(value).trim()).filter(Boolean)
          : [],
    },
    fulfillmentRegions: {
      type: [String],
      default: [],
      set: (values: unknown[]) =>
        Array.isArray(values)
          ? values.map((value) => String(value).trim()).filter(Boolean)
          : [],
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

StaffProfileSchema.index({ isActive: 1 });
StaffProfileSchema.index({ assignedBy: 1 });
StaffProfileSchema.index({ vendorIds: 1 });
StaffProfileSchema.index({ locationIds: 1 });

StaffProfileSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

StaffProfileSchema.methods.hasPermission = function (
  permission: StaffPermission,
): boolean {
  if (!this.isActive) return false;
  return this.permissions.includes(permission);
};

StaffProfileSchema.methods.getAllPermissions = function (): StaffPermission[] {
  if (!this.isActive) return [];
  return this.permissions;
};

StaffProfileSchema.methods.getScope = function (): StaffAccessScope {
  return {
    vendorIds: Array.isArray(this.vendorIds)
      ? this.vendorIds.map((id: Types.ObjectId) => id.toString())
      : [],
    locationIds: Array.isArray(this.locationIds) ? this.locationIds : [],
    fulfillmentRegions: Array.isArray(this.fulfillmentRegions)
      ? this.fulfillmentRegions
      : [],
  };
};

export const StaffProfile =
  models.StaffProfile ||
  model<IStaffProfile>("StaffProfile", StaffProfileSchema);

export { ALL_STAFF_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS };
