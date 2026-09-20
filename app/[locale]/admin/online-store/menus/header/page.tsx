import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { HeaderBuilder } from "@/components/admin/online-store/header-builder";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnlineStoreMenusHeaderPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  return <HeaderBuilder locale={locale} />;
}
