import { StaffProfile } from "@/models";
import type { Types } from "mongoose";

/**
 * Platform staff (managed by the admin) have an empty `vendorIds` array, while
 * vendor staff carry the owning vendor(s) in `vendorIds`. These helpers keep the
 * admin staff surface scoped to platform-only staff so vendors' staff never leak
 * into the admin views.
 */

/** User IDs of staff whose profile belongs to one or more vendors. */
export async function getVendorScopedStaffUserIds(): Promise<Types.ObjectId[]> {
  const profiles = await StaffProfile.find({
    "vendorIds.0": { $exists: true },
  })
    .select("userId")
    .lean();
  return profiles.map((profile) => profile.userId);
}

/** Whether a given staff user belongs to a vendor (and is thus off-limits to admin). */
export async function isVendorScopedStaff(
  userId: string | Types.ObjectId,
): Promise<boolean> {
  const profile = await StaffProfile.findOne({ userId })
    .select("vendorIds")
    .lean();
  return Array.isArray(profile?.vendorIds) && profile.vendorIds.length > 0;
}
