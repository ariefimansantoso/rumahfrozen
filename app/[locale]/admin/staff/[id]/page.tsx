import { setRequestLocale } from "next-intl/server";
import { StaffForm } from "@/components/admin/staff-form";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditStaffPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  return <StaffForm locale={locale} staffId={id} />;
}
