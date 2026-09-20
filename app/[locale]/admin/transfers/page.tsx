import { setRequestLocale } from "next-intl/server";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { TransfersList } from "@/components/admin/transfers/transfers-list";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminTransfersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_INVENTORY],
  });

  return <TransfersList locale={locale} />;
}
