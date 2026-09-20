import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { HomePageBuilder } from "@/components/admin/online-store/home-page-builder";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnlineStoreHomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  return (
    <div className="space-y-6">
      <HomePageBuilder locale={locale} />
    </div>
  );
}
