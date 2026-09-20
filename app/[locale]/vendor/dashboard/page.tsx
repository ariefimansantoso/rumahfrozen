import { setRequestLocale } from "next-intl/server";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { VendorDashboardContent } from "@/components/vendor/dashboard-content";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function VendorDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireVendorAreaAccess({ locale });

  return <VendorDashboardContent />;
}
