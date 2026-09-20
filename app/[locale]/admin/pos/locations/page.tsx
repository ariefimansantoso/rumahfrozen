import { setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import { redirect } from "next/navigation";
import { LocationsContent } from "@/components/pos/locations-content";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { canAccessPOS } from "@/lib/rbac";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPosLocationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session } = await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.MANAGE_POS],
  });

  await connectDB();
  const settings = await getSettings();
  if (!settings.pos?.enabled) {
    redirect(`/${locale}/admin`);
  }
  if (!(await canAccessPOS(session.user))) {
    redirect(`/${locale}/admin`);
  }

  return <LocationsContent locale={locale} />;
}
