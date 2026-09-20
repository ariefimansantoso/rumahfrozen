import { connectDB } from "@/lib/db";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@/models/settings.model";
import { POSPageShell } from "@/components/pos/pos-page-shell";
import { buildPOSSettings } from "@/lib/pos/build-pos-settings";
import { requireStaffAreaAccess } from "@/lib/staff-area-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { canAccessPOS } from "@/lib/rbac";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function StaffPosPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session } = await requireStaffAreaAccess({
    locale,
    required: [STAFF_PERMISSIONS.ACCESS_POS],
  });

  await connectDB();
  const settings = await getSettings();
  if (!settings.pos?.enabled) {
    redirect(`/${locale}/staff/dashboard`);
  }

  if (!(await canAccessPOS(session.user))) {
    redirect(`/${locale}/staff/dashboard`);
  }

  return <POSPageShell settings={buildPOSSettings(settings)} />;
}
