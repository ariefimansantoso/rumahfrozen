"use client";

import { useEffect, useState } from "react";
import {
  AdminDashboardContent,
  type DashboardStats,
  type LatestProduct,
  type OrderChartMetrics,
  type RecentOrder,
  type VisitorsChartMetrics,
} from "@/components/admin/dashboard-content";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { DashboardStatsSection } from "@/components/admin/dashboard-stats-section";
import { DashboardContentSkeleton } from "@/components/admin/dashboard-skeleton";

interface DashboardData {
  recentOrders: RecentOrder[];
  orderChart: OrderChartMetrics;
  latestProducts: LatestProduct[];
  visitorsChart: VisitorsChartMetrics;
  stats: DashboardStats;
}

interface AdminDashboardClientProps {
  userName?: string;
  /** When false, the In-store sales metric card is hidden. */
  posEnabled: boolean;
}

/**
 * Renders the dashboard chrome (header + metric cards) instantly, then fetches
 * the dashboard data on the client and swaps the value skeletons and heavier
 * sections for real data once it resolves — mirroring the skeleton-then-data
 * pattern used by the products page.
 */
export function AdminDashboardClient({
  userName,
  posEnabled,
}: AdminDashboardClientProps) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/admin/dashboard");
        const json = await res.json();
        if (active && json.success) {
          setData(json.data as DashboardData);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4 pb-6 text-foreground">
      <DashboardHeader userName={userName} />
      <DashboardStatsSection stats={data?.stats ?? null} posEnabled={posEnabled} />
      {data ? (
        <AdminDashboardContent
          recentOrders={data.recentOrders}
          orderChart={data.orderChart}
          latestProducts={data.latestProducts}
          visitorsChart={data.visitorsChart}
        />
      ) : (
        <DashboardContentSkeleton />
      )}
    </div>
  );
}
