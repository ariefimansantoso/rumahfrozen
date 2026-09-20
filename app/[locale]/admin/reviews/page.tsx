import { Review } from "@/models";
import { connectDB } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { ReviewsDataTable } from "@/components/admin/reviews-data-table";
import { ReviewsStatsCard } from "@/components/admin/reviews-stats-card";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export interface ReviewsStats {
  average: number;
  total: number;
  published: number;
  onHold: number;
  weekDelta: number;
  breakdown: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

export default async function AdminReviewsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminOrStaffPageAccess({
    locale,
    required: [
      STAFF_PERMISSIONS.VIEW_REVIEWS,
      STAFF_PERMISSIONS.MANAGE_REVIEWS,
    ],
  });

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const view = typeof search.view === "string" ? search.view : "all";
  const status = typeof search.status === "string" ? search.status : "all";
  const rating = typeof search.rating === "string" ? search.rating : "all";
  const sortBy =
    typeof search.sortBy === "string" ? search.sortBy : "createdAt";
  const sortOrder = search.sortOrder === "asc" ? "asc" : "desc";
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;

  const stats = await getReviewsStats();

  return (
    <div className="space-y-4">
      <ReviewsStatsCard stats={stats} />
      <ReviewsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialView={view}
        initialStatus={status}
        initialRating={rating}
        initialSortBy={sortBy}
        initialSortOrder={sortOrder}
      />
    </div>
  );
}

async function getReviewsStats(): Promise<ReviewsStats> {
  await connectDB();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [agg, weekDelta] = await Promise.all([
    Review.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          published: {
            $sum: { $cond: [{ $eq: ["$isApproved", true] }, 1, 0] },
          },
          onHold: {
            $sum: { $cond: [{ $eq: ["$isApproved", false] }, 1, 0] },
          },
        },
      },
    ]),
    Review.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
  ]);

  const s = agg[0] || {
    averageRating: 0,
    totalReviews: 0,
    rating5: 0,
    rating4: 0,
    rating3: 0,
    rating2: 0,
    rating1: 0,
    published: 0,
    onHold: 0,
  };

  return {
    average: Math.round((s.averageRating || 0) * 100) / 100,
    total: s.totalReviews || 0,
    published: s.published || 0,
    onHold: s.onHold || 0,
    weekDelta: weekDelta || 0,
    breakdown: {
      5: s.rating5 || 0,
      4: s.rating4 || 0,
      3: s.rating3 || 0,
      2: s.rating2 || 0,
      1: s.rating1 || 0,
    },
  };
}
