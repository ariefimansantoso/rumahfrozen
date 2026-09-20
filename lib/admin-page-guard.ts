import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/rbac";

export async function requireAdminPageAccess(locale: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/${locale}/login?redirect=/${locale}/admin/dashboard`);
  if (!isAdmin(session.user)) {
    redirect(`/${locale}/login?redirect=/${locale}/admin/dashboard`);
  }

  // 2FA is a personal preference, not a gate: admins manage it themselves from
  // their profile (see `TwoFactorManagementCard`). Access is never blocked here.
  return session;
}
