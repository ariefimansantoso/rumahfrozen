import { setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { ReturnsDataTable } from "@/components/admin/returns-data-table";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function VendorReturnsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_ORDERS],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Returns and refunds
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review return requests for your products, approve received items, and
          issue refunds for your store items.
        </p>
      </div>
      <ReturnsDataTable locale={locale} scope="vendor" />
    </div>
  );
}
