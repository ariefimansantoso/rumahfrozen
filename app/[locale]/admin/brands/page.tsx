import { BadgeCheck, Ban, Clock, Star, Tag } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Brand } from "@/models";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { BrandsDataTable } from "@/components/admin/brands-data-table";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface BrandsStats {
  totalBrands: number;
  activeBrands: number;
  inactiveBrands: number;
  featuredBrands: number;
  pendingBrands: number;
}

export default async function AdminBrandsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const stats = await getBrandsStats();

  const statItems: AdminStatsStripItem[] = [
    {
      title: "Total brands",
      value: stats.totalBrands,
      description: "All brands in your catalog",
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
      title: "Pending approval",
      value: stats.pendingBrands,
      description: "Vendor brands awaiting review",
      icon: <Clock className="h-5 w-5" />,
      iconClassName: "text-orange-700 bg-orange-100",
    },
    {
      title: "Featured brands",
      value: stats.featuredBrands,
      description: "Highlighted on the storefront",
      icon: <Star className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <BrandsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
      />
    </div>
  );
}

async function getBrandsStats(): Promise<BrandsStats> {
  await connectDB();

  const [brandFacet] = await Brand.aggregate([
    { $match: { deletedAt: null } },
    {
      $facet: {
        totalBrands: [{ $count: "count" }],
        activeBrands: [{ $match: { isActive: true } }, { $count: "count" }],
        inactiveBrands: [{ $match: { isActive: false } }, { $count: "count" }],
        featuredBrands: [{ $match: { featured: true } }, { $count: "count" }],
        pendingBrands: [
          { $match: { approvalStatus: "pending" } },
          { $count: "count" },
        ],
      },
    },
  ]);

  return {
    totalBrands: brandFacet?.totalBrands?.[0]?.count ?? 0,
    activeBrands: brandFacet?.activeBrands?.[0]?.count ?? 0,
    inactiveBrands: brandFacet?.inactiveBrands?.[0]?.count ?? 0,
    featuredBrands: brandFacet?.featuredBrands?.[0]?.count ?? 0,
    pendingBrands: brandFacet?.pendingBrands?.[0]?.count ?? 0,
  };
}
