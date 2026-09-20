import { connectDB } from "@/lib/db";
import { User, getSettings } from "@/models";
import { isAdmin, isVendor, isSeller } from "@/lib/rbac";
import type { UserRole } from "@/config/app.config";

/**
 * Two-Factor Authentication policy, sourced from the admin security settings
 * (`settings.security`). These toggles are configured in the admin Two-Factor
 * Authentication settings panel.
 *
 * 2FA is a personal preference rather than a forced gate: the per-role flags
 * decide which roles are *offered* self-service 2FA in their account settings
 * (see `TwoFactorManagementCard`). The master switch turns the feature on at all.
 */
export interface TwoFactorPolicy {
  /** Master switch. When false, 2FA is unavailable to everyone. */
  enabled: boolean;
  /** Offer self-service 2FA to administrators. */
  requiredForAdmin: boolean;
  /** Offer self-service 2FA to approved vendors. */
  requiredForVendors: boolean;
  /** Offer self-service 2FA to staff/seller accounts. */
  requiredForStaff: boolean;
}

/**
 * Read the store-wide 2FA policy from settings.
 */
export async function getTwoFactorPolicy(): Promise<TwoFactorPolicy> {
  const settings = await getSettings();
  const security = settings.security;
  return {
    enabled: Boolean(security?.twoFactorEnabled),
    requiredForAdmin: Boolean(security?.twoFactorRequiredForAdmin),
    requiredForVendors: Boolean(security?.twoFactorRequiredForVendors),
    requiredForStaff: Boolean(security?.twoFactorRequiredForStaff),
  };
}

/**
 * Whether the given user currently has 2FA enrolled.
 *
 * Reads `twoFactorEnabled` fresh from the database rather than from the session.
 * Better Auth's `cookieCache` can serve a stale session for several minutes, and
 * enforcement guards must not bounce a user who just finished enrolling.
 */
export async function isUserTwoFactorEnabled(userId: string): Promise<boolean> {
  await connectDB();
  const user = await User.findById(userId)
    .select("twoFactorEnabled")
    .lean<{ twoFactorEnabled?: boolean } | null>();
  return Boolean(user?.twoFactorEnabled);
}

/**
 * Whether the store policy marks 2FA as expected for this user's role.
 *
 * 2FA is offered as a personal preference (see `TwoFactorManagementCard`), so
 * this is used only for soft signalling/copy — it does not gate access.
 */
export function isTwoFactorRequiredForRole(
  user: { role?: UserRole; roles?: UserRole[] },
  policy: TwoFactorPolicy,
): boolean {
  if (!policy.enabled) return false;
  return (
    (isAdmin(user) && policy.requiredForAdmin) ||
    (isVendor(user) && policy.requiredForVendors) ||
    (isSeller(user) && policy.requiredForStaff)
  );
}

/**
 * Whether self-service 2FA should be offered to this user in their account
 * settings. Privileged roles (admin / vendor / staff) are gated by their
 * per-role toggle; everyone else (e.g. customers) is governed by the master
 * switch alone. Used by the profile/security pages to show or hide the
 * `TwoFactorManagementCard`.
 */
export function isTwoFactorAvailableForUser(
  user: { role?: UserRole; roles?: UserRole[] },
  policy: TwoFactorPolicy,
): boolean {
  if (!policy.enabled) return false;
  if (isAdmin(user)) return policy.requiredForAdmin;
  if (isVendor(user)) return policy.requiredForVendors;
  if (isSeller(user)) return policy.requiredForStaff;
  return true;
}
