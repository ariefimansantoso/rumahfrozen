import {
  BadgeCheck,
  Clock3,
  HandCoins,
  PackageCheck,
  ReceiptText,
} from "lucide-react";
import { Order } from "@/models";
import { connectDB } from "@/lib/db";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrdersDataTable } from "@/components/admin/orders-data-table";
import { requireStaffAreaAccess } from "@/lib/staff-area-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import {
  buildStaffOrderScopeFilter,
  type StaffAccessScope,
} from "@/lib/staff-scope";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface OrdersStats {
  totalOrders: number;
  openOrders: number;
  paidOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export default async function StaffOrdersPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const search = await searchParams;
  setRequestLocale(locale);

  const access = await requireStaffAreaAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_ORDERS],
  });
  const readOnly = !(
    access.staffPermissions.includes(STAFF_PERMISSIONS.MANAGE_ORDERS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.EDIT_ORDERS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.DELETE_ORDERS)
  );

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const view = typeof search.view === "string" ? search.view : "all";
  const status = typeof search.status === "string" ? search.status : "all";
  const paymentStatus =
    typeof search.paymentStatus === "string" ? search.paymentStatus : "all";
  const channel = typeof search.channel === "string" ? search.channel : "all";
  const sortBy = typeof search.sortBy === "string" ? search.sortBy : "createdAt";
  const sortOrder = search.sortOrder === "asc" ? "asc" : "desc";
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;

  const stats = await getOrdersStats(access.staffScope);

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.ordersPage.stats.totalOrders.title"),
      value: new Intl.NumberFormat(locale).format(stats.totalOrders),
      description: t("admin.ordersPage.stats.totalOrders.description"),
      icon: <ReceiptText className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.ordersPage.stats.openOrders.title"),
      value: new Intl.NumberFormat(locale).format(stats.openOrders),
      description: t("admin.ordersPage.stats.openOrders.description"),
      icon: <Clock3 className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("admin.ordersPage.stats.paidOrders.title"),
      value: new Intl.NumberFormat(locale).format(stats.paidOrders),
      description: t("admin.ordersPage.stats.paidOrders.description"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("admin.ordersPage.stats.totalRevenue.title"),
      value: formatCurrency(stats.totalRevenue, locale),
      description: t("admin.ordersPage.stats.totalRevenue.description"),
      icon: <HandCoins className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
    {
      title: t("admin.ordersPage.stats.averageOrderValue.title"),
      value: formatCurrency(stats.averageOrderValue, locale),
      description: t("admin.ordersPage.stats.averageOrderValue.description"),
      icon: <PackageCheck className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <OrdersDataTable
        locale={locale}
        area="staff"
        readOnly={readOnly}
        initialPage={page}
        initialSearch={searchQuery}
        initialView={view}
        initialStatus={status}
        initialPaymentStatus={paymentStatus}
        initialChannel={channel}
        initialSortBy={sortBy}
        initialSortOrder={sortOrder}
      />
    </div>
  );
}

async function getOrdersStats(staffScope?: StaffAccessScope): Promise<OrdersStats> {
  await connectDB();

  const [result] = await Order.aggregate([
    { $match: buildStaffOrderScopeFilter(staffScope) },
    {
      $facet: {
        totalOrders: [{ $count: "count" }],
        openOrders: [
          { $match: { status: { $nin: ["delivered", "cancelled"] } } },
          { $count: "count" },
        ],
        paidOrders: [
          { $match: { paymentStatus: "paid" } },
          { $count: "count" },
        ],
        totalRevenue: [
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ],
      },
    },
  ]);

  const totalOrders = result?.totalOrders?.[0]?.count || 0;
  const openOrders = result?.openOrders?.[0]?.count || 0;
  const paidOrders = result?.paidOrders?.[0]?.count || 0;
  const totalRevenue = result?.totalRevenue?.[0]?.total || 0;

  const averageOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

  return {
    totalOrders,
    openOrders,
    paidOrders,
    totalRevenue,
    averageOrderValue,
  };
}

function formatCurrency(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
