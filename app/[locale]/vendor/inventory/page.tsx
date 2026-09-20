import { Boxes, MapPin, PackageSearch, ScanSearch, Warehouse } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { InventoryLocation } from "@/models/inventory-location.model";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { InventoryDataTable } from "@/components/admin/inventory-data-table";

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

export default async function VendorInventoryPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_PRODUCTS],
  });
  const vendor = await requireApprovedVendorByUserId(access.session.user.id);
  const t = await getTranslations({ locale });
  const canEditInventory =
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.MANAGE_PRODUCTS) ||
    access.vendorPermissions.includes(VENDOR_PERMISSIONS.EDIT_PRODUCTS);

  const stats = await getVendorInventoryStats(String(vendor._id));
  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.inventory.stats.trackedSkus"),
      value: stats.totalSkus,
      description: t("admin.inventory.stats.trackedSkusDescription"),
      icon: <Boxes className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.inventory.stats.lowStock"),
      value: stats.lowStockSkus,
      description: t("admin.inventory.stats.lowStockDescription"),
      icon: <ScanSearch className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: t("admin.inventory.stats.outOfStock"),
      value: stats.outOfStockSkus,
      description: t("admin.inventory.stats.outOfStockDescription"),
      icon: <PackageSearch className="h-5 w-5" />,
      iconClassName: "text-rose-700 bg-rose-100",
    },
    {
      title: t("admin.inventory.stats.onHandUnits"),
      value: stats.onHandUnits,
      description: t("admin.inventory.stats.onHandUnitsDescription"),
      icon: <Warehouse className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
    {
      title: t("admin.inventory.stats.locations"),
      value: stats.activeLocations,
      description: t("admin.inventory.stats.locationsDescription"),
      icon: <MapPin className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <InventoryDataTable
        locale={locale}
        apiEndpoint="/api/vendor/inventory"
        productHrefBase={canEditInventory ? "vendor/products" : ""}
        title={t("admin.inventory.title")}
        readOnly={!canEditInventory}
      />
    </div>
  );
}

async function getVendorInventoryStats(vendorId: string): Promise<InventoryStats> {
  await connectDB();

  const [products, activeLocations] = await Promise.all([
    Product.find({ vendorId }).select("stock variants.stock").lean(),
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
        if (quantity <= 0) outOfStockSkus += 1;
        else if (quantity <= 10) lowStockSkus += 1;
      }
    } else {
      const quantity = product.stock ?? 0;
      totalSkus += 1;
      onHandUnits += quantity;
      if (quantity <= 0) outOfStockSkus += 1;
      else if (quantity <= 10) lowStockSkus += 1;
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
