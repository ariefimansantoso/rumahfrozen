import { connectDB } from "@/lib/db";
import { canAccessPOS } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@/models/settings.model";
import { POSPageShell } from "@/components/pos/pos-page-shell";
import { buildPOSSettings } from "@/lib/pos/build-pos-settings";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function VendorPosPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session } = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.ACCESS_POS],
  });

  await connectDB();
  const settings = await getSettings();
  if (!settings.pos?.enabled) {
    redirect(`/${locale}/vendor/dashboard`);
  }
  if (!(await canAccessPOS(session.user))) {
    redirect(`/${locale}/vendor/dashboard`);
  }

  return <POSPageShell settings={buildPOSSettings(settings)} />;
}
