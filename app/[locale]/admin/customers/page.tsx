import { BadgeCheck, Crown, HandCoins, UserRound, Users } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { CustomerProfile } from "@/models";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { CustomersDataTable } from "@/components/admin/customers-data-table";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface CustomersStats {
  totalCustomers: number;
  activeCustomers: number;
  vipCustomers: number;
  totalSpend: number;
  avgSpendPerCustomer: number;
}

export default async function AdminCustomersPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_CUSTOMERS],
  });

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery = typeof search.search === "string" ? search.search : "";
  const tier = typeof search.tier === "string" ? search.tier : "all";
  const tag = typeof search.tag === "string" ? search.tag : "all";
  const status = typeof search.status === "string" ? search.status : "all";

  const stats = await getCustomersStats();

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.customersPage.stats.totalCustomers.title"),
      value: stats.totalCustomers,
      description: t("admin.customersPage.stats.totalCustomers.description"),
      icon: <Users className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.customersPage.stats.activeAccounts.title"),
      value: stats.activeCustomers,
      description: t("admin.customersPage.stats.activeAccounts.description"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("admin.customersPage.stats.vipCustomers.title"),
      value: stats.vipCustomers,
      description: t("admin.customersPage.stats.vipCustomers.description"),
      icon: <Crown className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("admin.customersPage.stats.customerSpend.title"),
      value: formatCurrency(stats.totalSpend),
      description: t("admin.customersPage.stats.customerSpend.description"),
      icon: <HandCoins className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
    {
      title: t("admin.customersPage.stats.avgSpendPerCustomer.title"),
      value: formatCurrency(stats.avgSpendPerCustomer),
      description: t("admin.customersPage.stats.avgSpendPerCustomer.description"),
      icon: <UserRound className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <CustomersDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialTier={tier}
        initialTag={tag}
        initialStatus={status}
      />
    </div>
  );
}

async function getCustomersStats(): Promise<CustomersStats> {
  await connectDB();

  const [result] = await CustomerProfile.aggregate([
    {
      $facet: {
        totalCustomers: [{ $count: "count" }],
        activeCustomers: [
          {
            $lookup: {
              from: "user",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { "user.status": "active" },
                { "user.status": { $exists: false } },
                { "user.status": null },
              ],
            },
          },
          { $count: "count" },
        ],
        vipCustomers: [
          { $match: { loyaltyTier: { $in: ["gold", "platinum"] } } },
          { $count: "count" },
        ],
        totalSpend: [
          { $group: { _id: null, total: { $sum: { $ifNull: ["$stats.totalSpent", 0] } } } },
        ],
      },
    },
  ]);

  const totalCustomers = result?.totalCustomers?.[0]?.count ?? 0;
  const totalSpend = result?.totalSpend?.[0]?.total ?? 0;

  return {
    totalCustomers,
    activeCustomers: result?.activeCustomers?.[0]?.count ?? 0,
    vipCustomers: result?.vipCustomers?.[0]?.count ?? 0,
    totalSpend,
    avgSpendPerCustomer: totalCustomers > 0 ? totalSpend / totalCustomers : 0,
  };
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
