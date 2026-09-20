import { setRequestLocale } from "next-intl/server";
import { MenusDataTable } from "@/components/admin/menus/menus-data-table";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminMenusPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  return (
    <div className="space-y-4">
      <MenusDataTable locale={locale} />
    </div>
  );
}
