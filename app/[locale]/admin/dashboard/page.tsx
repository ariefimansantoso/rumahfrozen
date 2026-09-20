import { getSettings } from "@/models";
import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { AdminDashboardClient } from "@/components/admin/dashboard-client";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [session, settings] = await Promise.all([
    requireAdminPageAccess(locale),
    getSettings(),
  ]);

  const userName =
    session.user.name?.split(" ")[0] ||
    session.user.email?.split("@")[0] ||
    "";

  return (
    <AdminDashboardClient
      userName={userName}
      posEnabled={Boolean(settings.pos?.enabled)}
    />
  );
}
