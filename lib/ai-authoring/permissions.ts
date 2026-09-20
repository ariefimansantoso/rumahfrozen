import { AuthorizationError } from "@/lib/api/errors";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import type { IUser } from "@/types";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import type { AIAuthoringRequest } from "./types";

export async function assertVendorAuthoringAccess(
  user: IUser,
  request: AIAuthoringRequest,
) {
  const userId = String((user as IUser & { id?: string }).id || user._id);
  if (!isAdmin(user)) {
    const permission =
      request.entity === "brand"
        ? VENDOR_PERMISSIONS.EDIT_BRANDS
        : VENDOR_PERMISSIONS.EDIT_PRODUCTS;
    const allowed = await hasVendorPermission(user, permission);
    if (!allowed) {
      throw new AuthorizationError(
        "You do not have permission to use AI authoring for this surface",
      );
    }
  }

  await requireApprovedVendorByUserId(userId);
}
