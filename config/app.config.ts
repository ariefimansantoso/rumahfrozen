/**
 * Application Configuration
 * Central configuration for the Storify e-commerce platform
 */

import { DEFAULT_STORE_NAME } from "./branding.config";

export const appConfig = {
  // App Info
  name: DEFAULT_STORE_NAME,
  description: "Multi-vendor E-commerce Platform",
  // Brand tagline shown after the store name in the homepage title.
  tagline: "AI powered eCommerce Operating System",
  version: "1.0.0",

  // Default vendor slug (used in single-vendor mode)
  // Multi-vendor mode is controlled via database: settings.multiVendorMode.enabled
  defaultVendorSlug: "main-store",

  // Commission Settings (for multi-vendor mode)
  defaultCommission: 10, // Percentage

  // Pagination
  defaultPageSize: 12,
  maxPageSize: 100,

  // Image Upload
  maxImageSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  maxProductImages: 10,

  // Cart
  cartExpiryDays: 30,
  maxCartItems: 50,

  // Order
  orderNumberPrefix: "ORD",

  // Currency
  currency: {
    code: "USD",
    symbol: "$",
    locale: "en-US",
  },

  // URLs
  urls: {
    home: "/",
    login: "/login",
    register: "/register",
    adminDashboard: "/admin/dashboard",
    vendorDashboard: "/vendor/dashboard",
    staffDashboard: "/staff/dashboard",
    customerOrders: "/account/orders",
  },
} as const;

// User Roles
export const USER_ROLES = {
  CUSTOMER: "customer",
  VENDOR: "vendor",
  ADMIN: "admin",
  STAFF: "staff",
  SELLER: "seller", // Legacy staff role retained for existing accounts
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// User Account Statuses
export const USER_ACCOUNT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BANNED: "banned",
} as const;

export type UserAccountStatus =
  (typeof USER_ACCOUNT_STATUS)[keyof typeof USER_ACCOUNT_STATUS];

// Order Statuses
export const ORDER_STATUS = {
  PREORDERED: "preordered",
  PENDING: "pending",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// Payment Statuses
export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  PARTIALLY_PAID: "partially_paid",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// Product Statuses
export const PRODUCT_STATUS = {
  ACTIVE: "active",
  DRAFT: "draft",
  UNLISTED: "unlisted",
} as const;

export type ProductStatus =
  (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

// Vendor Statuses
export const VENDOR_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
} as const;

export type VendorStatus = (typeof VENDOR_STATUS)[keyof typeof VENDOR_STATUS];
