import { BadgeCheck, Shield, Users, UserX } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { User, StaffProfile } from "@/models";
import { connectDB } from "@/lib/db";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { StaffDataTable } from "@/components/admin/staff-data-table";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { STAFF_USER_ROLES } from "@/lib/staff-role";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface StaffStats {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  posAccess: number;
}

export default async function VendorStaffPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  const t = await getTranslations({ locale });
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({
    locale,
    required: [
      VENDOR_PERMISSIONS.VIEW_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STAFF,
      VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    ],
  });
  const vendor = await requireApprovedVendorByUserId(access.session.user.id);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery = typeof search.search === "string" ? search.search : "";
  const status = typeof search.status === "string" ? search.status : "all";
  const stats = await getVendorStaffStats(String(vendor._id));

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
        area="vendor"
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
      />
    </div>
  );
}

async function getVendorStaffStats(vendorId: string): Promise<StaffStats> {
  await connectDB();

  const profiles = await StaffProfile.find({ vendorIds: vendorId })
    .select("userId permissions")
    .lean();
  const userIds = profiles.map((profile) => profile.userId);

  const [totalStaff, activeStaff] = await Promise.all([
    User.countDocuments({
      _id: { $in: userIds },
      role: { $in: STAFF_USER_ROLES },
    }),
    User.countDocuments({
      _id: { $in: userIds },
      role: { $in: STAFF_USER_ROLES },
      $or: [
        { status: "active" },
        { status: { $exists: false } },
        { status: null },
      ],
    }),
  ]);

  return {
    totalStaff,
    activeStaff,
    inactiveStaff: totalStaff - activeStaff,
    posAccess: profiles.filter((profile) =>
      profile.permissions.includes("access_pos"),
    ).length,
  };
}
