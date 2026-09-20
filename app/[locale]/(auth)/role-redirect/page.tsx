import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { USER_ROLES } from "@/config/app.config";
import { isMultiVendorEnabled } from "@/lib/multi-vendor";
import { isStaffRole } from "@/lib/staff-role";

export default async function RoleRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const redirectParam = typeof sp.redirect === "string" ? sp.redirect : undefined;
  if (redirectParam) redirect(redirectParam);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/${locale}/login`);

  if (session.user.role === USER_ROLES.ADMIN) redirect(`/${locale}/admin/dashboard`);
  if (session.user.role === USER_ROLES.VENDOR) {
    const multiVendorEnabled = await isMultiVendorEnabled();
    redirect(multiVendorEnabled ? `/${locale}/vendor/dashboard` : `/${locale}/account`);
  }
  if (isStaffRole(session.user.role)) redirect(`/${locale}/staff/dashboard`);
  redirect(`/${locale}/account`);
}
