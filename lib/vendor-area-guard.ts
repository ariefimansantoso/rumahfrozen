import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { USER_ACCOUNT_STATUS, USER_ROLES, VENDOR_STATUS } from "@/config/app.config";
import { DEFAULT_VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { connectDB } from "@/lib/db";
import { User, Vendor } from "@/models";
import type { VendorPermission } from "@/config/permissions.config";
export type VendorAreaAccess = {
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  vendor: {
    _id?: unknown;
    storeName?: string;
    logo?: string;
    status?: string;
    permissions?: VendorPermission[];
  };
  vendorPermissions: VendorPermission[];
  isApproved: boolean;
};

export async function requireVendorAreaAccess(params: {
  locale: string;
  required?: VendorPermission[];
  mode?: "any" | "all";
}): Promise<VendorAreaAccess> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/${params.locale}/login?callbackUrl=/${params.locale}/vendor/dashboard`);

  if (session.user.role === USER_ROLES.ADMIN) {
    redirect(`/${params.locale}/admin/dashboard`);
  }

  await connectDB();
  const [vendor, user] = await Promise.all([
    Vendor.findOne({ userId: session.user.id })
      .select("_id storeName logo status permissions")
      .lean<VendorAreaAccess["vendor"] | null>(),
    User.findById(session.user.id).select("status").lean(),
  ]);

  const userStatus = (user as { status?: string } | null)?.status;
  if (userStatus && userStatus !== USER_ACCOUNT_STATUS.ACTIVE) {
    redirect(`/${params.locale}/forbidden`);
  }

  if (!vendor) {
    redirect(`/${params.locale}/become-vendor`);
  }

  const vendorPermissions = Array.isArray((vendor as { permissions?: unknown }).permissions)
    ? ((vendor as { permissions?: unknown }).permissions as VendorPermission[])
    : DEFAULT_VENDOR_PERMISSIONS;
  const isApproved = vendor.status === VENDOR_STATUS.APPROVED;

  if (!isApproved) {
    return { session, vendor, vendorPermissions: [], isApproved };
  }

  if (session.user.role !== USER_ROLES.VENDOR) {
    redirect(`/${params.locale}/become-vendor`);
  }

  const required = params.required || [];
  if (required.length) {
    const mode = params.mode || "any";
    const ok =
      mode === "all"
        ? required.every((p) => vendorPermissions.includes(p))
        : required.some((p) => vendorPermissions.includes(p));

    if (!ok) redirect(`/${params.locale}/forbidden`);
  }

  return { session, vendor, vendorPermissions, isApproved };
}
