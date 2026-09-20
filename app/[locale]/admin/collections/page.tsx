import {
  BadgeCheck,
  Boxes,
  Globe,
  Hand,
  Layers,
} from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { connectDB } from "@/lib/db";
import { Collection } from "@/models";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { CollectionsDataTable } from "@/components/admin/collections-data-table";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface CollectionsStats {
  totalCollections: number;
  activeCollections: number;
  manualCollections: number;
  onlineCollections: number;
  totalProductsInCollections: number;
}

export default async function AdminCollectionsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  await requireAdminPageAccess(locale);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const status = typeof search.status === "string" ? search.status : "all";
  const type = typeof search.type === "string" ? search.type : "all";
  const stats = await getCollectionsStats();

  const statItems: AdminStatsStripItem[] = [
    {
      title: t("admin.collectionsPage.stats.totalCollections.title"),
      value: stats.totalCollections,
      description: t("admin.collectionsPage.stats.totalCollections.description"),
      icon: <Layers className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: t("admin.collectionsPage.stats.activeCollections.title"),
      value: stats.activeCollections,
      description: t("admin.collectionsPage.stats.activeCollections.description"),
      icon: <BadgeCheck className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: t("admin.collectionsPage.stats.manualCollections.title"),
      value: stats.manualCollections,
      description: t("admin.collectionsPage.stats.manualCollections.description"),
      icon: <Hand className="h-5 w-5" />,
      iconClassName: "text-indigo-700 bg-indigo-100",
    },
    {
      title: t("admin.collectionsPage.stats.onlineStore.title"),
      value: stats.onlineCollections,
      description: t("admin.collectionsPage.stats.onlineStore.description"),
      icon: <Globe className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
    {
      title: t("admin.collectionsPage.stats.productsInCollections.title"),
      value: stats.totalProductsInCollections,
      description: t("admin.collectionsPage.stats.productsInCollections.description"),
      icon: <Boxes className="h-5 w-5" />,
      iconClassName: "text-violet-700 bg-violet-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <CollectionsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialStatus={status}
        initialType={type}
      />
    </div>
  );
}

async function getCollectionsStats(): Promise<CollectionsStats> {
  await connectDB();

  const [result] = await Collection.aggregate([
    {
      $facet: {
        totalCollections: [{ $count: "count" }],
        activeCollections: [
          { $match: { status: "active" } },
          { $count: "count" },
        ],
        manualCollections: [
          { $match: { collectionType: "manual" } },
          { $count: "count" },
        ],
        onlineCollections: [
          { $match: { "publishing.onlineStore": true } },
          { $count: "count" },
        ],
        totalProductsInCollections: [
          { $group: { _id: null, total: { $sum: { $ifNull: ["$productCount", 0] } } } },
        ],
      },
    },
  ]);

  return {
    totalCollections: result?.totalCollections?.[0]?.count ?? 0,
    activeCollections: result?.activeCollections?.[0]?.count ?? 0,
    manualCollections: result?.manualCollections?.[0]?.count ?? 0,
    onlineCollections: result?.onlineCollections?.[0]?.count ?? 0,
    totalProductsInCollections: result?.totalProductsInCollections?.[0]?.total ?? 0,
  };
}
