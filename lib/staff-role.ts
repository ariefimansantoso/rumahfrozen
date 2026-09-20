import { USER_ROLES } from "@/config/app.config";

export const STAFF_USER_ROLES = [USER_ROLES.STAFF, USER_ROLES.SELLER] as const;

export function isStaffRole(role?: string | null) {
  return role === USER_ROLES.STAFF || role === USER_ROLES.SELLER;
}
