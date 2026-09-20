import {
  Archive,
  BadgeCheck,
  Boxes,
  PackageSearch,
  Warehouse,
} from "lucide-react";
import { Product } from "@/models";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { PRODUCT_STATUS } from "@/config/app.config";
import { ProductsDataTable } from "@/components/admin/products-data-table";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface ProductsStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  outOfStockProducts: number;
  totalInventoryUnits: number;
}

export default async function AdminProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_PRODUCTS],
  });

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const vendor = typeof search.vendor === "string" ? search.vendor : "all";
  const source = typeof search.source === "string" ? search.source : "all";
  const settings = await getSettings();
  const stats = await getProductStats();

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
      <ProductsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
        initialVendor={vendor}
        initialSource={source}
        isMultiVendor={Boolean(settings.multiVendorMode?.enabled)}
      />
    </div>
  );
}

async function getProductStats(): Promise<ProductsStats> {
  await connectDB();

  const [result] = await Product.aggregate([
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
