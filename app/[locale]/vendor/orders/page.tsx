import mongoose from "mongoose";
import {
  BadgeCheck,
  Clock3,
  HandCoins,
  PackageCheck,
  ReceiptText,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { VendorOrdersTable } from "@/components/vendor/orders-table";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface VendorOrdersStats {
  totalOrders: number;
  openOrders: number;
  paidOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export default async function VendorOrdersPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const search = await searchParams;
  setRequestLocale(locale);
  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_ORDERS],
  });
  const vendor = await requireApprovedVendorByUserId(access.session.user.id);
  const canEditOrder =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_ORDERS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.EDIT_ORDERS);
  const canDeleteOrder =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_ORDERS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.DELETE_ORDERS);
  const canCreateOrder =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_ORDERS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.CREATE_ORDERS);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const view = typeof search.view === "string" ? search.view : "all";
  const status = typeof search.status === "string" ? search.status : "all";
  const paymentStatus =
    typeof search.paymentStatus === "string" ? search.paymentStatus : "all";
  const sortBy = typeof search.sortBy === "string" ? search.sortBy : "createdAt";
  const sortOrder = search.sortOrder === "asc" ? "asc" : "desc";
  const stats = await getVendorOrdersStats(String(vendor._id));

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
      <VendorOrdersTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialView={view}
        initialStatus={status}
        initialPaymentStatus={paymentStatus}
        initialSortBy={sortBy}
        initialSortOrder={sortOrder}
        canEditOrder={canEditOrder}
        canDeleteOrder={canDeleteOrder}
        canCreateOrder={canCreateOrder}
      />
    </div>
  );
}

async function getVendorOrdersStats(vendorId: string): Promise<VendorOrdersStats> {
  await connectDB();
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

  const [result] = await Order.aggregate([
    {
      $match: {
        subOrders: {
          $elemMatch: { vendorId: vendorObjectId },
        },
      },
    },
    { $unwind: "$subOrders" },
    { $match: { "subOrders.vendorId": vendorObjectId } },
    {
      $group: {
        _id: "$_id",
        paymentStatus: { $first: "$paymentStatus" },
        isOpen: {
          $max: {
            $cond: [
              { $in: ["$subOrders.status", ["delivered", "cancelled"]] },
              0,
              1,
            ],
          },
        },
        vendorRevenue: { $sum: "$subOrders.vendorEarnings" },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        openOrders: { $sum: "$isOpen" },
        paidOrders: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
        },
        totalRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$paymentStatus", "paid"] },
              "$vendorRevenue",
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalOrders = result?.totalOrders ?? 0;
  const openOrders = result?.openOrders ?? 0;
  const paidOrders = result?.paidOrders ?? 0;
  const totalRevenue = result?.totalRevenue ?? 0;

  return {
    totalOrders,
    openOrders,
    paidOrders,
    totalRevenue,
    averageOrderValue: paidOrders > 0 ? totalRevenue / paidOrders : 0,
  };
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
