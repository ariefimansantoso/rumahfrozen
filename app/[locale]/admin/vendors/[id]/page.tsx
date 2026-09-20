import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { isMultiVendorEnabled } from "@/lib/multi-vendor";
import { VendorForm } from "@/components/admin/vendor-form";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function VendorDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  if (!(await isMultiVendorEnabled())) notFound();

  return <VendorForm locale={locale} vendorId={id} />;
}
