import { connectDB } from "@/lib/db";
import { redirect } from "next/navigation";
import { type Locale } from "@/config/i18n.config";
import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@/models/settings.model";
import { VendorHeader } from "@/components/vendor/vendor-header";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { VendorApplicationStatus } from "@/components/vendor/vendor-application-status";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SidebarStateSync } from "@/components/layout/sidebar-state-sync";
import { EmailVerificationNotice } from "@/components/auth/email-verification-notice";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function VendorLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await connectDB();
  const settings = await getSettings();
  if (!settings.multiVendorMode?.enabled) {
    redirect(`/${locale}`);
  }

  const { session, vendor, vendorPermissions, isApproved } =
    await requireVendorAreaAccess({
      locale,
    });

  if (!isApproved) {
    return (
      <VendorApplicationStatus
        status={vendor.status}
        storeName={vendor.storeName}
      />
    );
  }

  const canAccessPos = Boolean(
    settings.pos?.enabled &&
      settings.pos?.allowVendorSales &&
      vendorPermissions.includes(VENDOR_PERMISSIONS.ACCESS_POS),
  );

  // Get vendor store name
  let storeName: string | undefined;
  let storeLogo: string | undefined;
  try {
    storeName = vendor?.storeName;
    storeLogo = vendor?.logo;
  } catch (error) {
    console.error("Failed to fetch vendor info:", error);
  }

  return (
    <SidebarProvider>
      <SidebarStateSync />
      <DashboardSidebar
        locale={locale as Locale}
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image || undefined,
          role: session.user.role as string,
        }}
        vendorPermissions={vendorPermissions}
      />
      <SidebarInset className="[--dashboard-header-height:5rem]">
        <VendorHeader
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image || undefined,
          }}
          locale={locale as Locale}
          storeName={storeName}
          storeLogo={storeLogo}
          storeDomain={settings.general?.storeDomain}
          posEnabled={canAccessPos}
        />
        <main className="isolate flex-1 space-y-8 p-6 md:p-6">
          <EmailVerificationNotice
            email={session.user.email}
            status={session.user.emailVerificationStatus}
            locale={locale}
          />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
