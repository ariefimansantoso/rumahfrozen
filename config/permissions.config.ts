/**
 * Permissions Configuration
 * Central configuration for RBAC permissions across the platform
 */

// ============================================
// Admin Permissions
// ============================================

export const ADMIN_PERMISSIONS = {
  // User Management
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",

  // Vendor Management
  APPROVE_VENDORS: "approve_vendors",
  MANAGE_VENDORS: "manage_vendors",

  // Product Management
  MANAGE_ALL_PRODUCTS: "manage_all_products",

  // Order Management
  VIEW_ALL_ORDERS: "view_all_orders",
  MANAGE_ALL_ORDERS: "manage_all_orders",

  // Category Management
  MANAGE_CATEGORIES: "manage_categories",

  // Settings
  MANAGE_SETTINGS: "manage_settings",

  // Analytics
  VIEW_ANALYTICS: "view_analytics",

  // Finance
  VIEW_PAYMENTS: "view_payments",
  MANAGE_REFUNDS: "manage_refunds",
  MANAGE_PAYOUTS: "manage_payouts",
} as const;

export type AdminPermission =
  (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

// ============================================
// Vendor Permissions (for vendor staff/seller)
// ============================================

export const VENDOR_PERMISSIONS = {
  // Products
  VIEW_PRODUCTS: "view_products",
  MANAGE_PRODUCTS: "manage_products",
  CREATE_PRODUCTS: "create_products",
  EDIT_PRODUCTS: "edit_products",
  DELETE_PRODUCTS: "delete_products",

  // Orders
  VIEW_ORDERS: "view_orders",
  MANAGE_ORDERS: "manage_orders",
  CREATE_ORDERS: "create_orders",
  EDIT_ORDERS: "edit_orders",
  DELETE_ORDERS: "delete_orders",

  // Store settings
  VIEW_STORE_SETTINGS: "view_store_settings",
  MANAGE_STORE_SETTINGS: "manage_store_settings",
  CREATE_STORE_SETTINGS: "create_store_settings",
  EDIT_STORE_SETTINGS: "edit_store_settings",
  DELETE_STORE_SETTINGS: "delete_store_settings",

  // Staff
  VIEW_STAFF: "view_staff",
  MANAGE_STAFF: "manage_staff",
  CREATE_STAFF: "create_staff",
  EDIT_STAFF: "edit_staff",
  DELETE_STAFF: "delete_staff",

  // Analytics
  VIEW_ANALYTICS: "view_analytics",
  CREATE_ANALYTICS: "create_analytics",
  EDIT_ANALYTICS: "edit_analytics",
  DELETE_ANALYTICS: "delete_analytics",

  // Brands (vendor-created brands enter an admin moderation queue; deletion is
  // admin-only via soft-delete, so there is no vendor delete permission).
  VIEW_BRANDS: "view_brands",
  CREATE_BRANDS: "create_brands",
  EDIT_BRANDS: "edit_brands",

  // Discounts
  VIEW_DISCOUNTS: "view_discounts",
  MANAGE_DISCOUNTS: "manage_discounts",
  CREATE_DISCOUNTS: "create_discounts",
  EDIT_DISCOUNTS: "edit_discounts",
  DELETE_DISCOUNTS: "delete_discounts",

  // Payouts
  VIEW_PAYOUTS: "view_payouts",
  MANAGE_PAYOUTS: "manage_payouts",
  CREATE_PAYOUTS: "create_payouts",
  EDIT_PAYOUTS: "edit_payouts",
  DELETE_PAYOUTS: "delete_payouts",

  // POS
  ACCESS_POS: "access_pos",
  CREATE_POS: "create_pos",
  EDIT_POS: "edit_pos",
  DELETE_POS: "delete_pos",
} as const;

export type VendorPermission =
  (typeof VENDOR_PERMISSIONS)[keyof typeof VENDOR_PERMISSIONS];

// ============================================
// Default Permission Sets
// ============================================

// Super admin gets all permissions
export const SUPER_ADMIN_PERMISSIONS = Object.values(ADMIN_PERMISSIONS);

// Regular admin may have limited permissions
export const DEFAULT_ADMIN_PERMISSIONS = [
  ADMIN_PERMISSIONS.VIEW_USERS,
  ADMIN_PERMISSIONS.VIEW_ALL_ORDERS,
  ADMIN_PERMISSIONS.VIEW_ANALYTICS,
  ADMIN_PERMISSIONS.VIEW_PAYMENTS,
];

// Full vendor (store owner) gets all vendor permissions
export const DEFAULT_VENDOR_PERMISSIONS = Object.values(VENDOR_PERMISSIONS);
export const ALL_VENDOR_PERMISSIONS = Object.values(VENDOR_PERMISSIONS);

// Seller role (limited vendor staff) - can only manage products and view orders
export const SELLER_PERMISSIONS: VendorPermission[] = [
  VENDOR_PERMISSIONS.VIEW_PRODUCTS,
  VENDOR_PERMISSIONS.VIEW_ORDERS,
];

// ============================================
// Staff Permissions (for seller/staff role)
// ============================================

export const STAFF_PERMISSIONS = {
  // POS
  ACCESS_POS: "access_pos",
  MANAGE_POS: "manage_pos",
  CREATE_POS: "create_pos",
  EDIT_POS: "edit_pos",
  DELETE_POS: "delete_pos",

  // Orders
  VIEW_ORDERS: "view_orders",
  MANAGE_ORDERS: "manage_orders",
  CREATE_ORDERS: "create_orders",
  EDIT_ORDERS: "edit_orders",
  DELETE_ORDERS: "delete_orders",

  // Products
  VIEW_PRODUCTS: "view_products",
  MANAGE_PRODUCTS: "manage_products",
  CREATE_PRODUCTS: "create_products",
  EDIT_PRODUCTS: "edit_products",
  DELETE_PRODUCTS: "delete_products",

  // Customers
  VIEW_CUSTOMERS: "view_customers",
  MANAGE_CUSTOMERS: "manage_customers",
  CREATE_CUSTOMERS: "create_customers",
  EDIT_CUSTOMERS: "edit_customers",
  DELETE_CUSTOMERS: "delete_customers",

  // Inventory
  VIEW_INVENTORY: "view_inventory",
  MANAGE_INVENTORY: "manage_inventory",
  CREATE_INVENTORY: "create_inventory",
  EDIT_INVENTORY: "edit_inventory",
  DELETE_INVENTORY: "delete_inventory",

  // Reviews
  VIEW_REVIEWS: "view_reviews",
  MANAGE_REVIEWS: "manage_reviews",
  EDIT_REVIEWS: "edit_reviews",
  DELETE_REVIEWS: "delete_reviews",

  // Analytics (view-only)
  VIEW_ANALYTICS: "view_analytics",
} as const;

export type StaffPermission =
  (typeof STAFF_PERMISSIONS)[keyof typeof STAFF_PERMISSIONS];

// Default staff permissions (new staff get these)
export const DEFAULT_STAFF_PERMISSIONS: StaffPermission[] = [
  STAFF_PERMISSIONS.ACCESS_POS,
  STAFF_PERMISSIONS.VIEW_ORDERS,
  STAFF_PERMISSIONS.VIEW_PRODUCTS,
  STAFF_PERMISSIONS.VIEW_CUSTOMERS,
];

// All staff permissions
export const ALL_STAFF_PERMISSIONS = Object.values(STAFF_PERMISSIONS);
