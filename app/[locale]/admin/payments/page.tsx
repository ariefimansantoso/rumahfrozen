import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { PaymentsOverviewContent } from "@/components/admin/payments/payments-overview-content";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPaymentsOverviewPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);

  return <PaymentsOverviewContent locale={locale} />;
}
