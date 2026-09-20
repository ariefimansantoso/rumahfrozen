import mongoose from "mongoose";
import { BadgeCheck, Ban, Boxes, FolderTree, Layers } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { VendorCategoriesDataTable } from "@/components/vendor/categories-data-table";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  parentCategories: number;
  totalAssignedProducts: number;
}

export default async function VendorCategoriesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_PRODUCTS],
  });
  const vendor = await requireApprovedVendorByUserId(access.session.user.id);
  const t = await getTranslations({ locale });

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery = typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const stats = await getVendorCategoryStats(String(vendor._id));

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.categoriesDataTable.stats.categories"),
      value: stats.totalCategories,
      description: t("admin.categoriesDataTable.stats.categoriesDescription"),
      icon: <FolderTree className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.categoriesDataTable.stats.active"),
      value: stats.activeCategories,
      description: t("admin.categoriesDataTable.stats.activeDescription"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("admin.categoriesDataTable.stats.inactive"),
      value: stats.inactiveCategories,
      description: t("admin.categoriesDataTable.stats.inactiveDescription"),
      icon: <Ban className="h-5 w-5" />,
      iconClassName: "text-rose-700 bg-rose-100",
    },
    {
      title: t("admin.categoriesDataTable.stats.parentCategories"),
      value: stats.parentCategories,
      description: t("admin.categoriesDataTable.stats.parentCategoriesDescription"),
      icon: <Layers className="h-5 w-5" />,
      iconClassName: "text-indigo-700 bg-indigo-100",
    },
    {
      title: t("admin.categoriesDataTable.stats.assignedProducts"),
      value: stats.totalAssignedProducts,
      description: t("admin.categoriesDataTable.stats.assignedProductsDescription"),
      icon: <Boxes className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <VendorCategoriesDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
      />
    </div>
  );
}

async function getVendorCategoryStats(vendorId: string): Promise<CategoryStats> {
  await connectDB();

  const [result] = await Product.aggregate([
    {
      $match: {
        vendorId: new mongoose.Types.ObjectId(vendorId),
        category: { $ne: null },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryDoc",
      },
    },
    { $unwind: "$categoryDoc" },
    {
      $group: {
        _id: "$category",
        productCount: { $sum: 1 },
        isActive: { $first: "$categoryDoc.isActive" },
        parentId: { $first: "$categoryDoc.parentId" },
      },
    },
    {
      $group: {
        _id: null,
        totalCategories: { $sum: 1 },
        activeCategories: { $sum: { $cond: ["$isActive", 1, 0] } },
        inactiveCategories: { $sum: { $cond: ["$isActive", 0, 1] } },
        parentCategories: { $sum: { $cond: [{ $eq: ["$parentId", null] }, 1, 0] } },
        totalAssignedProducts: { $sum: "$productCount" },
      },
    },
  ]);

  const stats = result?.[0] || {};
  return {
    totalCategories: stats.totalCategories ?? 0,
    activeCategories: stats.activeCategories ?? 0,
    inactiveCategories: stats.inactiveCategories ?? 0,
    parentCategories: stats.parentCategories ?? 0,
    totalAssignedProducts: stats.totalAssignedProducts ?? 0,
  };
}
