/**
 * RBAC (Role-Based Access Control) Utilities
 * Provides functions and middleware for permission checking
 */

import { USER_ROLES, type UserRole } from "@/config/app.config";
import { isStaffRole } from "@/lib/staff-role";
import {
  ADMIN_PERMISSIONS,
  DEFAULT_VENDOR_PERMISSIONS,
  VENDOR_PERMISSIONS,
  STAFF_PERMISSIONS,
  type AdminPermission,
  type VendorPermission,
  type StaffPermission,
} from "@/config/permissions.config";
import { AdminProfile, type IAdminProfile } from "@/models/admin-profile.model";
import { StaffProfile, type IStaffProfile } from "@/models/staff-profile.model";
import type { IUser } from "@/types";

// ============================================
// Role Checking Utilities
// ============================================

type MinimalUser =
  | { id?: string; role?: UserRole; roles?: UserRole[] }
  | null
  | undefined;

/**
 * Check if user has a specific role
 */
export function hasRole(
  user: MinimalUser,
  role: UserRole,
): boolean {
  if (!user) return false;
  // Check both legacy 'role' field and new 'roles' array
  return user.roles?.includes(role) || user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(
  user: MinimalUser,
  roles: UserRole[],
): boolean {
  if (!user) return false;
  return roles.some((role) => hasRole(user, role));
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: MinimalUser): boolean {
  return hasRole(user, USER_ROLES.ADMIN);
}

/**
 * Check if user is a vendor
 */
export function isVendor(user: MinimalUser): boolean {
  return hasRole(user, USER_ROLES.VENDOR);
}

/**
 * Check if user is a customer
 */
export function isCustomer(user: MinimalUser): boolean {
  return hasRole(user, USER_ROLES.CUSTOMER);
}

// ============================================
// Permission Checking Utilities
// ============================================

/**
 * Get admin profile with permissions
 */
export async function getAdminProfile(
  userId: string,
): Promise<IAdminProfile | null> {
  try {
    const profile = await AdminProfile.findOne({ userId });
    return profile;
  } catch {
    return null;
  }
}

/**
 * Check if admin user has a specific permission
 */
export async function hasAdminPermission(
  userId: string,
  permission: AdminPermission,
): Promise<boolean> {
  const profile = await getAdminProfile(userId);
  if (!profile) return false;
  if (profile.isSuperAdmin) return true;
  return profile.permissions.includes(permission);
}

/**
 * Check if admin user has any of the specified permissions
 */
export async function hasAnyAdminPermission(
  userId: string,
  permissions: AdminPermission[],
): Promise<boolean> {
  const profile = await getAdminProfile(userId);
  if (!profile) return false;
  if (profile.isSuperAdmin) return true;
  return permissions.some((p) => profile.permissions.includes(p));
}

/**
 * Check if admin user has all of the specified permissions
 */
export async function hasAllAdminPermissions(
  userId: string,
  permissions: AdminPermission[],
): Promise<boolean> {
  const profile = await getAdminProfile(userId);
  if (!profile) return false;
  if (profile.isSuperAdmin) return true;
  return permissions.every((p) => profile.permissions.includes(p));
}

// ============================================
// Route Guard Helpers (for API routes)
// ============================================

/**
 * Create a role requirement check for API routes
 * Usage: const check = requireRoles('admin', 'vendor'); if (!check(user)) return 403;
 */
export function requireRoles(...roles: UserRole[]) {
  return (user: IUser | null | undefined): boolean => {
    return hasAnyRole(user, roles);
  };
}

/**
 * Create a permission requirement check for API routes
 * Usage: const check = await requirePermission(userId, 'manage_users'); if (!check) return 403;
 */
export async function requirePermission(
  userId: string,
  permission: AdminPermission,
): Promise<boolean> {
  return hasAdminPermission(userId, permission);
}

// ============================================
// Vendor Permission Checking
// ============================================

/**
 * Check if user is a seller (staff role for POS)
 */
export function isSeller(user: MinimalUser): boolean {
  return isStaffRole(user?.role) || hasRole(user, USER_ROLES.SELLER);
}

/**
 * Check if user can access vendor features (vendor, admin, or seller)
 */
export function canAccessVendorFeatures(
  user: MinimalUser,
): boolean {
  return hasAnyRole(user, [
    USER_ROLES.VENDOR,
    USER_ROLES.ADMIN,
    USER_ROLES.STAFF,
    USER_ROLES.SELLER,
  ]);
}

/**
 * Get vendor permissions from database settings
 * Returns default permissions if settings not available
 */
export async function getVendorPermissions(): Promise<{
  canManageProducts: boolean;
  canViewOrders: boolean;
  canManageOrders: boolean;
  canManageStoreSettings: boolean;
  canViewAnalytics: boolean;
  canManageDiscounts: boolean;
  canManagePayouts: boolean;
  canAccessPOS: boolean;
}> {
  try {
    // Import dynamically to avoid circular dependencies
    const { getSettings } = await import("@/models/settings.model");
    const settings = await getSettings();

    const settingsWithVendorPermissions = settings as {
      multiVendorMode?: {
        canManageProducts: boolean;
        canViewOrders: boolean;
        canManageOrders: boolean;
        canManageStoreSettings: boolean;
        canViewAnalytics: boolean;
        canManageDiscounts?: boolean;
        canManagePayouts: boolean;
        canAccessPOS: boolean;
      };
    };

    const multiVendorMode = settingsWithVendorPermissions.multiVendorMode;
    return {
      canManageProducts: multiVendorMode?.canManageProducts ?? true,
      canViewOrders: multiVendorMode?.canViewOrders ?? true,
      canManageOrders: multiVendorMode?.canManageOrders ?? true,
      canManageStoreSettings: multiVendorMode?.canManageStoreSettings ?? true,
      canViewAnalytics: multiVendorMode?.canViewAnalytics ?? true,
      canManageDiscounts:
        multiVendorMode?.canManageDiscounts ??
        multiVendorMode?.canManageProducts ??
        true,
      canManagePayouts: multiVendorMode?.canManagePayouts ?? true,
      canAccessPOS: multiVendorMode?.canAccessPOS ?? true,
    };
  } catch {
    // Return default permissions if settings unavailable
    return {
      canManageProducts: true,
      canViewOrders: true,
      canManageOrders: true,
      canManageStoreSettings: true,
      canViewAnalytics: true,
      canManageDiscounts: true,
      canManagePayouts: true,
      canAccessPOS: true,
    };
  }
}

/**
 * Check if vendor has a specific permission
 * Admins always have all permissions
 */
export async function hasVendorPermission(
  user: MinimalUser,
  permission: VendorPermission,
): Promise<boolean> {
  if (!user) return false;

  // Admins have all vendor permissions
  if (isAdmin(user)) return true;

  // Must be a vendor to have vendor permissions
  if (!isVendor(user) || !user.id) return false;

  await (await import("@/lib/db")).connectDB();
  const vendorProfile = await (await import("@/models")).Vendor.findOne({
    userId: user.id,
  })
    .select("permissions")
    .lean();
  const vendorPermissionList =
    (vendorProfile as { permissions?: VendorPermission[] } | null)?.permissions;
  const assigned = Array.isArray(vendorPermissionList)
    ? vendorPermissionList
    : DEFAULT_VENDOR_PERMISSIONS;

  const aliases: Record<VendorPermission, VendorPermission[]> = {
    [VENDOR_PERMISSIONS.VIEW_PRODUCTS]: [
      VENDOR_PERMISSIONS.VIEW_PRODUCTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.MANAGE_PRODUCTS]: [
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.CREATE_PRODUCTS]: [
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.EDIT_PRODUCTS]: [
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.DELETE_PRODUCTS]: [
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.VIEW_ORDERS]: [
      VENDOR_PERMISSIONS.VIEW_ORDERS,
      VENDOR_PERMISSIONS.MANAGE_ORDERS,
      VENDOR_PERMISSIONS.CREATE_ORDERS,
      VENDOR_PERMISSIONS.EDIT_ORDERS,
      VENDOR_PERMISSIONS.DELETE_ORDERS,
    ],
    [VENDOR_PERMISSIONS.MANAGE_ORDERS]: [
      VENDOR_PERMISSIONS.MANAGE_ORDERS,
      VENDOR_PERMISSIONS.CREATE_ORDERS,
      VENDOR_PERMISSIONS.EDIT_ORDERS,
      VENDOR_PERMISSIONS.DELETE_ORDERS,
    ],
    [VENDOR_PERMISSIONS.CREATE_ORDERS]: [
      VENDOR_PERMISSIONS.CREATE_ORDERS,
      VENDOR_PERMISSIONS.MANAGE_ORDERS,
    ],
    [VENDOR_PERMISSIONS.EDIT_ORDERS]: [
      VENDOR_PERMISSIONS.EDIT_ORDERS,
      VENDOR_PERMISSIONS.MANAGE_ORDERS,
    ],
    [VENDOR_PERMISSIONS.DELETE_ORDERS]: [
      VENDOR_PERMISSIONS.DELETE_ORDERS,
      VENDOR_PERMISSIONS.MANAGE_ORDERS,
    ],
    [VENDOR_PERMISSIONS.VIEW_STORE_SETTINGS]: [
      VENDOR_PERMISSIONS.VIEW_STORE_SETTINGS,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
      VENDOR_PERMISSIONS.CREATE_STORE_SETTINGS,
      VENDOR_PERMISSIONS.EDIT_STORE_SETTINGS,
      VENDOR_PERMISSIONS.DELETE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS]: [
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
      VENDOR_PERMISSIONS.CREATE_STORE_SETTINGS,
      VENDOR_PERMISSIONS.EDIT_STORE_SETTINGS,
      VENDOR_PERMISSIONS.DELETE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.CREATE_STORE_SETTINGS]: [
      VENDOR_PERMISSIONS.CREATE_STORE_SETTINGS,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.EDIT_STORE_SETTINGS]: [
      VENDOR_PERMISSIONS.EDIT_STORE_SETTINGS,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.DELETE_STORE_SETTINGS]: [
      VENDOR_PERMISSIONS.DELETE_STORE_SETTINGS,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.VIEW_STAFF]: [
      VENDOR_PERMISSIONS.VIEW_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STAFF,
      VENDOR_PERMISSIONS.CREATE_STAFF,
      VENDOR_PERMISSIONS.EDIT_STAFF,
      VENDOR_PERMISSIONS.DELETE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.MANAGE_STAFF]: [
      VENDOR_PERMISSIONS.MANAGE_STAFF,
      VENDOR_PERMISSIONS.CREATE_STAFF,
      VENDOR_PERMISSIONS.EDIT_STAFF,
      VENDOR_PERMISSIONS.DELETE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.CREATE_STAFF]: [
      VENDOR_PERMISSIONS.CREATE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.EDIT_STAFF]: [
      VENDOR_PERMISSIONS.EDIT_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.DELETE_STAFF]: [
      VENDOR_PERMISSIONS.DELETE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
    [VENDOR_PERMISSIONS.VIEW_ANALYTICS]: [
      VENDOR_PERMISSIONS.VIEW_ANALYTICS,
      VENDOR_PERMISSIONS.CREATE_ANALYTICS,
      VENDOR_PERMISSIONS.EDIT_ANALYTICS,
      VENDOR_PERMISSIONS.DELETE_ANALYTICS,
    ],
    [VENDOR_PERMISSIONS.CREATE_ANALYTICS]: [VENDOR_PERMISSIONS.CREATE_ANALYTICS],
    [VENDOR_PERMISSIONS.EDIT_ANALYTICS]: [VENDOR_PERMISSIONS.EDIT_ANALYTICS],
    [VENDOR_PERMISSIONS.DELETE_ANALYTICS]: [VENDOR_PERMISSIONS.DELETE_ANALYTICS],
    [VENDOR_PERMISSIONS.VIEW_BRANDS]: [
      VENDOR_PERMISSIONS.VIEW_BRANDS,
      VENDOR_PERMISSIONS.CREATE_BRANDS,
      VENDOR_PERMISSIONS.EDIT_BRANDS,
    ],
    [VENDOR_PERMISSIONS.CREATE_BRANDS]: [VENDOR_PERMISSIONS.CREATE_BRANDS],
    [VENDOR_PERMISSIONS.EDIT_BRANDS]: [VENDOR_PERMISSIONS.EDIT_BRANDS],
    [VENDOR_PERMISSIONS.VIEW_DISCOUNTS]: [
      VENDOR_PERMISSIONS.VIEW_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_DISCOUNTS,
      VENDOR_PERMISSIONS.CREATE_DISCOUNTS,
      VENDOR_PERMISSIONS.EDIT_DISCOUNTS,
      VENDOR_PERMISSIONS.DELETE_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.MANAGE_DISCOUNTS]: [
      VENDOR_PERMISSIONS.MANAGE_DISCOUNTS,
      VENDOR_PERMISSIONS.CREATE_DISCOUNTS,
      VENDOR_PERMISSIONS.EDIT_DISCOUNTS,
      VENDOR_PERMISSIONS.DELETE_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.CREATE_DISCOUNTS]: [
      VENDOR_PERMISSIONS.CREATE_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.EDIT_DISCOUNTS]: [
      VENDOR_PERMISSIONS.EDIT_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.DELETE_DISCOUNTS]: [
      VENDOR_PERMISSIONS.DELETE_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_DISCOUNTS,
      VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    ],
    [VENDOR_PERMISSIONS.VIEW_PAYOUTS]: [
      VENDOR_PERMISSIONS.VIEW_PAYOUTS,
      VENDOR_PERMISSIONS.MANAGE_PAYOUTS,
      VENDOR_PERMISSIONS.CREATE_PAYOUTS,
      VENDOR_PERMISSIONS.EDIT_PAYOUTS,
      VENDOR_PERMISSIONS.DELETE_PAYOUTS,
    ],
    [VENDOR_PERMISSIONS.MANAGE_PAYOUTS]: [
      VENDOR_PERMISSIONS.MANAGE_PAYOUTS,
      VENDOR_PERMISSIONS.CREATE_PAYOUTS,
      VENDOR_PERMISSIONS.EDIT_PAYOUTS,
      VENDOR_PERMISSIONS.DELETE_PAYOUTS,
    ],
    [VENDOR_PERMISSIONS.CREATE_PAYOUTS]: [
      VENDOR_PERMISSIONS.CREATE_PAYOUTS,
      VENDOR_PERMISSIONS.MANAGE_PAYOUTS,
    ],
    [VENDOR_PERMISSIONS.EDIT_PAYOUTS]: [
      VENDOR_PERMISSIONS.EDIT_PAYOUTS,
      VENDOR_PERMISSIONS.MANAGE_PAYOUTS,
    ],
    [VENDOR_PERMISSIONS.DELETE_PAYOUTS]: [
      VENDOR_PERMISSIONS.DELETE_PAYOUTS,
      VENDOR_PERMISSIONS.MANAGE_PAYOUTS,
    ],
    [VENDOR_PERMISSIONS.ACCESS_POS]: [
      VENDOR_PERMISSIONS.ACCESS_POS,
      VENDOR_PERMISSIONS.CREATE_POS,
      VENDOR_PERMISSIONS.EDIT_POS,
      VENDOR_PERMISSIONS.DELETE_POS,
    ],
    [VENDOR_PERMISSIONS.CREATE_POS]: [
      VENDOR_PERMISSIONS.CREATE_POS,
      VENDOR_PERMISSIONS.ACCESS_POS,
    ],
    [VENDOR_PERMISSIONS.EDIT_POS]: [
      VENDOR_PERMISSIONS.EDIT_POS,
      VENDOR_PERMISSIONS.ACCESS_POS,
    ],
    [VENDOR_PERMISSIONS.DELETE_POS]: [
      VENDOR_PERMISSIONS.DELETE_POS,
      VENDOR_PERMISSIONS.ACCESS_POS,
    ],
  };

  const hasAssignedPermission = (aliases[permission] || [permission]).some((p) =>
    assigned.includes(p),
  );
  if (!hasAssignedPermission) return false;

  const vendorPermissions = await getVendorPermissions();
  const permissionMap: Record<
    VendorPermission,
    keyof typeof vendorPermissions
  > = {
    [VENDOR_PERMISSIONS.VIEW_PRODUCTS]: "canManageProducts",
    [VENDOR_PERMISSIONS.MANAGE_PRODUCTS]: "canManageProducts",
    [VENDOR_PERMISSIONS.CREATE_PRODUCTS]: "canManageProducts",
    [VENDOR_PERMISSIONS.EDIT_PRODUCTS]: "canManageProducts",
    [VENDOR_PERMISSIONS.DELETE_PRODUCTS]: "canManageProducts",
    [VENDOR_PERMISSIONS.VIEW_ORDERS]: "canViewOrders",
    [VENDOR_PERMISSIONS.MANAGE_ORDERS]: "canManageOrders",
    [VENDOR_PERMISSIONS.CREATE_ORDERS]: "canManageOrders",
    [VENDOR_PERMISSIONS.EDIT_ORDERS]: "canManageOrders",
    [VENDOR_PERMISSIONS.DELETE_ORDERS]: "canManageOrders",
    [VENDOR_PERMISSIONS.VIEW_STORE_SETTINGS]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.CREATE_STORE_SETTINGS]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.EDIT_STORE_SETTINGS]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.DELETE_STORE_SETTINGS]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.VIEW_STAFF]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.MANAGE_STAFF]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.CREATE_STAFF]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.EDIT_STAFF]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.DELETE_STAFF]: "canManageStoreSettings",
    [VENDOR_PERMISSIONS.VIEW_ANALYTICS]: "canViewAnalytics",
    [VENDOR_PERMISSIONS.CREATE_ANALYTICS]: "canViewAnalytics",
    [VENDOR_PERMISSIONS.EDIT_ANALYTICS]: "canViewAnalytics",
    [VENDOR_PERMISSIONS.DELETE_ANALYTICS]: "canViewAnalytics",
    [VENDOR_PERMISSIONS.VIEW_BRANDS]: "canManageProducts",
    [VENDOR_PERMISSIONS.CREATE_BRANDS]: "canManageProducts",
    [VENDOR_PERMISSIONS.EDIT_BRANDS]: "canManageProducts",
    [VENDOR_PERMISSIONS.VIEW_DISCOUNTS]: "canManageDiscounts",
    [VENDOR_PERMISSIONS.MANAGE_DISCOUNTS]: "canManageDiscounts",
    [VENDOR_PERMISSIONS.CREATE_DISCOUNTS]: "canManageDiscounts",
    [VENDOR_PERMISSIONS.EDIT_DISCOUNTS]: "canManageDiscounts",
    [VENDOR_PERMISSIONS.DELETE_DISCOUNTS]: "canManageDiscounts",
    [VENDOR_PERMISSIONS.VIEW_PAYOUTS]: "canManagePayouts",
    [VENDOR_PERMISSIONS.MANAGE_PAYOUTS]: "canManagePayouts",
    [VENDOR_PERMISSIONS.CREATE_PAYOUTS]: "canManagePayouts",
    [VENDOR_PERMISSIONS.EDIT_PAYOUTS]: "canManagePayouts",
    [VENDOR_PERMISSIONS.DELETE_PAYOUTS]: "canManagePayouts",
    [VENDOR_PERMISSIONS.ACCESS_POS]: "canAccessPOS",
    [VENDOR_PERMISSIONS.CREATE_POS]: "canAccessPOS",
    [VENDOR_PERMISSIONS.EDIT_POS]: "canAccessPOS",
    [VENDOR_PERMISSIONS.DELETE_POS]: "canAccessPOS",
  };

  const settingsKey = permissionMap[permission];
  return settingsKey ? vendorPermissions[settingsKey] : false;
}

/**
 * Check if user can access POS (based on role and settings)
 */
export async function canAccessPOS(
  user: MinimalUser,
): Promise<boolean> {
  if (!user) return false;

  try {
    const { getSettings } = await import("@/models/settings.model");
    const settings = await getSettings();

    if (!settings.pos?.enabled) return false;

    if (isAdmin(user) && settings.pos.allowAdminSales) return true;
    if (isVendor(user) && settings.pos.allowVendorSales) return true;
    if (isSeller(user) && settings.pos.allowSellerSales) {
      if (!user.id) return false;
      const profile = await getStaffProfile(user.id);
      if (!profile?.isActive) return false;
      return profile.permissions.includes(STAFF_PERMISSIONS.ACCESS_POS);
    }

    return false;
  } catch {
    return false;
  }
}

// ============================================
// Staff Permission Checking
// ============================================

/**
 * Get staff profile with permissions
 */
export async function getStaffProfile(
  userId: string,
): Promise<IStaffProfile | null> {
  try {
    const profile = await StaffProfile.findOne({ userId });
    return profile;
  } catch {
    return null;
  }
}

/**
 * Check if staff user has a specific permission
 */
export async function hasStaffPermission(
  userId: string,
  permission: StaffPermission,
): Promise<boolean> {
  // Admins have all staff permissions
  const profile = await getStaffProfile(userId);
  if (!profile || !profile.isActive) return false;
  return profile.permissions.includes(permission);
}

/**
 * Check if staff user has any of the specified permissions
 */
export async function hasAnyStaffPermission(
  userId: string,
  permissions: StaffPermission[],
): Promise<boolean> {
  const profile = await getStaffProfile(userId);
  if (!profile || !profile.isActive) return false;
  return permissions.some((p) => profile.permissions.includes(p));
}

// ============================================
// Exports for convenience
// ============================================

export { ADMIN_PERMISSIONS, VENDOR_PERMISSIONS, STAFF_PERMISSIONS };
export type { AdminPermission, VendorPermission, StaffPermission };
