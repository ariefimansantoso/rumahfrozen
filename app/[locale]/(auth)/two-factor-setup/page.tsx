import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { isAdmin, isVendor } from "@/lib/rbac";
import {
  getTwoFactorPolicy,
  isTwoFactorRequiredForRole,
  isUserTwoFactorEnabled,
} from "@/lib/two-factor-policy";
import { TwoFactorSetupClient } from "@/components/account/two-factor-setup-client";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}

/**
 * Mandatory 2FA enrollment page. Lives in the `(auth)` route group so it is
 * reachable without an active 2FA enrollment (the admin/vendor guards that
 * redirect here are not applied to this group), avoiding a redirect loop.
 */
export default async function TwoFactorSetupPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { redirect: redirectParam } = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/${locale}/login`);

  // Resolve a safe, in-app destination for after setup completes.
  const roleDefault = isAdmin(session.user)
    ? `/${locale}/admin/dashboard`
    : isVendor(session.user)
      ? `/${locale}/vendor/dashboard`
      : `/${locale}/account`;
  const redirectTo =
    typeof redirectParam === "string" && redirectParam.startsWith(`/${locale}/`)
      ? redirectParam
      : roleDefault;

  // Self-service enrollment page. It is meaningful whenever 2FA is available
  // store-wide and the user has not enrolled yet — reached either from the
  // dashboard reminder banner (when required) or voluntarily. If 2FA is off or
  // the user is already enrolled, there is nothing to do here.
  const policy = await getTwoFactorPolicy();
  if (!policy.enabled || (await isUserTwoFactorEnabled(session.user.id))) {
    redirect(redirectTo);
  }

  const required = isTwoFactorRequiredForRole(session.user, policy);

  return (
    <TwoFactorSetupClient
      redirectTo={redirectTo}
      locale={locale}
      required={required}
    />
  );
}
