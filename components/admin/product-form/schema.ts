import { z } from "zod";
import type { ProductWeightUnit } from "@/lib/product-shipping";

/**
 * Shared schema, types, and small helpers for the product form.
 * The form component and its section cards all consume this module.
 */

export const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  shortDescription: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  brand: z.string().optional(),
  status: z.enum(["active", "draft", "unlisted"]),
  featured: z.boolean(),
  tags: z.array(z.string()),
  attributes: z
    .array(
      z.object({
        name: z.string().min(1, "Label is required"),
        value: z.string().min(1, "Value is required"),
      }),
    )
    .default([]),
  productType: z.string().optional(),
  collections: z.array(z.string()),
  collectionIds: z.array(z.string()),
  template: z.string().optional(),
  publishing: z.object({
    onlineStore: z.boolean(),
    pointOfSale: z.boolean(),
  }),
  pricing: z.object({
    price: z.number().min(0, "Price must be positive"),
    comparePrice: z.number().optional(),
    unitPrice: z
      .object({
        totalAmount: z.number().min(0).default(0),
        totalUnit: z.enum(["item", "g", "kg", "lb", "oz", "ml", "l", "dus"]),
        baseAmount: z.number().min(0).default(1),
        baseUnit: z.enum(["item", "g", "kg", "lb", "oz", "ml", "l", "dus"]),
      })
      .optional(),
    unitPriceUnit: z
      .enum(["none", "item", "g", "kg", "lb", "oz", "ml", "l", "dus"])
      .default("none"),
    cost: z.number().optional(),
    chargeTax: z.boolean(),
  }),
  inventory: z.object({
    sku: z.string().default(""),
    barcode: z.string().optional(),
    barcodeFormat: z
      .enum(["auto", "ean13", "upca", "gtin14", "code128"])
      .default("auto"),
    barcodeSource: z
      .enum(["unspecified", "manufacturer", "gs1", "internal"])
      .default("unspecified"),
    tracked: z.boolean(),
    quantity: z.number().min(0),
    continueSellingWhenOutOfStock: z.boolean(),
  }),
  preorder: z.object({
    enabled: z.boolean(),
    releaseDate: z.string().optional(),
    message: z.string().max(500).optional(),
    limit: z.number().min(0),
    reservedQuantity: z.number().min(0),
    preorderOnly: z.boolean(),
    autoConvert: z.boolean(),
    paymentMode: z.enum(["full", "deposit", "pay_later"]),
    depositType: z.enum(["percentage", "fixed"]),
    depositValue: z.number().min(0),
    supplierEta: z.string().optional(),
    batchName: z.string().max(120).optional(),
  }),
  shipping: z.object({
    isPhysicalProduct: z.boolean(),
    weight: z.number().optional(),
    weightUnit: z.enum(["g", "kg", "lb", "oz"]),
    countryOfOrigin: z.string().optional(),
    hsCode: z.string().optional(),
    customsDescription: z.string().optional(),
  }),
  seo: z.object({
    pageTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    handle: z.string().optional(),
  }),
});

export type ProductFormData = z.infer<typeof formSchema>;
export type UnitPriceDraft = ProductFormData["pricing"]["unitPrice"];
export type UnitPriceMeasureUnit = "item" | "g" | "kg" | "lb" | "oz" | "ml" | "l" | "dus";
export type UnitPriceSnapshot = {
  unitPrice: UnitPriceDraft;
  unitPriceUnit: ProductFormData["pricing"]["unitPriceUnit"];
};

export type CategoryVariantOption = {
  _id: string;
  name: string;
  position?: number;
  values: {
    _id: string;
    value: string;
    colorCode?: string;
    position?: number;
  }[];
};
export type Category = {
  _id: string;
  name: string;
  slug: string;
  path?: string[];
  isLeaf?: boolean;
  parentId?: string | null;
  // Reusable variant option template inherited by products in this category.
  options?: CategoryVariantOption[];
};
export type Brand = {
  _id: string;
  name: string;
  slug: string;
};
export type CollectionOption = { _id: string; title: string; slug: string };
export type CollectionIdValue = string | { _id?: string };
export type RawLocationInventory = { locationId?: unknown; quantity?: unknown };
export type RawPreorderSettings = {
  enabled?: unknown;
  releaseDate?: unknown;
  message?: unknown;
  limit?: unknown;
  reservedQuantity?: unknown;
  preorderOnly?: unknown;
  autoConvert?: unknown;
  paymentMode?: unknown;
  depositType?: unknown;
  depositValue?: unknown;
  supplierEta?: unknown;
  batchName?: unknown;
};
export type ShippingFormContext = {
  enabled: boolean;
  weightUnit: ProductWeightUnit;
  usesWeightRates: boolean;
  customsEnabled: boolean;
};

export function hasWeightRates(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const zones = (value as { zones?: unknown }).zones;
  if (!Array.isArray(zones)) return false;
  return zones.some((zone) => {
    const rates = (zone as { rates?: unknown })?.rates;
    return (
      Array.isArray(rates) &&
      rates.some(
        (rate) =>
          (rate as { type?: unknown; active?: unknown })?.type ===
            "weight_range" &&
          (rate as { active?: unknown }).active !== false,
      )
    );
  });
}

export function formatDateInputValue(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function getUnitGroup(unit: UnitPriceMeasureUnit) {
  if (unit === "item") return "item";
  if (unit === "g" || unit === "kg" || unit === "lb" || unit === "oz")
    return "weight";
  return "volume";
}

export function toReferenceAmount(amount: number, unit: UnitPriceMeasureUnit) {
  if (unit === "item") return amount;
  if (unit === "dus") return amount;
  if (unit === "g") return amount;
  if (unit === "kg") return amount * 1000;
  if (unit === "lb") return amount * 453.59237;
  if (unit === "oz") return amount * 28.349523125;
  if (unit === "ml") return amount;
  return amount * 1000;
}
