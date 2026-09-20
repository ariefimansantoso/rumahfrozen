import mongoose from "mongoose";
import {
  Archive,
  BadgeCheck,
  Boxes,
  PackageSearch,
  Warehouse,
} from "lucide-react";
import { Product } from "@/models";
import { connectDB } from "@/lib/db";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { PRODUCT_STATUS } from "@/config/app.config";
import { VendorProductsTable } from "@/components/vendor/products-table";
import { ProductsTableSkeleton } from "@/components/admin/products-table-skeleton";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface VendorProductsStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  outOfStockProducts: number;
  totalInventoryUnits: number;
}

export default async function VendorProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const search = await searchParams;
  setRequestLocale(locale);
  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_PRODUCTS],
  });
  const vendor = await requireApprovedVendorByUserId(access.session.user.id);
  const canCreateProduct =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.CREATE_PRODUCTS);
  const canEditProduct =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.EDIT_PRODUCTS);
  const canDeleteProduct =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.DELETE_PRODUCTS);

  const page = typeof search.page === "string" ? parseInt(search.page) : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : undefined;
  const sortBy =
    typeof search.sortBy === "string" ? search.sortBy : "createdAt";
  const sortOrder = search.sortOrder === "asc" ? "asc" : "desc";
  const stats = await getVendorProductStats(String(vendor._id));

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.productsPage.stats.totalProducts.title"),
      value: stats.totalProducts,
      description: t("admin.productsPage.stats.totalProducts.description"),
      icon: <Boxes className="h-5 w-5" />,
      iconClassName: "text-teal-700 bg-teal-100",
    },
    {
      title: t("admin.productsPage.stats.activeListings.title"),
      value: stats.activeProducts,
      description: t("admin.productsPage.stats.activeListings.description"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("admin.productsPage.stats.draftProducts.title"),
      value: stats.draftProducts,
      description: t("admin.productsPage.stats.draftProducts.description"),
      icon: <Archive className="h-5 w-5" />,
      iconClassName: "text-indigo-700 bg-indigo-100",
    },
    {
      title: t("admin.productsPage.stats.outOfStock.title"),
      value: stats.outOfStockProducts,
      description: t("admin.productsPage.stats.outOfStock.description"),
      icon: <PackageSearch className="h-5 w-5" />,
      iconClassName: "text-orange-700 bg-orange-100",
    },
    {
      title: t("admin.productsPage.stats.inventoryUnits.title"),
      value: stats.totalInventoryUnits,
      description: t("admin.productsPage.stats.inventoryUnits.description"),
      icon: <Warehouse className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <Suspense fallback={<ProductsTableSkeleton />}>
        <VendorProductsTable
          locale={locale}
          page={page}
          search={searchQuery}
          status={status}
          sortBy={sortBy}
          sortOrder={sortOrder}
          canCreateProduct={canCreateProduct}
          canEditProduct={canEditProduct}
          canDeleteProduct={canDeleteProduct}
        />
      </Suspense>
    </div>
  );
}

async function getVendorProductStats(vendorId: string): Promise<VendorProductsStats> {
  await connectDB();
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

  const [result] = await Product.aggregate([
    { $match: { vendorId: vendorObjectId } },
    {
      $project: {
        status: 1,
        stock: 1,
        variants: 1,
        inventoryCount: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
            {
              $sum: {
                $map: {
                  input: { $ifNull: ["$variants", []] },
                  as: "variant",
                  in: { $ifNull: ["$$variant.stock", 0] },
                },
              },
            },
            { $ifNull: ["$stock", 0] },
          ],
        },
      },
    },
    {
      $facet: {
        totalProducts: [{ $count: "count" }],
        activeProducts: [
          { $match: { status: PRODUCT_STATUS.ACTIVE } },
          { $count: "count" },
        ],
        draftProducts: [
          { $match: { status: PRODUCT_STATUS.DRAFT } },
          { $count: "count" },
        ],
        outOfStockProducts: [
          { $match: { inventoryCount: { $lte: 0 } } },
          { $count: "count" },
        ],
        totalInventoryUnits: [
          { $group: { _id: null, total: { $sum: "$inventoryCount" } } },
        ],
      },
    },
  ]);

  return {
    totalProducts: result?.totalProducts?.[0]?.count ?? 0,
    activeProducts: result?.activeProducts?.[0]?.count ?? 0,
    draftProducts: result?.draftProducts?.[0]?.count ?? 0,
    outOfStockProducts: result?.outOfStockProducts?.[0]?.count ?? 0,
    totalInventoryUnits: result?.totalInventoryUnits?.[0]?.total ?? 0,
  };
}
