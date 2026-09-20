import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { AdminPayoutsContent } from "@/components/admin/payouts/admin-payouts-content";
import { isMultiVendorEnabled } from "@/lib/multi-vendor";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminPayoutsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  if (!(await isMultiVendorEnabled())) notFound();

  const page =
    typeof search.page === "string"
      ? Math.max(1, parseInt(search.page, 10) || 1)
      : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const vendorId =
    typeof search.vendorId === "string" ? search.vendorId : "all";
  const sortBy =
    typeof search.sortBy === "string" ? search.sortBy : "createdAt";
  const sortOrder = search.sortOrder === "asc" ? "asc" : "desc";

  return (
    <AdminPayoutsContent
      locale={locale}
      initialPage={page}
      initialSearch={searchQuery}
      initialStatus={status}
      initialVendorId={vendorId}
      initialSortBy={sortBy}
      initialSortOrder={sortOrder}
    />
  );
}
