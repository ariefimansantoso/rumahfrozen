import { BadgeCheck, CircleAlert, Clock3, HandCoins, Store } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { VENDOR_STATUS } from "@/config/app.config";
import { Vendor } from "@/models";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { VendorsDataTable } from "@/components/admin/vendors-data-table";
import {
  getExternalVendorFilter,
  isMultiVendorEnabled,
  syncDefaultVendorWithSettings,
} from "@/lib/multi-vendor";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface VendorsStats {
  totalVendors: number;
  approvedVendors: number;
  pendingVendors: number;
  flaggedVendors: number;
  totalSales: number;
}

export default async function AdminVendorsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  const multiVendorEnabled = await isMultiVendorEnabled();
  if (!multiVendorEnabled) notFound();

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const status = typeof search.status === "string" ? search.status : "all";
  const searchQuery =
    typeof search.search === "string" ? search.search : "";

  const stats = await getVendorsStats();

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.vendorsPage.stats.totalVendors.title"),
      value: stats.totalVendors,
      description: t("admin.vendorsPage.stats.totalVendors.description"),
      icon: <Store className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.vendorsPage.stats.approvedVendors.title"),
      value: stats.approvedVendors,
      description: t("admin.vendorsPage.stats.approvedVendors.description"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("admin.vendorsPage.stats.pendingReview.title"),
      value: stats.pendingVendors,
      description: t("admin.vendorsPage.stats.pendingReview.description"),
      icon: <Clock3 className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("admin.vendorsPage.stats.flaggedVendors.title"),
      value: stats.flaggedVendors,
      description: t("admin.vendorsPage.stats.flaggedVendors.description"),
      icon: <CircleAlert className="h-5 w-5" />,
      iconClassName: "text-rose-700 bg-rose-100",
    },
    {
      title: t("admin.vendorsPage.stats.vendorSales.title"),
      value: formatCurrency(stats.totalSales),
      description: t("admin.vendorsPage.stats.vendorSales.description"),
      icon: <HandCoins className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <VendorsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
      />
    </div>
  );
}

async function getVendorsStats(): Promise<VendorsStats> {
  await connectDB();
  await syncDefaultVendorWithSettings();

  const [result] = await Vendor.aggregate([
    { $match: getExternalVendorFilter() },
    {
      $facet: {
        totalVendors: [{ $count: "count" }],
        approvedVendors: [
          { $match: { status: VENDOR_STATUS.APPROVED } },
          { $count: "count" },
        ],
        pendingVendors: [
          { $match: { status: VENDOR_STATUS.PENDING } },
          { $count: "count" },
        ],
        flaggedVendors: [
          { $match: { status: { $in: [VENDOR_STATUS.SUSPENDED, VENDOR_STATUS.REJECTED] } } },
          { $count: "count" },
        ],
        totalSales: [
          { $group: { _id: null, total: { $sum: { $ifNull: ["$totalSales", 0] } } } },
        ],
      },
    },
  ]);

  return {
    totalVendors: result?.totalVendors?.[0]?.count ?? 0,
    approvedVendors: result?.approvedVendors?.[0]?.count ?? 0,
    pendingVendors: result?.pendingVendors?.[0]?.count ?? 0,
    flaggedVendors: result?.flaggedVendors?.[0]?.count ?? 0,
    totalSales: result?.totalSales?.[0]?.total ?? 0,
  };
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
