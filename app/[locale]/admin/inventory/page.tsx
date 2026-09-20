import {
  Boxes,
  MapPin,
  PackageSearch,
  ScanSearch,
  Warehouse,
} from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { InventoryLocation } from "@/models/inventory-location.model";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { InventoryDataTable } from "@/components/admin/inventory-data-table";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface InventoryStats {
  totalSkus: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  onHandUnits: number;
  activeLocations: number;
}

export default async function AdminInventoryPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_INVENTORY],
  });

  const stats = await getInventoryStats();

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.inventoryPage.stats.trackedSkus.title"),
      value: stats.totalSkus,
      description: t("admin.inventoryPage.stats.trackedSkus.description"),
      icon: <Boxes className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.inventoryPage.stats.lowStockSkus.title"),
      value: stats.lowStockSkus,
      description: t("admin.inventoryPage.stats.lowStockSkus.description"),
      icon: <ScanSearch className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("admin.inventoryPage.stats.outOfStock.title"),
      value: stats.outOfStockSkus,
      description: t("admin.inventoryPage.stats.outOfStock.description"),
      icon: <PackageSearch className="h-5 w-5" />,
      iconClassName: "text-rose-700 bg-rose-100",
    },
    {
      title: t("admin.inventoryPage.stats.onHandUnits.title"),
      value: stats.onHandUnits,
      description: t("admin.inventoryPage.stats.onHandUnits.description"),
      icon: <Warehouse className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
    {
      title: t("admin.inventoryPage.stats.activeLocations.title"),
      value: stats.activeLocations,
      description: t("admin.inventoryPage.stats.activeLocations.description"),
      icon: <MapPin className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <InventoryDataTable locale={locale} />
    </div>
  );
}

async function getInventoryStats(): Promise<InventoryStats> {
  await connectDB();

  const [products, activeLocations] = await Promise.all([
    Product.find({}).select("stock variants.stock").lean(),
    InventoryLocation.countDocuments({ isActive: true }),
  ]);

  let totalSkus = 0;
  let lowStockSkus = 0;
  let outOfStockSkus = 0;
  let onHandUnits = 0;

  for (const product of products) {
    const variants = Array.isArray(product.variants) ? product.variants : [];

    if (variants.length > 0) {
      for (const variant of variants) {
        const quantity = variant?.stock ?? 0;
        totalSkus += 1;
        onHandUnits += quantity;

        if (quantity <= 0) {
          outOfStockSkus += 1;
        } else if (quantity <= 10) {
          lowStockSkus += 1;
        }
      }
    } else {
      const quantity = product.stock ?? 0;
      totalSkus += 1;
      onHandUnits += quantity;

      if (quantity <= 0) {
        outOfStockSkus += 1;
      } else if (quantity <= 10) {
        lowStockSkus += 1;
      }
    }
  }

  return {
    totalSkus,
    lowStockSkus,
    outOfStockSkus,
    onHandUnits,
    activeLocations,
  };
}
