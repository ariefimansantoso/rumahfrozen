import { connectDB } from "@/lib/db";
import { type Locale } from "@/config/i18n.config";
import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@/models/settings.model";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffSidebar } from "@/components/staff/staff-sidebar";
import { requireStaffAreaAccess } from "@/lib/staff-area-guard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarStateSync } from "@/components/layout/sidebar-state-sync";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function StaffLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session, staffPermissions } = await requireStaffAreaAccess({
    locale,
  });

  await connectDB();
  const settings = await getSettings();
  const posEnabled = Boolean(
    settings.pos?.enabled && settings.pos.allowSellerSales,
  );

  return (
    <SidebarProvider>
      <SidebarStateSync />
      <StaffSidebar
        locale={locale as Locale}
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image || undefined,
        }}
        permissions={staffPermissions}
        posEnabled={posEnabled}
        storeName={settings.general?.storeName}
      />
      <SidebarInset className="[--dashboard-header-height:4rem]">
        <StaffHeader
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image || undefined,
          }}
          locale={locale as Locale}
          posEnabled={posEnabled}
        />
        <main className="isolate flex-1 min-w-0 space-y-8 overflow-x-clip p-6 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
