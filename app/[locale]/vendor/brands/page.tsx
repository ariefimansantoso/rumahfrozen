import mongoose from "mongoose";
import { BadgeCheck, Ban, Boxes, Star, Tag } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Brand, Product } from "@/models";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/vendor-area-guard";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { VendorBrandsDataTable } from "@/components/vendor/brands-data-table";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface BrandStats {
  totalBrands: number;
  activeBrands: number;
  inactiveBrands: number;
  featuredBrands: number;
  vendorBrandedProducts: number;
}

export default async function VendorBrandsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const access = await requireVendorAreaAccess({
    locale,
    required: [VENDOR_PERMISSIONS.VIEW_BRANDS],
  });
  const vendor = await requireApprovedVendorByUserId(access.session.user.id);

  const grantedPermissions = new Set(access.vendorPermissions);
  const canCreate = grantedPermissions.has(VENDOR_PERMISSIONS.CREATE_BRANDS);
  const canEdit = grantedPermissions.has(VENDOR_PERMISSIONS.EDIT_BRANDS);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery = typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const stats = await getVendorBrandStats(String(vendor._id));

  const statItems: AdminStatsStripItem[] = [
    {
      title: "Total brands",
      value: stats.totalBrands,
      description: "All brands in the catalog",
      icon: <Tag className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: "Active brands",
      value: stats.activeBrands,
      description: "Visible on the storefront",
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: "Inactive brands",
      value: stats.inactiveBrands,
      description: "Hidden from the storefront",
      icon: <Ban className="h-5 w-5" />,
      iconClassName: "text-rose-700 bg-rose-100",
    },
    {
      title: "Featured brands",
      value: stats.featuredBrands,
      description: "Highlighted on the storefront",
      icon: <Star className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: "Your branded products",
      value: stats.vendorBrandedProducts,
      description: "Your products linked to a brand",
      icon: <Boxes className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <VendorBrandsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
        canCreate={canCreate}
        canEdit={canEdit}
      />
    </div>
  );
}

async function getVendorBrandStats(vendorId: string): Promise<BrandStats> {
  await connectDB();

  const [brandFacet] = await Brand.aggregate([
    {
      $match: {
        deletedAt: null,
        approvalStatus: { $nin: ["pending", "rejected"] },
      },
    },
    {
      $facet: {
        totalBrands: [{ $count: "count" }],
        activeBrands: [{ $match: { isActive: true } }, { $count: "count" }],
        inactiveBrands: [{ $match: { isActive: false } }, { $count: "count" }],
        featuredBrands: [{ $match: { featured: true } }, { $count: "count" }],
      },
    },
  ]);

  const vendorBrandedProducts = await Product.countDocuments({
    vendorId: new mongoose.Types.ObjectId(vendorId),
    brand: { $ne: null },
  });

  return {
    totalBrands: brandFacet?.totalBrands?.[0]?.count ?? 0,
    activeBrands: brandFacet?.activeBrands?.[0]?.count ?? 0,
    inactiveBrands: brandFacet?.inactiveBrands?.[0]?.count ?? 0,
    featuredBrands: brandFacet?.featuredBrands?.[0]?.count ?? 0,
    vendorBrandedProducts,
  };
}
