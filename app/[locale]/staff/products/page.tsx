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
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PRODUCT_STATUS } from "@/config/app.config";
import { ProductsDataTable } from "@/components/admin/products-data-table";
import { requireStaffAreaAccess } from "@/lib/staff-area-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import {
  buildStaffProductScopeFilter,
  mergeScopeFilter,
  type StaffAccessScope,
} from "@/lib/staff-scope";

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

export default async function StaffProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const search = await searchParams;
  setRequestLocale(locale);

  const access = await requireStaffAreaAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_PRODUCTS],
  });
  const readOnly = !(
    access.staffPermissions.includes(STAFF_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.CREATE_PRODUCTS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.EDIT_PRODUCTS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.DELETE_PRODUCTS)
  );

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const stats = await getProductStats(access.staffScope);

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
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("admin.productsPage.stats.outOfStock.title"),
      value: stats.outOfStockProducts,
      description: t("admin.productsPage.stats.outOfStock.description"),
      icon: <PackageSearch className="h-5 w-5" />,
      iconClassName: "text-rose-700 bg-rose-100",
    },
    {
      title: t("admin.productsPage.stats.inventoryUnits.title"),
      value: stats.totalInventoryUnits,
      description: t("admin.productsPage.stats.inventoryUnits.description"),
      icon: <Warehouse className="h-5 w-5" />,
      iconClassName: "text-indigo-700 bg-indigo-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <ProductsDataTable
        locale={locale}
        area="staff"
        readOnly={readOnly}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
      />
    </div>
  );
}

async function getProductStats(staffScope?: StaffAccessScope): Promise<ProductsStats> {
  await connectDB();
  const productScope = buildStaffProductScopeFilter(staffScope);

  const [totalProducts, activeProducts, draftProducts, outOfStockProducts, inventoryAgg] =
    await Promise.all([
      Product.countDocuments(productScope),
      Product.countDocuments(
        mergeScopeFilter({ status: PRODUCT_STATUS.ACTIVE }, productScope),
      ),
      Product.countDocuments(
        mergeScopeFilter({ status: PRODUCT_STATUS.DRAFT }, productScope),
      ),
      Product.countDocuments(mergeScopeFilter({ stock: { $lte: 0 } }, productScope)),
      Product.aggregate([
        { $match: productScope },
        { $group: { _id: null, total: { $sum: "$stock" } } },
      ]),
    ]);

  const totalInventoryUnits = inventoryAgg?.[0]?.total || 0;

  return {
    totalProducts,
    activeProducts,
    draftProducts,
    outOfStockProducts,
    totalInventoryUnits,
  };
}
