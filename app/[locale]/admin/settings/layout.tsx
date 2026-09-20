import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { SettingsShell } from "@/components/admin/settings/settings-shell";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminSettingsLayout({
  children,
  params,
}: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);

  return <SettingsShell locale={locale}>{children}</SettingsShell>;
}
