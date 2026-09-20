import { VENDOR_STATUS } from "@/config/app.config";
import { AuthorizationError } from "@/lib/api/errors";
import { Vendor } from "@/models";

export async function requireApprovedVendorByUserId(userId: string) {
  const vendor = await Vendor.findOne({ userId }).lean();
  if (!vendor) {
    throw new AuthorizationError("Vendor profile not found");
  }
  if (vendor.status !== VENDOR_STATUS.APPROVED) {
    throw new AuthorizationError("Vendor account is not approved");
  }
  return vendor;
}

