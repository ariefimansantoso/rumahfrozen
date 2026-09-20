import { setRequestLocale } from "next-intl/server";
import { StaffForm } from "@/components/admin/staff-form";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditVendorStaffPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requireVendorAreaAccess({
    locale,
    required: [
      VENDOR_PERMISSIONS.EDIT_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
  });

  return <StaffForm locale={locale} staffId={id} area="vendor" />;
}
