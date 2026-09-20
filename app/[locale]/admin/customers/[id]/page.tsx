import { setRequestLocale } from "next-intl/server";
import { CustomerForm } from "@/components/admin/customer-form";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { USER_ROLES } from "@/config/app.config";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function CustomerDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const access = await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_CUSTOMERS],
  });

  const canManageCustomers =
    access.session.user.role === USER_ROLES.ADMIN ||
    access.staffPermissions?.includes(STAFF_PERMISSIONS.MANAGE_CUSTOMERS) ||
    access.staffPermissions?.includes(STAFF_PERMISSIONS.EDIT_CUSTOMERS) ||
    access.staffPermissions?.includes(STAFF_PERMISSIONS.DELETE_CUSTOMERS) ||
    false;

  return (
    <CustomerForm
      locale={locale}
      customerId={id}
      readOnly={!canManageCustomers}
    />
  );
}
