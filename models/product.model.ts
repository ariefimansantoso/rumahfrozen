import { mongoose } from "@/lib/db";
import { PRODUCT_STATUS } from "@/config/app.config";
import { generateBarcode, generateSku } from "@/lib/utils";
import {
  assignProductLookupCodes,
  findDuplicateBarcodeCodes,
} from "@/lib/products/barcode-normalization";
import type {
  IProduct,
  ProductAttribute,
  ProductMedia,
  ProductOption,
  ProductVariant,
} from "@/types";
import { normalizeProductShippingData } from "@/lib/product-shipping";

const { Schema, models, model } = mongoose;

function hasBarcode(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function rememberBarcode(used: Set<string>, value: unknown) {
  if (hasBarcode(value)) used.add(value.trim());
}

const ProductAttributeSchema = new Schema<ProductAttribute>(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const ProductMediaSchema = new Schema<ProductMedia>(
  {
    _id: { type: String, required: true },
    type: {
      type: String,
      enum: ["image", "video", "model"],
      default: "image",
      required: true,
    },
    url: { type: String, required: true },
    filename: { type: String, trim: true },
    alt: { type: String },
    position: { type: Number, default: 0 },
    mimeType: { type: String },
    thumbnailUrl: { type: String },
  },
  { _id: false }
);

// Option Value Schema (for individual option values like "Small", "Red")
const OptionValueSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: String, required: true, trim: true },
    colorCode: { type: String, trim: true },
    position: { type: Number, default: 0 },
  },
  { _id: false }
);

// Updated ProductOptionSchema with id, position, and structured values
const ProductOptionSchema = new Schema<ProductOption>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    values: { type: [OptionValueSchema], default: [] },
    position: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProductInventorySchema = new Schema(
  {
    tracked: { type: Boolean, default: true },
    quantity: { type: Number, default: 0, min: 0 },
    continueSellingWhenOutOfStock: { type: Boolean, default: false },
  },
  { _id: false }
);

const PreorderSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    releaseDate: { type: Date },
    message: { type: String, trim: true, maxlength: 500 },
    limit: { type: Number, min: 0, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    preorderOnly: { type: Boolean, default: false },
    autoConvert: { type: Boolean, default: true },
    paymentMode: {
      type: String,
      enum: ["full", "deposit", "pay_later"],
      default: "full",
    },
    depositType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    depositValue: { type: Number, min: 0, default: 0 },
    supplierEta: { type: Date },
    batchName: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

// Variant Option Value Schema (tracks which option/value combination a variant has)
const VariantOptionValueSchema = new Schema(
  {
    optionId: { type: String, required: true },
    optionName: { type: String },
    valueId: { type: String, required: true },
    value: { type: String, required: true },
    colorCode: { type: String, trim: true },
  },
  { _id: false }
);

const ProductVariantSchema = new Schema<ProductVariant>({
  name: { type: String, required: true },
  sku: { type: String, trim: true, uppercase: true },
  skuNormalized: { type: String, trim: true, uppercase: true },
  barcode: { type: String, trim: true },
  barcodeNormalized: { type: String, trim: true, uppercase: true },
  barcodeFormat: {
    type: String,
    enum: ["ean13", "upca", "gtin14", "code128"],
  },
  barcodeSource: {
    type: String,
    enum: ["manufacturer", "gs1", "internal"],
  },
  price: { type: Number, required: true, min: 0 },
  comparePrice: { type: Number, min: 0 },
  cost: { type: Number, min: 0 },
  taxable: { type: Boolean, default: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  attributes: { type: [ProductAttributeSchema], default: [] },
  image: { type: String },
  // Updated: structured option values instead of string array
  optionValues: { type: [VariantOptionValueSchema], default: [] },
  inventory: { type: ProductInventorySchema, default: undefined },
  locationInventory: {
    type: [
      new Schema(
        {
          locationId: { type: String, required: true },
          quantity: { type: Number, required: true, min: 0, default: 0 },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  preorder: { type: PreorderSettingsSchema, default: undefined },
  // Undefined inherits the product-level physical-product setting.
  requiresShipping: { type: Boolean },
  weight: { type: Number, min: 0 },
  weightUnit: { type: String, enum: ["g", "kg", "lb", "oz"] },
  mediaId: { type: String },
});

const ProductSchema = new Schema<IProduct>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    productSource: {
      type: String,
      enum: ["admin", "vendor"],
      required: true,
      default: "admin",
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Product title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    handle: {
      type: String,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [10000, "Description cannot exceed 10000 characters"],
    },
    shortDescription: {
      type: String,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    comparePrice: {
      type: Number,
      min: [0, "Compare price cannot be negative"],
    },
    priceRange: {
      type: new Schema(
        {
          min: { type: Number, min: 0 },
          max: { type: Number, min: 0 },
        },
        { _id: false }
      ),
      default: undefined,
    },
    compareAtPriceRange: {
      type: new Schema(
        {
          min: { type: Number, min: 0 },
          max: { type: Number, min: 0 },
        },
        { _id: false }
      ),
      default: undefined,
    },
    cost: {
      type: Number,
      min: [0, "Cost cannot be negative"],
    },
    unitPrice: {
      totalAmount: { type: Number, min: 0 },
      totalUnit: {
        type: String,
        enum: ["item", "g", "kg", "lb", "oz", "ml", "l", "dus"],
      },
      baseAmount: { type: Number, min: 0 },
      baseUnit: {
        type: String,
        enum: ["item", "g", "kg", "lb", "oz", "ml", "l", "dus"],
      },
    },
    unitPriceUnit: {
      type: String,
      enum: ["item", "g", "kg", "lb", "oz", "ml", "l", "dus"],
    },
    chargeTax: {
      type: Boolean,
      default: true,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    skuNormalized: {
      type: String,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    barcodeNormalized: {
      type: String,
      trim: true,
      uppercase: true,
    },
    barcodeFormat: {
      type: String,
      enum: ["ean13", "upca", "gtin14", "code128"],
    },
    barcodeSource: {
      type: String,
      enum: ["manufacturer", "gs1", "internal"],
    },
    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    locationInventory: {
      type: [
        new Schema(
          {
            locationId: { type: String, required: true },
            quantity: { type: Number, required: true, min: 0, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    media: {
      type: [ProductMediaSchema],
      default: [],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },
    productType: {
      type: String,
      trim: true,
    },
    collections: {
      type: [String],
      default: [],
    },
    collectionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Collection",
      },
    ],
    template: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    attributes: {
      type: [ProductAttributeSchema],
      default: [],
    },
    variants: {
      type: [ProductVariantSchema],
      default: [],
    },
    preorder: { type: PreorderSettingsSchema, default: undefined },
    options: {
      type: [ProductOptionSchema],
      default: [],
    },
    seo: {
      pageTitle: { type: String, trim: true },
      metaDescription: { type: String, trim: true, maxlength: 1000 },
      handle: { type: String, lowercase: true, trim: true },
    },
    publishing: {
      onlineStore: { type: Boolean, default: true },
      pointOfSale: { type: Boolean, default: false },
    },
    shipping: {
      isPhysicalProduct: { type: Boolean, default: true },
      weight: { type: Number, min: 0 },
      weightUnit: {
        type: String,
        enum: ["g", "kg", "lb", "oz"],
        default: "kg",
      },
      countryOfOrigin: { type: String, trim: true },
      hsCode: { type: String, trim: true },
      customsDescription: { type: String, trim: true, maxlength: 500 },
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.DRAFT,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ProductSchema.index({ slug: 1, vendorId: 1 }, { unique: true });
ProductSchema.index({ vendorId: 1 });
ProductSchema.index({ productSource: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ brand: 1 });
// { createdAt: -1 } is kept intentionally: the admin product list sorts by
// createdAt WITHOUT a status filter (status is optional), so the status-led
// compounds below cannot serve it.
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ collectionIds: 1 });
// Compound indexes matching storefront query shapes: every storefront listing
// filters on status and then sorts (createdAt / price / rating) or filters by
// category. These let MongoDB satisfy the filter + sort from a single index
// instead of an in-memory sort over the status-matched set.
//
// These supersede the former single-field { status }, { featured } and
// { price } indexes (each was only ever queried alongside status), which were
// removed here and are dropped from existing databases by
// scripts/migrate-product-review-indexes.mjs.
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ status: 1, featured: 1, createdAt: -1 });
ProductSchema.index({ status: 1, price: 1 });
ProductSchema.index({ status: 1, rating: -1, reviewCount: -1 });
ProductSchema.index({ status: 1, category: 1, createdAt: -1 });
ProductSchema.index({ "preorder.enabled": 1, "preorder.releaseDate": 1 });
ProductSchema.index({ "variants.preorder.enabled": 1, "variants.preorder.releaseDate": 1 });
ProductSchema.index({ barcodeNormalized: 1 });
ProductSchema.index({ skuNormalized: 1 });
ProductSchema.index({ "variants.barcodeNormalized": 1 });
ProductSchema.index({ "variants.skuNormalized": 1 });
ProductSchema.index({
  name: "text",
  title: "text",
  description: "text",
  tags: "text",
});

// Virtual for vendor
ProductSchema.virtual("vendor", {
  ref: "Vendor",
  localField: "vendorId",
  foreignField: "_id",
  justOne: true,
});

// Virtual for category details
ProductSchema.virtual("categoryDetails", {
  ref: "Category",
  localField: "category",
  foreignField: "_id",
  justOne: true,
});

// Virtual for brand details
ProductSchema.virtual("brandDetails", {
  ref: "Brand",
  localField: "brand",
  foreignField: "_id",
  justOne: true,
});

// Virtual for reviews
ProductSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "productId",
});

// Virtual for discount percentage.
// For multi-variant products, returns the highest discount % across variants
// (matches Shopify's "Save up to X%" display).
ProductSchema.virtual("discountPercentage").get(function () {
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    let best = 0;
    for (const v of this.variants as ProductVariant[]) {
      if (v.comparePrice && v.comparePrice > v.price) {
        const pct = Math.round(((v.comparePrice - v.price) / v.comparePrice) * 100);
        if (pct > best) best = pct;
      }
    }
    return best;
  }
  if (this.comparePrice && this.comparePrice > this.price) {
    return Math.round(
      ((this.comparePrice - this.price) / this.comparePrice) * 100
    );
  }
  return 0;
});

// Virtual: true when at least one variant (or the default) has compareAt > price.
ProductSchema.virtual("onSale").get(function () {
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    return (this.variants as ProductVariant[]).some(
      (v) => typeof v.comparePrice === "number" && v.comparePrice > v.price
    );
  }
  return typeof this.comparePrice === "number" && this.comparePrice > this.price;
});

// Virtual for in stock status
ProductSchema.virtual("inStock").get(function () {
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    return this.variants.some((v: ProductVariant) => (v.stock || 0) > 0);
  }
  return (this.stock || 0) > 0;
});

/**
 * Strip HTML tags from a string for plain text SEO meta description
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3).trim() + "...";
}

ProductSchema.pre("validate", function () {
  const doc = this as unknown as IProduct;

  if (doc.shipping) {
    doc.shipping = normalizeProductShippingData(doc.shipping);
  }

  // Sync name and title - they should always be the same
  const title = (doc.title || doc.name || "").trim();
  if (!doc.title && title) doc.title = title;
  if (!doc.name && title) doc.name = title;

  // Auto-generate SKU from title if not provided
  if (!doc.sku && title) {
    doc.sku = generateSku(title);
  }

  const hasVariants = Array.isArray(doc.variants) && doc.variants.length > 0;
  const usedBarcodes = new Set<string>();
  rememberBarcode(usedBarcodes, doc.barcode);
  if (hasVariants) {
    for (const variant of doc.variants) {
      rememberBarcode(usedBarcodes, variant.barcode);
    }
  } else if (!hasBarcode(doc.barcode)) {
    const barcode = generateBarcode(usedBarcodes);
    doc.barcode = barcode;
    doc.barcodeFormat = "ean13";
    doc.barcodeSource = "internal";
    usedBarcodes.add(barcode);
  }

  // Ensure SEO object exists
  if (!doc.seo) doc.seo = {};

  // Auto-populate SEO pageTitle from title if empty
  if (!doc.seo.pageTitle && title) {
    doc.seo.pageTitle = truncateText(title, 70);
  }

  // Auto-populate SEO metaDescription from shortDescription or description if empty
  if (!doc.seo.metaDescription) {
    const descSource = doc.shortDescription || doc.description || "";
    if (descSource) {
      const plainText = stripHtml(descSource);
      doc.seo.metaDescription = truncateText(plainText, 160);
    }
  }

  // Sync handle/slug across all fields - handle is the canonical source
  const handle = (doc.seo.handle || doc.handle || doc.slug || "").trim();
  if (!doc.seo.handle && handle) doc.seo.handle = handle;
  if (!doc.handle && handle) doc.handle = handle;
  if (!doc.slug && handle) doc.slug = handle;

  if (Array.isArray(doc.media) && doc.media.length > 0) {
    const mediaSorted = [...doc.media].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
    doc.images = mediaSorted
      .filter((m) => (m.type || "image") === "image")
      .map((m) => m.url);
  } else if (Array.isArray(doc.images) && doc.images.length > 0) {
    const existingIds = new Set<string>();
    const nextMedia: ProductMedia[] = [];
    for (let i = 0; i < doc.images.length; i++) {
      const url = doc.images[i];
      if (!url) continue;
      const id = crypto.randomUUID();
      if (existingIds.has(id)) continue;
      existingIds.add(id);
      nextMedia.push({ _id: id, type: "image", url, position: i });
    }
    doc.media = nextMedia;
  }

  if (hasVariants) {
    for (const v of doc.variants) {
      // Ensure inventory object exists
      if (!v.inventory) {
        v.inventory = {
          tracked: true,
          quantity: 0,
          continueSellingWhenOutOfStock: false,
        };
      }

      // INVENTORY SYNC LOGIC:
      // Priority: locationInventory (sum) > stock > inventory.quantity
      // This ensures all inventory fields are consistent

      if (Array.isArray(v.locationInventory) && v.locationInventory.length > 0) {
        // If locationInventory exists, it's the source of truth
        const locationTotal = v.locationInventory.reduce(
          (sum, loc) => sum + (loc.quantity || 0),
          0
        );
        v.stock = locationTotal;
        v.inventory.quantity = locationTotal;
      } else if (typeof v.stock === "number") {
        // For online inventory, variant.stock is canonical and mirrors to inventory.quantity.
        v.stock = Math.max(0, v.stock);
        v.inventory.quantity = v.stock;
      } else if (typeof v.inventory.quantity === "number") {
        // Backward compatibility for older data that may only have inventory.quantity.
        v.stock = Math.max(0, v.inventory.quantity);
        v.inventory.quantity = v.stock;
      } else {
        // Default to 0
        v.stock = 0;
        v.inventory.quantity = 0;
      }

      // Auto-generate variant name from option values
      if (
        !v.name &&
        Array.isArray(v.optionValues) &&
        v.optionValues.length > 0
      ) {
        v.name = v.optionValues.map((ov) =>
          typeof ov === "string" ? ov : ov.value
        ).join(" / ");
      }

      // Auto-generate variant SKU from product SKU + option values
      if (!v.sku && doc.sku) {
        const optionSuffix = Array.isArray(v.optionValues) && v.optionValues.length > 0
          ? v.optionValues
              .map((ov) => (typeof ov === "string" ? ov : ov.value))
              .join("-")
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")
          : "";
        v.sku = optionSuffix ? `${doc.sku}-${optionSuffix}` : doc.sku;
      }

      if (!hasBarcode(v.barcode)) {
        const barcode = generateBarcode(usedBarcodes);
        v.barcode = barcode;
        usedBarcodes.add(barcode);
      }

      // Link variant image from mediaId
      if (
        v.mediaId &&
        Array.isArray(doc.media) &&
        doc.media.length > 0 &&
        !v.image
      ) {
        const match = doc.media.find((m) => m._id === v.mediaId);
        if (match) v.image = match.url;
      }
    }

    // Aggregate parent product stock from all variants
    doc.stock = doc.variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    // Shopify-style price aggregation:
    // - `price` mirrors min variant price (legacy "From $X" field)
    // - `priceRange` exposes both min and max for "$X – $Y" display
    // - `comparePrice` mirrors max variant compareAt (so % off shown is the highest possible)
    // - `compareAtPriceRange` exposes both min and max
    const variantPrices = doc.variants
      .map((v) => v.price)
      .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
    if (variantPrices.length > 0) {
      const min = Math.min(...variantPrices);
      const max = Math.max(...variantPrices);
      doc.price = min;
      doc.priceRange = { min, max };
    }

    const variantCompares = doc.variants
      .map((v) => v.comparePrice)
      .filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);
    if (variantCompares.length > 0) {
      const min = Math.min(...variantCompares);
      const max = Math.max(...variantCompares);
      doc.compareAtPriceRange = { min, max };
      doc.comparePrice = max;
    } else {
      doc.compareAtPriceRange = undefined;
      doc.comparePrice = undefined;
    }
  } else {
    // Single (default) variant pattern: range collapses to the product's own values.
    if (typeof doc.price === "number") {
      doc.priceRange = { min: doc.price, max: doc.price };
    }
    if (typeof doc.comparePrice === "number" && doc.comparePrice > 0) {
      doc.compareAtPriceRange = { min: doc.comparePrice, max: doc.comparePrice };
    } else {
      doc.compareAtPriceRange = undefined;
    }

    if (
      Array.isArray(doc.locationInventory) &&
      doc.locationInventory.length > 0
    ) {
      // Single-variant product: locationInventory is the source of truth for stock
      doc.stock = doc.locationInventory.reduce(
        (sum, loc) => sum + (loc.quantity || 0),
        0,
      );
    }
  }

  assignProductLookupCodes(
    doc as unknown as Record<string, unknown> & {
      variants?: Record<string, unknown>[];
    },
  );

  const duplicateBarcodes = findDuplicateBarcodeCodes(
    doc as unknown as Record<string, unknown> & {
      variants?: Record<string, unknown>[];
    },
  );
  if (duplicateBarcodes.length > 0) {
    this.invalidate(
      "barcode",
      `Duplicate barcode value: ${duplicateBarcodes.join(", ")}`,
    );
  }
});

export const Product =
  models.Product || model<IProduct>("Product", ProductSchema);

/**
 * Recalculate parent product price and stock from variant data.
 * Call after findByIdAndUpdate/findOneAndUpdate when variants may have changed,
 * since those operations bypass Mongoose pre-save hooks.
 */
export async function syncVariantAggregates(productId: string): Promise<void> {
  const doc = await Product.findById(productId).select("variants").lean();
  if (!doc || !Array.isArray(doc.variants) || doc.variants.length === 0) return;

  const totalStock = doc.variants.reduce(
    (sum: number, v: { stock?: number }) => sum + (v.stock || 0),
    0,
  );
  const prices = doc.variants
    .map((v: { price?: number }) => v.price)
    .filter((p: unknown): p is number => typeof p === "number" && Number.isFinite(p));
  const compares = doc.variants
    .map((v: { comparePrice?: number }) => v.comparePrice)
    .filter((p: unknown): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);

  const set: Record<string, unknown> = { stock: totalStock };
  const unset: Record<string, ""> = {};

  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    set.price = min;
    set.priceRange = { min, max };
  }

  if (compares.length > 0) {
    const min = Math.min(...compares);
    const max = Math.max(...compares);
    set.compareAtPriceRange = { min, max };
    set.comparePrice = max;
  } else {
    unset.compareAtPriceRange = "";
    unset.comparePrice = "";
  }

  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;

  await Product.updateOne({ _id: productId }, update);
}
