import { z } from "zod";
import {
  USER_ROLES,
  USER_ACCOUNT_STATUS,
  VENDOR_STATUS,
  PRODUCT_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
} from "@/config/app.config";
import { RETURN_STATUS } from "@/lib/returns";

/**
 * Zod Validation Schemas
 * Central validation schemas for API requests
 */

// ============================================
// Common Schemas
// ============================================

/**
 * URL of an uploaded media file (product image, avatar, logo, …).
 *
 * Storage providers return two URL shapes: R2/S3 give absolute http(s) URLs,
 * while the local storage provider returns root-relative paths like
 * "/uploads/2026/07/x.jpg" so files are served same-site. A bare
 * z.string().url() rejects the relative form, which broke every media save on
 * local-storage installs — so accept both. "//host/path" (protocol-relative)
 * is still rejected.
 */
export const MediaUrlSchema = z.string().refine(
  (value) => {
    // Root-relative ("/uploads/…") but not protocol-relative ("//host/…").
    if (value.startsWith("/")) return !value.startsWith("//");
    // Absolute URLs must be http(s) — z.string().url() alone would also let
    // javascript:/data: schemes through.
    if (!/^https?:\/\//i.test(value)) return false;
    return z.string().url().safeParse(value).success;
  },
  { message: "Must be an http(s) URL or a root-relative path" },
);

export const AddressSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  apartment: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
  label: z.enum(["home", "work", "other"]).optional(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(12),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================
// Auth Schemas
// ============================================

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([USER_ROLES.CUSTOMER, USER_ROLES.VENDOR]),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

// ============================================
// User Schemas
// ============================================

export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  image: MediaUrlSchema.optional(),
});

export const UpdateUserProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((value) => value.toLowerCase())
    .optional(),
  image: MediaUrlSchema.optional(),
  phone: z.union([z.string(), z.null()]).optional(),
  birthday: z.union([z.string(), z.null()]).optional(),
  gender: z.union([z.enum(["male", "female", "other"]), z.null()]).optional(),
});

export const AddAddressSchema = AddressSchema;

// ============================================
// Vendor Schemas
// ============================================

export const CreateVendorSchema = z.object({
  storeName: z
    .string()
    .min(3, "Store name must be at least 3 characters")
    .max(100),
  description: z.string().max(1000).optional(),
  address: AddressSchema.optional(),
});

export const UpdateVendorSchema = z.object({
  storeName: z.string().min(3).max(100).optional(),
  description: z.string().max(1000).optional(),
  logo: MediaUrlSchema.optional(),
  banner: MediaUrlSchema.optional(),
  socialLinks: z
    .object({
      website: z.string().url().optional(),
      facebook: z.string().url().optional(),
      instagram: z.string().url().optional(),
      twitter: z.string().url().optional(),
    })
    .optional(),
  address: AddressSchema.optional(),
});

export const UpdateVendorStatusSchema = z.object({
  status: z
    .enum([
      VENDOR_STATUS.PENDING,
      VENDOR_STATUS.APPROVED,
      VENDOR_STATUS.REJECTED,
      VENDOR_STATUS.SUSPENDED,
    ])
    .optional(),
  userStatus: z
    .enum([
      USER_ACCOUNT_STATUS.ACTIVE,
      USER_ACCOUNT_STATUS.INACTIVE,
      USER_ACCOUNT_STATUS.BANNED,
    ])
    .optional(),
  commission: z.number().min(0).max(100).optional(),
});

// ============================================
// Category Schemas
// ============================================

export const CreateCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  image: MediaUrlSchema.optional(),
  icon: MediaUrlSchema.optional(),
  parentId: z.string().optional(),
  order: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
  featured: z.boolean().default(false),
  seo: z
    .object({
      pageTitle: z.string().max(70).optional(),
      metaDescription: z.string().max(320).optional(),
    })
    .optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

// ============================================
// Product Schemas
// ============================================

export const ProductAttributeSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

export const VariantOptionValueSchema = z.object({
  optionId: z.string().optional(),
  optionName: z.string().optional(),
  valueId: z.string().optional(),
  value: z.string(),
  colorCode: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});

export const ProductVariantSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  sku: z.string().optional().default(""),
  barcode: z.string().optional(),
  barcodeFormat: z.enum(["ean13", "upca", "gtin14", "code128"]).optional(),
  barcodeSource: z.enum(["manufacturer", "gs1", "internal"]).optional(),
  price: z.number().min(0),
  comparePrice: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  taxable: z.boolean().optional(),
  stock: z.number().min(0),
  attributes: z.array(ProductAttributeSchema).default([]),
  image: MediaUrlSchema.optional(),
  optionValues: z
    .array(z.union([z.string(), VariantOptionValueSchema]))
    .default([]),
  inventory: z
    .object({
      tracked: z.boolean().default(true),
      quantity: z.number().min(0).default(0),
      continueSellingWhenOutOfStock: z.boolean().default(false),
    })
    .optional(),
  locationInventory: z
    .array(
      z.object({
        locationId: z.string(),
        quantity: z.number().min(0).default(0),
      }),
    )
    .optional(),
  requiresShipping: z.boolean().optional(),
  weight: z.number().min(0).optional(),
  weightUnit: z.enum(["g", "kg", "lb", "oz"]).optional(),
  mediaId: z.string().optional(),
  preorder: z
    .object({
      enabled: z.boolean().default(false),
      releaseDate: z.coerce.date().optional(),
      message: z.string().max(500).optional(),
      limit: z.number().min(0).default(0),
      reservedQuantity: z.number().min(0).default(0),
      preorderOnly: z.boolean().default(false),
      autoConvert: z.boolean().default(true),
      paymentMode: z.enum(["full", "deposit", "pay_later"]).default("full"),
      depositType: z.enum(["percentage", "fixed"]).default("percentage"),
      depositValue: z.number().min(0).default(0),
      supplierEta: z.coerce.date().optional(),
      batchName: z.string().max(120).optional(),
    })
    .optional(),
});

export const CreateProductSchema = z.object({
  vendorId: z.string().optional(),
  name: z.string().min(3, "Name must be at least 3 characters").max(200),
  title: z.string().min(3).max(200).optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(10000),
  shortDescription: z.string().max(500).optional(),
  price: z.number().min(0, "Price must be positive"),
  comparePrice: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  unitPrice: z
    .object({
      totalAmount: z.number().min(0),
      totalUnit: z.enum(["item", "g", "kg", "lb", "oz", "ml", "l", "dus"]),
      baseAmount: z.number().min(0),
      baseUnit: z.enum(["item", "g", "kg", "lb", "oz", "ml", "l", "dus"]),
    })
    .optional(),
  unitPriceUnit: z.enum(["item", "g", "kg", "lb", "oz", "ml", "l", "dus"]).optional(),
  chargeTax: z.boolean().optional(),
  sku: z.string().optional().default(""),
  barcode: z.string().optional(),
  barcodeFormat: z.enum(["ean13", "upca", "gtin14", "code128"]).optional(),
  barcodeSource: z.enum(["manufacturer", "gs1", "internal"]).optional(),
  stock: z.number().min(0).default(0),
  locationInventory: z
    .array(
      z.object({
        locationId: z.string(),
        quantity: z.number().min(0).default(0),
      }),
    )
    .optional(),
  images: z.array(MediaUrlSchema).default([]),
  media: z
    .array(
      z.object({
        _id: z.string().min(1),
        type: z.enum(["image", "video", "model"]).default("image"),
        url: MediaUrlSchema,
        filename: z.string().max(255).optional(),
        alt: z.string().optional(),
        position: z.number().optional(),
        mimeType: z.string().optional(),
        thumbnailUrl: MediaUrlSchema.optional(),
      }),
    )
    .optional(),
  category: z.string().min(1, "Category is required"),
  // Normalize empty string to null so an unset brand never triggers an
  // ObjectId CastError on create/update.
  brand: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().nullable().optional(),
  ),
  productType: z.string().optional(),
  collections: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
  template: z.string().optional(),
  tags: z.array(z.string()).default([]),
  attributes: z.array(ProductAttributeSchema).default([]),
  options: z
    .array(
      z.object({
        _id: z.string().optional(),
        name: z.string().min(1),
        position: z.number().optional(),
        values: z
          .array(
            z.union([
              z.string(),
              z.object({
                _id: z.string().optional(),
                value: z.string().min(1),
                colorCode: z
                  .string()
                  .regex(/^#[0-9a-f]{6}$/i)
                  .optional(),
                position: z.number().optional(),
              }),
            ]),
          )
          .default([]),
      }),
    )
    .default([]),
  variants: z.array(ProductVariantSchema).default([]),
  preorder: z
    .object({
      enabled: z.boolean().default(false),
      releaseDate: z.coerce.date().optional(),
      message: z.string().max(500).optional(),
      limit: z.number().min(0).default(0),
      reservedQuantity: z.number().min(0).default(0),
      preorderOnly: z.boolean().default(false),
      autoConvert: z.boolean().default(true),
      paymentMode: z.enum(["full", "deposit", "pay_later"]).default("full"),
      depositType: z.enum(["percentage", "fixed"]).default("percentage"),
      depositValue: z.number().min(0).default(0),
      supplierEta: z.coerce.date().optional(),
      batchName: z.string().max(120).optional(),
    })
    .optional(),
  seo: z
    .object({
      pageTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      handle: z.string().optional(),
    })
    .optional(),
  publishing: z
    .object({
      onlineStore: z.boolean().default(true),
      pointOfSale: z.boolean().default(false),
    })
    .optional(),
  shipping: z
    .object({
      isPhysicalProduct: z.boolean().default(true),
      weight: z.number().min(0).optional(),
      weightUnit: z.enum(["g", "kg", "lb", "oz"]).default("kg"),
      countryOfOrigin: z.string().optional(),
      hsCode: z.string().optional(),
      customsDescription: z.string().max(500).optional(),
    })
    .optional(),
  status: z
    .enum([
      PRODUCT_STATUS.ACTIVE,
      PRODUCT_STATUS.DRAFT,
      PRODUCT_STATUS.UNLISTED,
    ])
    .default(PRODUCT_STATUS.DRAFT),
  featured: z.boolean().default(false),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const ProductFilterSchema = PaginationSchema.extend({
  category: z.string().optional(),
  vendor: z.string().optional(),
  status: z
    .enum([
      PRODUCT_STATUS.ACTIVE,
      PRODUCT_STATUS.DRAFT,
      PRODUCT_STATUS.UNLISTED,
    ])
    .optional(),
  featured: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  inStock: z.coerce.boolean().optional(),
});

// ============================================
// Cart Schemas
// ============================================

export const AddToCartSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

// ============================================
// Order Schemas
// ============================================

export const CreateOrderSchema = z.object({
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  paymentMethod: z.string().min(1, "Payment method is required"),
  notes: z.string().max(1000).optional(),
});

const AdminOrderObjectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format");

export const AdminCreateOrderSchema = z.object({
  customerId: AdminOrderObjectIdSchema,
  items: z
    .array(
      z.object({
        productId: AdminOrderObjectIdSchema,
        variantId: AdminOrderObjectIdSchema.optional(),
        quantity: z.coerce.number().int().min(1).max(999),
      }),
    )
    .min(1, "Add at least one product"),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  paymentMethod: z.string().min(1).max(50).default("manual"),
  paymentStatus: z
    .enum([PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID])
    .default(PAYMENT_STATUS.PENDING),
  shippingCost: z.coerce.number().min(0).max(100000).default(0),
  discount: z.coerce.number().min(0).max(100000).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    ORDER_STATUS.PREORDERED,
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
  ]),
  trackingNumber: z.string().optional(),
});

export const UpdatePaymentStatusSchema = z.object({
  paymentStatus: z.enum([
    PAYMENT_STATUS.PENDING,
    PAYMENT_STATUS.PAID,
    PAYMENT_STATUS.PARTIALLY_PAID,
    PAYMENT_STATUS.REFUNDED,
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
  ]),
  paymentId: z.string().optional(),
});

export const AdminUpdateOrderSchema = z
  .object({
    status: z
      .enum([
        ORDER_STATUS.PREORDERED,
        ORDER_STATUS.PENDING,
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.CANCELLED,
      ])
      .optional(),
    paymentStatus: z
      .enum([
        PAYMENT_STATUS.PENDING,
        PAYMENT_STATUS.PAID,
        PAYMENT_STATUS.PARTIALLY_PAID,
        PAYMENT_STATUS.REFUNDED,
        PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ])
      .optional(),
    notes: z.string().max(1000).optional(),
    trackingNumber: z.string().max(100).optional(),
    carrier: z.string().max(100).optional(),
    cancelReason: z.string().max(500).optional(),
    refundAmount: z.number().min(0).optional(),
    refundReason: z.string().max(500).optional(),
    manualRefund: z.boolean().optional(),
    /**
     * When set to true on a refund, restore the order's items to inventory
     * (typically used for full refunds where the customer is returning
     * physical goods). Per-sub-order claim makes this safe against
     * double-restore even if vendor partial-cancels happened earlier.
     */
    restoreInventoryOnRefund: z.boolean().optional(),
  })
  .refine(
    (val) =>
      val.status !== undefined ||
      val.paymentStatus !== undefined ||
      val.notes !== undefined ||
      val.trackingNumber !== undefined ||
      val.carrier !== undefined ||
      val.cancelReason !== undefined ||
      val.refundAmount !== undefined ||
      val.refundReason !== undefined,
    { message: "No updates provided" },
  );

// ============================================
// Return Request Schemas
// ============================================

export const CreateReturnRequestSchema = z.object({
  orderId: AdminOrderObjectIdSchema,
  reason: z
    .string()
    .trim()
    .min(1, "Select a return reason")
    .max(100, "Return reason must be 100 characters or less")
    .refine((reason) => reason !== "other" && reason !== "changed_mind", {
      message: "Enter a valid return reason",
    }),
  customerNote: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        orderItemIndex: z.coerce.number().int().min(0),
        quantity: z.coerce.number().int().min(1).max(999),
      }),
    )
    .min(1, "Select at least one item to return"),
});

// ============================================
// Review Schemas
// ============================================

export const CreateReviewSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  orderId: z.string().min(1, "Order ID is required"),
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),
  title: z.string().max(100).optional(),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters")
    .max(1000),
  images: z.array(MediaUrlSchema).max(5).default([]),
});

// ============================================
// Query Parameter Schemas (for API security)
// ============================================

/**
 * Transform that sanitizes search strings to prevent ReDoS attacks
 * Escapes all regex special characters
 */
const sanitizeSearch = (val: string) =>
  val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Safe search schema - auto-sanitizes regex special characters
 */
export const SafeSearchSchema = z
  .string()
  .max(100, "Search query too long")
  .transform(sanitizeSearch)
  .optional();

/**
 * MongoDB ObjectId validation schema
 */
export const ObjectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format");

/**
 * Optional ObjectId schema
 */
export const OptionalObjectIdSchema = ObjectIdSchema.optional();

/**
 * Admin list query params with pagination and safe search
 */
export const AdminListQuerySchema = z.object({
  page: z.coerce.number().min(1).max(1000).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: SafeSearchSchema,
  status: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const AdminReturnListQuerySchema = AdminListQuerySchema.extend({
  status: z
    .enum(["all", ...Object.values(RETURN_STATUS)] as [string, ...string[]])
    .optional(),
  orderId: z.string().optional(),
});

export const AdminUpdateReturnRequestSchema = z
  .object({
    status: z.enum(Object.values(RETURN_STATUS) as [string, ...string[]]).optional(),
    adminNote: z.string().max(2000).optional(),
    rejectionReason: z.string().max(1000).optional(),
    carrier: z.string().max(100).optional(),
    trackingNumber: z.string().max(100).optional(),
    receivedItems: z
      .array(
        z.object({
          orderItemIndex: z.coerce.number().int().min(0),
          quantityReceived: z.coerce.number().int().min(0).max(999),
          condition: z
            .enum(["new", "opened", "damaged", "missing_parts", "unusable"])
            .optional(),
          restockable: z.boolean().optional(),
        }),
      )
      .optional(),
    refundAmount: z.coerce.number().min(0).optional(),
    refundReason: z.string().max(500).optional(),
    manualRefund: z.boolean().optional(),
    restoreInventoryOnRefund: z.boolean().optional(),
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: "No updates provided",
  });

/**
 * Product list query params with filters
 */
export const ProductListQuerySchema = AdminListQuerySchema.extend({
  category: z.string().optional(),
  vendor: z.string().optional(),
  source: z.enum(["all", "admin", "vendor"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  featured: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
});

/**
 * Order list query params with filters
 */
export const OrderListQuerySchema = AdminListQuerySchema.extend({
  paymentStatus: z
    .enum([
      "all",
      PAYMENT_STATUS.PENDING,
      PAYMENT_STATUS.PAID,
      PAYMENT_STATUS.PARTIALLY_PAID,
      PAYMENT_STATUS.REFUNDED,
      PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ])
    .optional(),
  channel: z.enum(["all", "online", "pos"]).optional(),
  view: z.enum(["all", "unfulfilled", "unpaid", "open", "archived"]).optional(),
});

/**
 * Admin review list query params
 */
export const AdminReviewListQuerySchema = AdminListQuerySchema.extend({
  status: z.enum(["all", "published", "on_hold"]).optional(),
  rating: z
    .union([z.literal("all"), z.coerce.number().int().min(1).max(5)])
    .optional(),
  productId: OptionalObjectIdSchema,
  hasReply: z.enum(["all", "yes", "no"]).optional(),
  view: z.enum(["all", "published", "on_hold", "with_reply", "no_reply"]).optional(),
});

/**
 * Admin review update body
 */
export const AdminUpdateReviewSchema = z
  .object({
    isApproved: z.boolean().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().max(100).optional(),
    comment: z.string().min(1).max(1000).optional(),
    reply: z
      .union([
        z.string().min(1, "Reply cannot be empty").max(1000),
        z.null(),
      ])
      .optional(),
  })
  .refine(
    (val) => Object.values(val).some((v) => v !== undefined),
    { message: "No updates provided" }
  );

/**
 * ID parameter schema for route params
 */
export const IdParamSchema = z.object({
  id: ObjectIdSchema,
});

// ============================================
// Coupon Schemas
// ============================================

const CouponBaseSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(20, "Code must be at most 20 characters")
    .transform((val) => val.toUpperCase()),
  label: z.string().max(80).optional(),
  description: z.string().max(200).optional(),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.number().min(0, "Value must be positive").optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  usageLimit: z.number().min(1).optional(),
  perUserLimit: z.number().min(1).optional(),
  userLimit: z.number().min(1).optional(),
  applicableProducts: z.array(z.string()).optional(),
  applicableCategories: z.array(z.string()).optional(),
  excludedProducts: z.array(z.string()).optional(),
  excludedCategories: z.array(z.string()).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date(),
  status: z.enum(["active", "inactive", "expired"]).default("active"),
});

export const CreateCouponSchema = CouponBaseSchema.superRefine((data, ctx) => {
  if (data.type !== "free_shipping" && (!data.value || data.value <= 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "Value must be greater than 0",
    });
  }
});

export const UpdateCouponSchema = CouponBaseSchema.partial().superRefine(
  (data, ctx) => {
    if (data.value !== undefined && data.type !== "free_shipping" && data.value <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Value must be greater than 0",
      });
    }
  },
);

export const ValidateCouponSchema = z.object({
  code: z.string().min(3).max(20),
  subtotal: z.coerce.number().min(0),
  shippingCost: z.coerce.number().min(0).optional(),
  cartItems: z
    .array(
      z.object({
        productId: ObjectIdSchema,
        price: z.coerce.number().min(0),
        quantity: z.coerce.number().min(1).max(100),
        categoryId: OptionalObjectIdSchema,
      }),
    )
    .min(1),
});

// ============================================
// Settings Update Schema
// ============================================

export const SettingsUpdateSchema = z.object({
  section: z
    .enum([
      "general",
      "appearance",
      "payment",
      "email",
      "orders",
      "seo",
      "social",
      "analytics",
      "maintenance",
      "security",
      "pos",
      "multiVendorMode",
      "storage",
    ])
    .optional(),
  data: z.record(z.string(), z.unknown()),
});

// ============================================
// Enhanced Cart Schemas
// ============================================

export const CartAddItemSchema = z.object({
  productId: ObjectIdSchema,
  variantId: OptionalObjectIdSchema,
  quantity: z.coerce
    .number()
    .min(1, "Quantity must be at least 1")
    .max(100)
    .default(1),
  price: z.coerce.number().min(0),
  name: z.string().min(1).max(200),
  image: MediaUrlSchema.optional().or(z.literal("")),
});

export const CartUpdateItemSchema = z.object({
  productId: ObjectIdSchema,
  variantId: OptionalObjectIdSchema,
  quantity: z.coerce.number().min(0).max(100),
});

export const CartAddByIdSchema = z.object({
  productId: ObjectIdSchema,
  variantId: OptionalObjectIdSchema,
  quantity: z.coerce.number().min(1).max(100).default(1),
});

// ============================================
// Checkout Schema
// ============================================

export const CheckoutAddressSchema = z.object({
  fullName: z.string().min(2, "Name is required").max(100),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  street: z.string().min(5, "Street address is required").max(200),
  apartment: z.string().max(100).optional(),
  city: z.string().min(2, "City is required").max(100),
  state: z.string().max(100).optional().default(""),
  postalCode: z.string().min(3, "Postal code is required").max(20),
  country: z.string().min(2, "Country is required").max(100),
  phone: z.string().optional(),
});

export const CheckoutSchema = z.object({
  shippingAddress: CheckoutAddressSchema,
  billingAddress: CheckoutAddressSchema.optional(),
  paymentMethod: z.enum(["card", "cod", "paypal", "razorpay", "paystack"]),
  email: z.string().email().optional(),
  couponCode: z.string().min(3).max(20).optional(),
  locale: z.string().length(2).optional(),
  notes: z.string().max(500).optional(),
  preorderAcknowledged: z.boolean().optional(),
  // Customer-selected shipping rate option id (single-shipment carts).
  selectedShippingOptionId: z.string().max(100).optional(),
  // Per-vendor shipping rate selections, keyed by vendor id (multi-vendor).
  vendorShippingSelections: z.record(z.string(), z.string().max(100)).optional(),
});

// ============================================
// Admin User Management Schemas
// ============================================

export const AdminUpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(["customer", "vendor", "admin", "staff", "seller"]).optional(),
  phone: z.string().optional(),
  emailVerified: z.boolean().optional(),
  status: z
    .enum([
      USER_ACCOUNT_STATUS.ACTIVE,
      USER_ACCOUNT_STATUS.INACTIVE,
      USER_ACCOUNT_STATUS.BANNED,
    ])
    .optional(),
  banned: z.boolean().optional(), // Backward compatibility
});

// ============================================
// Inventory Location Schema
// ============================================

export const CreateLocationSchema = z.object({
  name: z.string().min(2).max(100),
  address: AddressSchema.optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const UpdateLocationSchema = CreateLocationSchema.partial();

// ============================================
// Collection Schemas
// ============================================

export const CollectionConditionSchema = z.object({
  field: z.enum([
    "title",
    "productType",
    "vendor",
    "tag",
    "price",
    "comparePrice",
    "weight",
    "stock",
    "createdAt",
    "category",
  ]),
  operator: z.enum([
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
    "starts_with",
    "ends_with",
    "contains",
    "not_contains",
    "is_set",
    "is_not_set",
  ]),
  value: z.union([z.string(), z.number(), z.coerce.date()]),
});

export const CollectionImageSchema = z.object({
  url: MediaUrlSchema,
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const CreateCollectionSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  descriptionHtml: z.string().max(10000).optional(),
  image: CollectionImageSchema.optional(),
  collectionType: z.enum(["manual", "automated"]),
  products: z.array(ObjectIdSchema).default([]),
  conditions: z.array(CollectionConditionSchema).default([]),
  conditionMatch: z.enum(["all", "any"]).default("all"),
  sortOrder: z
    .enum([
      "manual",
      "best-selling",
      "title-asc",
      "title-desc",
      "price-asc",
      "price-desc",
      "created-asc",
      "created-desc",
    ])
    .default("manual"),
  position: z.number().min(0).default(0),
  status: z.enum(["active", "draft"]).default("draft"),
  publishing: z
    .object({
      onlineStore: z.boolean().default(true),
      pointOfSale: z.boolean().default(false),
    })
    .optional(),
  seo: z
    .object({
      pageTitle: z.string().max(70).optional(),
      metaDescription: z.string().max(320).optional(),
      handle: z.string().optional(),
    })
    .optional(),
});

export const UpdateCollectionSchema = CreateCollectionSchema.partial();

export const CollectionListQuerySchema = AdminListQuerySchema.extend({
  type: z.enum(["manual", "automated"]).optional(),
  channel: z.enum(["onlineStore", "pointOfSale"]).optional(),
});

// ============================================
// Customer Profile Schemas
// ============================================

export const EmailNotificationsSchema = z.object({
  orderUpdates: z.boolean().optional(),
  promotions: z.boolean().optional(),
  newsletter: z.boolean().optional(),
  priceDrops: z.boolean().optional(),
  backInStock: z.boolean().optional(),
});

export const UpdateCustomerProfileSchema = z.object({
  preferredPaymentMethod: z.string().max(50).optional(),
  preferredCurrency: z.string().max(3).optional(),
  preferredLanguage: z.string().max(5).optional(),
  preferredCategories: z.array(ObjectIdSchema).max(20).optional(),
  sizePreferences: z.record(z.string(), z.string().max(20)).optional(),
  marketingOptIn: z.boolean().optional(),
  emailNotifications: EmailNotificationsSchema.optional(),
});

export const AdminUpdateCustomerProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(30).optional(),
  status: z
    .enum([
      USER_ACCOUNT_STATUS.ACTIVE,
      USER_ACCOUNT_STATUS.INACTIVE,
      USER_ACCOUNT_STATUS.BANNED,
    ])
    .optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(2000).optional(),
  loyaltyPoints: z.number().min(0).optional(),
  loyaltyTier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
  acquisitionSource: z.string().max(50).optional(),
  shippingAddress: AddressSchema.optional(),
});

export const AdminCreateCustomerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(30).optional(),
  status: z
    .enum([
      USER_ACCOUNT_STATUS.ACTIVE,
      USER_ACCOUNT_STATUS.INACTIVE,
      USER_ACCOUNT_STATUS.BANNED,
    ])
    .optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(2000).optional(),
  loyaltyPoints: z.number().min(0).optional(),
  loyaltyTier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
  acquisitionSource: z.string().max(50).optional(),
  shippingAddress: AddressSchema.optional(),
});

export const CustomerListQuerySchema = AdminListQuerySchema.extend({
  loyaltyTier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
  tag: z.string().max(50).optional(),
  minSpent: z.coerce.number().min(0).optional(),
  maxSpent: z.coerce.number().min(0).optional(),
});

// Export types
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductFilterInput = z.infer<typeof ProductFilterSchema>;
export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type AdminCreateOrderInput = z.infer<typeof AdminCreateOrderSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type AdminListQueryInput = z.infer<typeof AdminListQuerySchema>;
export type AdminReturnListQueryInput = z.infer<typeof AdminReturnListQuerySchema>;
export type OrderListQueryInput = z.infer<typeof OrderListQuerySchema>;
export type AdminReviewListQueryInput = z.infer<typeof AdminReviewListQuerySchema>;
export type AdminUpdateReviewInput = z.infer<typeof AdminUpdateReviewSchema>;
export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type CartAddItemInput = z.infer<typeof CartAddItemSchema>;
export type CartUpdateItemInput = z.infer<typeof CartUpdateItemSchema>;
export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof UpdateCollectionSchema>;
export type CollectionListQueryInput = z.infer<
  typeof CollectionListQuerySchema
>;
export type UpdateCustomerProfileInput = z.infer<
  typeof UpdateCustomerProfileSchema
>;
export type AdminUpdateCustomerProfileInput = z.infer<
  typeof AdminUpdateCustomerProfileSchema
>;
export type AdminCreateCustomerInput = z.infer<
  typeof AdminCreateCustomerSchema
>;
export type CustomerListQueryInput = z.infer<typeof CustomerListQuerySchema>;

// ============================================
// Blog Schemas
// ============================================

const BlogSeoSchema = z
  .object({
    pageTitle: z.string().max(70).optional(),
    metaDescription: z.string().max(320).optional(),
    ogImage: z.string().optional(),
    canonicalUrl: z.string().optional(),
    noIndex: z.boolean().optional(),
  })
  .optional();

export const CreateBlogCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().optional(),
  description: z.string().max(500).optional(),
  image: z.string().optional(),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export const UpdateBlogCategorySchema = CreateBlogCategorySchema.partial();

export const CreateBlogPostSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1, "Content is required"),
  featuredImage: z
    .object({
      url: z.string().optional(),
      alt: z.string().optional(),
    })
    .optional(),
  categoryIds: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  status: z
    .enum(["draft", "scheduled", "published", "archived"])
    .default("draft"),
  visibility: z.enum(["public", "private", "password"]).default("public"),
  password: z.string().optional(),
  publishedAt: z.string().optional(),
  scheduledFor: z.string().optional(),
  allowComments: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  seo: BlogSeoSchema,
});
export const UpdateBlogPostSchema = CreateBlogPostSchema.partial();

export const CreateBlogCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  authorName: z.string().min(2).max(120),
  authorEmail: z.string().email(),
  authorWebsite: z.string().optional(),
  content: z.string().min(2).max(5000),
});
export const UpdateBlogCommentSchema = z.object({
  status: z.enum(["pending", "approved", "spam", "trash"]).optional(),
  content: z.string().min(2).max(5000).optional(),
});

// ============================================
// Menu Schemas
// ============================================

const MenuItemBaseSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().default("#"),
  type: z
    .enum([
      "custom",
      "page",
      "product",
      "category",
      "collection",
      "brand",
      "blog",
      "blog-post",
      "external",
    ])
    .default("custom"),
  target: z.enum(["_self", "_blank"]).default("_self"),
  icon: z.string().optional(),
  image: z.string().optional(),
  description: z.string().max(280).optional(),
  badge: z.string().max(30).optional(),
  badgeColor: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isMegaColumn: z.boolean().optional(),
  columnTitle: z.string().max(120).optional(),
});

export type MenuItemInput = z.infer<typeof MenuItemBaseSchema> & {
  children?: MenuItemInput[];
};

export const MenuItemSchema: z.ZodType<MenuItemInput> = MenuItemBaseSchema.extend({
  children: z.lazy(() => z.array(MenuItemSchema)).optional().default([]),
});

export const CreateMenuSchema = z.object({
  name: z.string().min(2).max(100),
  handle: z.string().optional(),
  location: z
    .enum(["header", "header-mega", "footer", "mobile", "sidebar", "custom"])
    .default("custom"),
  description: z.string().max(500).optional(),
  items: z.array(MenuItemSchema).default([]),
  isActive: z.boolean().default(true),
});
export const UpdateMenuSchema = CreateMenuSchema.partial();

export type CreateBlogPostInput = z.infer<typeof CreateBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof UpdateBlogPostSchema>;
export type CreateBlogCategoryInput = z.infer<typeof CreateBlogCategorySchema>;
export type UpdateBlogCategoryInput = z.infer<typeof UpdateBlogCategorySchema>;
export type CreateBlogCommentInput = z.infer<typeof CreateBlogCommentSchema>;
export type CreateMenuInput = z.infer<typeof CreateMenuSchema>;
export type UpdateMenuInput = z.infer<typeof UpdateMenuSchema>;
