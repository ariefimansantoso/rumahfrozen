import { setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { VendorPayoutsContent } from "@/components/vendor/payouts/vendor-payouts-content";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VendorPayoutsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_PAYOUTS],
  });

  const page =
    typeof search.page === "string"
      ? Math.max(1, parseInt(search.page, 10) || 1)
      : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const sortBy =
    typeof search.sortBy === "string" ? search.sortBy : "createdAt";
  const sortOrder = search.sortOrder === "asc" ? "asc" : "desc";

  return (
    <VendorPayoutsContent
      locale={locale}
      initialPage={page}
      initialSearch={searchQuery}
      initialStatus={status}
      initialSortBy={sortBy}
      initialSortOrder={sortOrder}
    />
  );
}
