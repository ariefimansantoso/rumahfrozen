import { USER_ROLES, type UserRole } from "@/config/app.config";

export type EmailVerificationStatus =
  | "verified"
  | "not_required"
  | "grace_pending"
  | "blocked_pending";

export type EmailVerificationPolicySettings = {
  emailVerificationRequired: boolean;
  emailVerificationForVendors: boolean;
  emailVerificationRequiredSince?: Date;
  emailVerificationForVendorsSince?: Date;
  emailDeliveryReady: boolean;
};

export type EmailVerificationPolicyUser = {
  role: UserRole;
  emailVerified: boolean;
  createdAt?: Date;
  emailVerificationRequiredAt?: Date;
};

export function resolveEmailVerificationPolicyRole(
  role: UserRole,
  audience?: string,
): UserRole {
  return role === USER_ROLES.VENDOR || audience === USER_ROLES.VENDOR
    ? USER_ROLES.VENDOR
    : role;
}

export function resolveEmailVerificationStatus(
  user: EmailVerificationPolicyUser,
  settings: EmailVerificationPolicySettings,
): EmailVerificationStatus {
  if (user.emailVerified) return "verified";

  const isCustomer = user.role === USER_ROLES.CUSTOMER;
  const isVendor = user.role === USER_ROLES.VENDOR;
  if (!isCustomer && !isVendor) return "not_required";

  const enabled = isVendor
    ? settings.emailVerificationForVendors
    : settings.emailVerificationRequired;
  if (!enabled || !settings.emailDeliveryReady) return "not_required";

  const enforcedFrom = isVendor
    ? settings.emailVerificationForVendorsSince
    : settings.emailVerificationRequiredSince;
  if (!enforcedFrom) return "grace_pending";

  const requirementStartedAt = isVendor
    ? user.emailVerificationRequiredAt || user.createdAt
    : user.createdAt;

  if (!requirementStartedAt || requirementStartedAt < enforcedFrom) {
    return "grace_pending";
  }

  return "blocked_pending";
}
