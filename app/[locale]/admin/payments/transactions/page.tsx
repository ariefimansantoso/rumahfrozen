import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { PaymentTransactionsTable } from "@/components/admin/payments/payment-transactions-table";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPaymentTransactionsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);

  return <PaymentTransactionsTable locale={locale} />;
}
