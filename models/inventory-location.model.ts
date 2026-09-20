import { mongoose } from "@/lib/db";
import type { IInventoryLocation } from "@/types";

const { Schema, models, model } = mongoose;

const InventoryLocationSchema = new Schema<IInventoryLocation>(
  {
    name: {
      type: String,
      required: [true, "Location name is required"],
      trim: true,
      maxlength: [100, "Location name cannot exceed 100 characters"],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one default location
InventoryLocationSchema.pre("save", async function () {
  if (this.isDefault) {
    await (this.constructor as typeof InventoryLocation).updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
});

// Index for faster queries
InventoryLocationSchema.index({ isActive: 1 });
InventoryLocationSchema.index({ isDefault: 1 });

export const InventoryLocation =
  models.InventoryLocation ||
  model<IInventoryLocation>("InventoryLocation", InventoryLocationSchema);
