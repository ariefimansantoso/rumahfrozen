import { mongoose } from "@/lib/db";
import type { Address } from "@/types";

const { Schema, models, model } = mongoose;

export type ShipmentStatus =
  | "draft"
  | "label_ready"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "cancelled";

export interface IShipment {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  vendorId?: mongoose.Types.ObjectId;
  subOrderId?: mongoose.Types.ObjectId;
  carrier: string;
  service?: string;
  trackingNumber: string;
  status: ShipmentStatus;
  source: "manual" | "carrier_api";
  shipFrom: Address;
  shipTo: Address;
  parcel: {
    weight?: number;
    weightUnit?: "g" | "kg" | "lb" | "oz";
    length?: number;
    width?: number;
    height?: number;
    dimensionUnit?: "cm" | "in";
  };
  label: {
    source: "internal" | "carrier";
    format: "pdf" | "zpl" | "png";
    storageKey?: string;
    checksum?: string;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<Address>(
  {
    fullName: String,
    firstName: String,
    lastName: String,
    street: { type: String, required: true },
    apartment: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: String,
  },
  { _id: false },
);

const ShipmentSchema = new Schema<IShipment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true, trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    subOrderId: { type: Schema.Types.ObjectId },
    carrier: { type: String, required: true, trim: true, maxlength: 100 },
    service: { type: String, trim: true, maxlength: 100 },
    trackingNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "label_ready",
        "shipped",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      default: "label_ready",
    },
    source: {
      type: String,
      enum: ["manual", "carrier_api"],
      default: "manual",
    },
    shipFrom: { type: AddressSchema, required: true },
    shipTo: { type: AddressSchema, required: true },
    parcel: {
      weight: { type: Number, min: 0 },
      weightUnit: { type: String, enum: ["g", "kg", "lb", "oz"] },
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      dimensionUnit: { type: String, enum: ["cm", "in"] },
    },
    label: {
      source: { type: String, enum: ["internal", "carrier"], required: true },
      format: { type: String, enum: ["pdf", "zpl", "png"], required: true },
      storageKey: String,
      checksum: String,
    },
    createdBy: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

ShipmentSchema.index({ orderId: 1, createdAt: -1 });
ShipmentSchema.index({ vendorId: 1, createdAt: -1 });
ShipmentSchema.index({ trackingNumber: 1, carrier: 1 });
ShipmentSchema.index(
  { orderId: 1, vendorId: 1, trackingNumber: 1 },
  { unique: true },
);

export const Shipment =
  models.Shipment || model<IShipment>("Shipment", ShipmentSchema);

