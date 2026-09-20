import { setRequestLocale } from "next-intl/server";
import { CustomerForm } from "@/components/admin/customer-form";
import { requireStaffAreaAccess } from "@/lib/staff-area-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function StaffCustomerDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const access = await requireStaffAreaAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_CUSTOMERS],
  });

  const canManageCustomers = access.staffPermissions.includes(
    STAFF_PERMISSIONS.MANAGE_CUSTOMERS,
  ) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.EDIT_CUSTOMERS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.DELETE_CUSTOMERS);

  return (
    <CustomerForm
      locale={locale}
      customerId={id}
      readOnly={!canManageCustomers}
      area="staff"
    />
  );
}
