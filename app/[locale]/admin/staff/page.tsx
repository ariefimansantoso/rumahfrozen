import { BadgeCheck, Shield, Users, UserX } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { User, StaffProfile } from "@/models";
import { STAFF_USER_ROLES } from "@/lib/staff-role";
import { getVendorScopedStaffUserIds } from "@/lib/admin-staff-scope";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { StaffDataTable } from "@/components/admin/staff-data-table";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminStaffPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery = typeof search.search === "string" ? search.search : "";
  const status = typeof search.status === "string" ? search.status : "all";

  const stats = await getStaffStats();

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.staffPage.stats.totalStaff.title"),
      value: stats.totalStaff,
      description: t("admin.staffPage.stats.totalStaff.description"),
      icon: <Users className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.staffPage.stats.activeStaff.title"),
      value: stats.activeStaff,
      description: t("admin.staffPage.stats.activeStaff.description"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("admin.staffPage.stats.withPosAccess.title"),
      value: stats.posAccess,
      description: t("admin.staffPage.stats.withPosAccess.description"),
      icon: <Shield className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
    {
      title: t("admin.staffPage.stats.inactiveStaff.title"),
      value: stats.inactiveStaff,
      description: t("admin.staffPage.stats.inactiveStaff.description"),
      icon: <UserX className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} columnsClassName="xl:grid-cols-4" />
      <StaffDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
      />
    </div>
  );
}

interface StaffStats {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  posAccess: number;
}

async function getStaffStats(): Promise<StaffStats> {
  await connectDB();

  // Admins only manage platform staff; exclude staff owned by a vendor.
  const vendorScopedUserIds = await getVendorScopedStaffUserIds();

  const [totalStaff, activeUsers, profiles] = await Promise.all([
    User.countDocuments({
      role: { $in: STAFF_USER_ROLES },
      _id: { $nin: vendorScopedUserIds },
    }),
    User.countDocuments({
      role: { $in: STAFF_USER_ROLES },
      _id: { $nin: vendorScopedUserIds },
      $or: [
        { status: "active" },
        { status: { $exists: false } },
        { status: null },
      ],
    }),
    StaffProfile.find({ isActive: true, "vendorIds.0": { $exists: false } })
      .select("permissions")
      .lean(),
  ]);

  const posAccess = profiles.filter((p) =>
    p.permissions.includes("access_pos"),
  ).length;

  return {
    totalStaff,
    activeStaff: activeUsers,
    inactiveStaff: totalStaff - activeUsers,
    posAccess,
  };
}
