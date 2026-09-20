import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { EditCustomPageForm } from "@/components/admin/online-store/edit-custom-page-form";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditCustomPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  return <EditCustomPageForm locale={locale} pageId={id} />;
}
