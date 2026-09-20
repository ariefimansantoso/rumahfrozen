import type { Types } from "mongoose";
import type {
  UserRole,
  UserAccountStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  VendorStatus,
} from "@/config/app.config";
import type { VendorPermission } from "@/config/permissions.config";
import type { ShareSettings } from "@/lib/share-config";

// ============================================
// Common Types
// ============================================

export interface Address {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  street: string;
  city: string;
  state?: string;
  apartment?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
  label?: "home" | "work" | "other";
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  routingNumber?: string;
  swiftCode?: string;
}

// ============================================
// User Types
// ============================================

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  emailVerificationRequiredAt?: Date;
  emailVerificationAudience?: "customer" | "vendor";
  image?: string;
  role: UserRole;
  roles: UserRole[];
  status: UserAccountStatus;
  phone?: string;
  addresses: Address[];
  // 2FA fields
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Admin Profile Types
// ============================================

export interface IAdminProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  permissions: string[];
  department?: string;
  isSuperAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Customer Profile Types
// ============================================

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export interface EmailNotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
  priceDrops: boolean;
  backInStock: boolean;
}

export interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  totalReviews: number;
  averageRating?: number;
  totalWishlistItems: number;
}

export interface ICustomerProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;

  // Loyalty & Rewards
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  lifetimePoints: number;

  // Shopping Preferences
  preferredPaymentMethod?: string;
  preferredCurrency?: string;
  preferredLanguage?: string;
  preferredCategories?: Types.ObjectId[];
  sizePreferences?: Record<string, string>;

  // Marketing & Communication
  marketingOptIn: boolean;
  emailNotifications: EmailNotificationPreferences;

  // Cached Aggregated Stats
  stats: CustomerStats;

  // Customer Segments / Tags
  tags?: string[];
  notes?: string;

  // Source & Acquisition
  acquisitionSource?: string;
  referredBy?: Types.ObjectId;
  shippingAddress?: Address;

  // Activity
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Vendor Types
// ============================================

export interface IVendor {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  isDefault?: boolean;
  storeName: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  status: VendorStatus;
  commission: number;
  rating: number;
  totalSales: number;
  permissions: VendorPermission[];
  bankDetails?: BankDetails;
  address?: Address;
  socialLinks?: {
    website?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  shareSettings?: ShareSettings;
  notificationPreferences?: {
    newOrders?: boolean;
    orderUpdates?: boolean;
    lowStock?: boolean;
    marketing?: boolean;
  };
  payoutSettings?: {
    schedule?: "weekly" | "biweekly" | "monthly";
    minimumAmount?: number;
  };
  shipping?: VendorShippingProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorShippingRate {
  id: string;
  name: string;
  type: "flat" | "free_over" | "subtotal_range" | "weight_range";
  price: number;
  freeOver?: number;
  minSubtotal?: number;
  maxSubtotal?: number;
  minWeight?: number;
  maxWeight?: number;
  pricePerWeightUnit?: number;
  minDays?: number;
  maxDays?: number;
  active: boolean;
}

export interface VendorShippingZone {
  id: string;
  name: string;
  countries: string[];
  regions?: string[];
  rates: VendorShippingRate[];
}

export interface VendorShippingProfile {
  enabled: boolean;
  weightUnit?: "kg" | "lb";
  origin?: {
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
    address1?: string;
    address2?: string;
  };
  delivery?: {
    processingDaysMin: number;
    processingDaysMax: number;
    showEstimatedDelivery: boolean;
  };
  zones: VendorShippingZone[];
  fallbackRate?: {
    enabled: boolean;
    name: string;
    price: number;
    minDays?: number;
    maxDays?: number;
  };
  localPickup?: {
    enabled: boolean;
    pickupAddress?: string;
    instructions?: string;
    readyInDaysMin?: number;
    readyInDaysMax?: number;
  };
}

// ============================================
// Category Types
// ============================================

export interface CategorySEO {
  pageTitle?: string;
  metaDescription?: string;
  tags?: string[];
}

export interface ICategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  parentId?: Types.ObjectId;
  order: number;
  isActive: boolean;
  featured: boolean;
  seo?: CategorySEO;
  productCount: number;
  // Reusable variant option template (e.g. Color: Red/Blue, Size: xl). Defines
  // options + values only — no per-variant pricing/stock/images — so products
  // assigned to this category can inherit these options. Same shape as a
  // product's own `options`.
  options?: ProductOption[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Brand Types
// ============================================

export interface BrandSEO {
  pageTitle?: string;
  metaDescription?: string;
}

export type BrandApprovalStatus = "approved" | "pending" | "rejected";

export interface IBrand {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  order: number;
  isActive: boolean;
  featured: boolean;
  seo?: BrandSEO;
  productCount: number;
  // Multi-vendor moderation: null = platform/admin-owned ("official") brand,
  // otherwise the vendor that created it. Vendor-created brands enter a
  // moderation queue (pending) and are owner-scoped for edits.
  ownerVendorId?: Types.ObjectId | null;
  approvalStatus: BrandApprovalStatus;
  rejectionReason?: string;
  // Soft-delete marker. Admin-only; non-null means archived/hidden everywhere
  // but recoverable, so product references survive.
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Product Types
// ============================================

export interface ProductAttribute {
  name: string;
  value: string;
}

export type WeightUnit = "g" | "kg" | "lb" | "oz";
export type UnitPriceUnit = "item" | "g" | "kg" | "lb" | "oz" | "ml" | "l";

export interface UnitPriceMeasurement {
  totalAmount: number;
  totalUnit: UnitPriceUnit;
  baseAmount: number;
  baseUnit: UnitPriceUnit;
}

export type MediaType = "image" | "video" | "model";

export interface ProductMedia {
  _id: string;
  type: MediaType;
  url: string;
  filename?: string;
  alt?: string;
  position?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

// Option value structure for product options
export interface OptionValue {
  _id: string;
  value: string;
  colorCode?: string;
  position: number;
}

// Updated ProductOption with id, position, and structured values
export interface ProductOption {
  _id: string;
  name: string;
  values: OptionValue[];
  position: number;
}

// ============================================
// Global Variant Types
// ============================================
// A reusable variant definition created once and attached to any product,
// so option sets like "Color" or "Storage" don't have to be re-typed per
// product. Rendered on the product form's variant picker and stored at the
// store level.

// Data type of a global variant's values.
export type GlobalVariantType =
  | "text"
  | "color"
  | "image"
  | "integer"
  | "decimal";

// How the variant is presented to the storefront shopper.
export type GlobalVariantVisual =
  | "rectangle"
  | "dropdown"
  | "circle"
  | "color"
  | "color_label"
  | "radio"
  | "image";

export interface GlobalVariantValue {
  _id: string;
  value: string;
  // Set when `type` is "color" — hex swatch shown next to the value.
  colorCode?: string;
  // Set when `type` is "image" — media URL shown as the value's thumbnail.
  image?: string;
  position: number;
}

export interface IGlobalVariant {
  _id: Types.ObjectId;
  name: string;
  type: GlobalVariantType;
  visual: GlobalVariantVisual;
  values: GlobalVariantValue[];
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSEO {
  pageTitle?: string;
  metaDescription?: string;
  handle?: string;
}

// Money range used for `priceRange` and `compareAtPriceRange` (Shopify-style)
export interface MoneyRange {
  min: number;
  max: number;
}

export interface ProductPublishing {
  onlineStore: boolean;
  pointOfSale: boolean;
}

export type ProductSource = "admin" | "vendor";

export interface ProductInventory {
  tracked: boolean;
  quantity: number;
  continueSellingWhenOutOfStock: boolean;
}

export interface IInventoryLocation {
  _id: Types.ObjectId;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationInventory {
  locationId: Types.ObjectId | string;
  locationName?: string;
  quantity: number;
}

export interface PreorderSettings {
  enabled?: boolean;
  releaseDate?: Date | string;
  message?: string;
  limit?: number;
  reservedQuantity?: number;
  preorderOnly?: boolean;
  autoConvert?: boolean;
  paymentMode?: "full" | "deposit" | "pay_later";
  depositType?: "percentage" | "fixed";
  depositValue?: number;
  supplierEta?: Date | string;
  batchName?: string;
}

export type PurchaseType = "standard" | "preorder";
export type PreorderItemStatus =
  | "reserved"
  | "payment_due"
  | "delayed"
  | "partially_ready"
  | "ready"
  | "fulfilled"
  | "cancelled"
  | "expired";

// Variant option value - tracks which option/value combination a variant has
export interface VariantOptionValue {
  optionId: string;
  optionName: string;
  valueId: string;
  value: string;
  colorCode?: string;
}

export interface ProductVariant {
  _id?: Types.ObjectId | string;
  name: string;
  sku: string;
  skuNormalized?: string;
  barcode?: string;
  barcodeNormalized?: string;
  barcodeFormat?: "ean13" | "upca" | "gtin14" | "code128";
  barcodeSource?: "manufacturer" | "gs1" | "internal";
  price: number;
  comparePrice?: number;
  cost?: number;
  taxable?: boolean;
  stock: number;
  attributes: ProductAttribute[];
  image?: string;
  // Updated: structured option values instead of string array
  optionValues?: VariantOptionValue[];
  inventory?: ProductInventory;
  requiresShipping?: boolean;
  weight?: number;
  weightUnit?: WeightUnit;
  mediaId?: string;
  locationInventory?: LocationInventory[];
  preorder?: PreorderSettings;
}

export interface IProduct {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  productSource: ProductSource;
  name: string;
  title?: string;
  slug: string;
  handle?: string;
  description: string;
  shortDescription?: string;
  price: number;
  comparePrice?: number;
  priceRange?: MoneyRange;
  compareAtPriceRange?: MoneyRange;
  cost?: number;
  unitPrice?: UnitPriceMeasurement;
  unitPriceUnit?: UnitPriceUnit;
  chargeTax?: boolean;
  sku: string;
  skuNormalized?: string;
  barcode?: string;
  barcodeNormalized?: string;
  barcodeFormat?: "ean13" | "upca" | "gtin14" | "code128";
  barcodeSource?: "manufacturer" | "gs1" | "internal";
  stock: number;
  images: string[];
  media?: ProductMedia[];
  category: Types.ObjectId;
  brand?: Types.ObjectId;
  productType?: string;
  collections?: string[];
  collectionIds?: Types.ObjectId[];
  template?: string;
  tags: string[];
  attributes: ProductAttribute[];
  options?: ProductOption[];
  variants: ProductVariant[];
  preorder?: PreorderSettings;
  seo?: ProductSEO;
  publishing?: ProductPublishing;
  shipping?: {
    isPhysicalProduct?: boolean;
    weight?: number;
    weightUnit?: WeightUnit;
    countryOfOrigin?: string;
    hsCode?: string;
    customsDescription?: string;
  };
  status: ProductStatus;
  featured: boolean;
  rating: number;
  reviewCount: number;
  locationInventory?: LocationInventory[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Cart Types
// ============================================

export interface CartItem {
  _id?: Types.ObjectId | string;
  productId: Types.ObjectId | string;
  variantId?: Types.ObjectId | string;
  quantity: number;
  price: number;
  name: string;
  variantName?: string;
  image?: string;
  purchaseType?: PurchaseType;
  preorderReleaseDate?: Date;
  preorderMessage?: string;
  preorderPaymentMode?: "full" | "deposit" | "pay_later";
  preorderDepositAmount?: number;
  preorderOutstandingAmount?: number;
  preorderSupplierEta?: Date;
  preorderBatchName?: string;
}

export interface ICart {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  sessionId?: string;
  items: CartItem[];
  checkoutToken?: string;
  checkoutUrl?: string;
  email?: string;
  phone?: string;
  customerName?: string;
  customerLocale?: string;
  buyerAcceptsMarketing?: boolean;
  billingAddress?: Address;
  shippingAddress?: Address;
  sourceName?: string;
  landingSite?: string;
  referringSite?: string;
  gateway?: string;
  subtotalPrice?: number;
  shippingPrice?: number;
  totalTax?: number;
  totalDiscounts?: number;
  totalPrice?: number;
  presentmentCurrency?: string;
  checkoutStartedAt?: Date;
  abandonedAt?: Date;
  completedAt?: Date;
  recoveryEmailStatus?: "not_sent" | "sent" | "failed" | "not_applicable";
  recoveryStatus?: "not_recovered" | "recovered";
  emailStatusReason?: string;
  orderId?: Types.ObjectId;
  paymentEvents?: Array<{
    gateway?: string;
    status: "created" | "failed" | "succeeded" | "cancelled";
    message?: string;
    paymentId?: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  lastActionAt: Date;
  status: "active" | "abandoned" | "recovered";
  recoveryToken?: string;
  emailSentAt?: Date;
  recoveredAt?: Date;
}

// ============================================
// Order Types
// ============================================

export interface OrderItem {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  vendorId: Types.ObjectId;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
  purchaseType?: PurchaseType;
  preorderReleaseDate?: Date;
  preorderMessage?: string;
  preorderStatus?: PreorderItemStatus;
  preorderPaymentMode?: "full" | "deposit" | "pay_later";
  preorderDepositAmount?: number;
  preorderOutstandingAmount?: number;
  preorderSupplierEta?: Date;
  preorderBatchName?: string;
  customs?: {
    countryOfOrigin?: string;
    hsCode?: string;
    description?: string;
    weight?: number;
    weightUnit?: WeightUnit;
  };
  // Per-line discount (applied before any order-level discount)
  lineDiscount?: {
    type: "percent" | "amount";
    value: number;
    amount: number;
  };
  // Per-line note attached by the cashier
  lineNote?: string;
}

export interface OrderShippingMethod {
  name?: string;
  optionId?: string;
  minDays?: number;
  maxDays?: number;
}

export interface OrderCustoms {
  dutyAmount: number;
  dutyMode?: "DDP" | "DDU";
  international?: boolean;
  collectedAtCheckout?: boolean;
}

export interface SubOrder {
  _id?: Types.ObjectId;
  vendorId: Types.ObjectId;
  items: OrderItem[];
  subtotal: number;
  commission: number;
  vendorEarnings: number;
  shippingCost?: number;
  shippingMethod?: OrderShippingMethod;
  status: OrderStatus;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  inventoryReserved?: boolean;
  preorderReserved?: boolean;
  payoutStatus?: "unpaid" | "scheduled" | "paid";
  payoutId?: Types.ObjectId;
  payoutDate?: Date;
}

export interface IOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  customerId: Types.ObjectId;
  items: OrderItem[];
  subOrders: SubOrder[];
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paystackReference?: string;
  paystackTransactionId?: string;
  subtotal: number;
  shippingCost: number;
  shippingMethod?: OrderShippingMethod;
  customs?: OrderCustoms;
  tax: number;
  discount: number;
  discountMeta?: {
    source?: "pos" | "coupon" | "manual" | "other";
    type?: "percent" | "amount";
    value?: number;
    reason?: string;
    note?: string;
  };
  coupon?: {
    code: string;
    type?: string;
    value?: number;
  };
  total: number;
  hasPreorder?: boolean;
  preorderStatus?: PreorderItemStatus;
  preorderReleaseDate?: Date;
  preorderReserved?: boolean;
  preorderAcknowledgedAt?: Date;
  preorderPaymentMode?: "full" | "deposit" | "pay_later";
  preorderDepositAmount?: number;
  preorderOutstandingAmount?: number;
  preorderOriginalReleaseDate?: Date;
  preorderDelayReason?: string;
  preorderReleaseDateUpdatedAt?: Date;
  preorderCustomerNotifiedAt?: Date;
  channel: "online" | "pos";
  posLocationId?: string;
  staffId?: string;
  status: OrderStatus;
  trackingNumber?: string;
  carrier?: string;
  processingAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  statusChangedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Review Types
// ============================================

export interface IReviewReply {
  comment: string;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReview {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  isVerified: boolean;
  isApproved: boolean;
  reply?: IReviewReply;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API Types
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ============================================
// Collection Types
// ============================================

export type CollectionConditionField =
  | "title"
  | "productType"
  | "vendor"
  | "tag"
  | "price"
  | "comparePrice"
  | "weight"
  | "stock"
  | "createdAt"
  | "category";

export type CollectionConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "starts_with"
  | "ends_with"
  | "contains"
  | "not_contains"
  | "is_set"
  | "is_not_set";

export interface CollectionCondition {
  field: CollectionConditionField;
  operator: CollectionConditionOperator;
  value: string | number | Date;
}

export type CollectionSortOrder =
  | "manual"
  | "best-selling"
  | "title-asc"
  | "title-desc"
  | "price-asc"
  | "price-desc"
  | "created-asc"
  | "created-desc";

export interface CollectionImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface CollectionSEO {
  pageTitle?: string;
  metaDescription?: string;
  handle?: string;
}

export interface CollectionPublishing {
  onlineStore: boolean;
  pointOfSale: boolean;
}

export interface ICollection {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  handle?: string;
  description?: string;
  descriptionHtml?: string;
  image?: CollectionImage;
  collectionType: "manual" | "automated";
  products: Types.ObjectId[];
  conditions: CollectionCondition[];
  conditionMatch: "all" | "any";
  sortOrder: CollectionSortOrder;
  position: number;
  status: "active" | "draft";
  publishing: CollectionPublishing;
  seo?: CollectionSEO;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Blog Types
// ============================================

export interface BlogSEO {
  pageTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
}

export interface IBlogCategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  order: number;
  isActive: boolean;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BlogPostStatus = "draft" | "scheduled" | "published" | "archived";
export type BlogPostVisibility = "public" | "private" | "password";

export interface BlogPostFeaturedImage {
  url?: string;
  alt?: string;
}

export interface IBlogPost {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: BlogPostFeaturedImage;
  authorId: Types.ObjectId;
  authorName?: string;
  categoryIds: Types.ObjectId[];
  tags: string[];
  status: BlogPostStatus;
  visibility: BlogPostVisibility;
  password?: string;
  publishedAt?: Date;
  scheduledFor?: Date;
  allowComments: boolean;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  readingTime: number;
  seo?: BlogSEO;
  createdAt: Date;
  updatedAt: Date;
}

export type BlogCommentStatus = "pending" | "approved" | "spam" | "trash";

export interface IBlogComment {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  userId?: Types.ObjectId;
  authorName: string;
  authorEmail: string;
  authorWebsite?: string;
  content: string;
  status: BlogCommentStatus;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Menu / Navigation Types
// ============================================

export type MenuLocation =
  | "header"
  | "header-mega"
  | "footer"
  | "mobile"
  | "sidebar"
  | "custom";

export type MenuItemType =
  | "custom"
  | "page"
  | "product"
  | "category"
  | "collection"
  | "brand"
  | "blog"
  | "blog-post"
  | "external";

export interface IMenuItem {
  _id?: Types.ObjectId | string;
  label: string;
  url: string;
  type: MenuItemType;
  target: "_self" | "_blank";
  icon?: string;
  image?: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  isFeatured?: boolean;
  isMegaColumn?: boolean;
  columnTitle?: string;
  children: IMenuItem[];
}

export interface IMenu {
  _id: Types.ObjectId;
  name: string;
  handle: string;
  location: MenuLocation;
  description?: string;
  items: IMenuItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
