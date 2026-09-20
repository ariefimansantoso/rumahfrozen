import { connectDB } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@/models/settings.model";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { normalizeContentPagesSettings } from "@/lib/content-pages-config";
import { PagesManager } from "@/components/admin/online-store/pages-manager";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnlineStorePagesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);
  await connectDB();
  const settings = await getSettings();
  const contentPages = normalizeContentPagesSettings(settings.contentPages);

  return <PagesManager locale={locale} initialContentPages={contentPages} />;
}
