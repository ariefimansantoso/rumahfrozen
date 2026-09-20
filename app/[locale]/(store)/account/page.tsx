import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { headers } from "next/headers";
import { Order } from "@/models";
import { setRequestLocale } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerDashboard } from "@/components/account/customer-dashboard";
import { ensureCustomerProfile } from "@/lib/customer";

interface PageProps {
  params: Promise<{ locale: string }>;
}

async function getCustomerStats(userId: string) {
  await connectDB();

  const [profile, pendingOrders] = await Promise.all([
    ensureCustomerProfile(userId),
    // Pending orders is a real-time transient status — keep as live query
    Order.countDocuments({
      customerId: userId,
      status: { $in: ["pending", "processing"] },
    }),
  ]);

  return {
    totalOrders: profile?.stats?.totalOrders ?? 0,
    pendingOrders,
    wishlistCount: profile?.stats?.totalWishlistItems ?? 0,
    totalSpent: profile?.stats?.totalSpent ?? 0,
    loyaltyPoints: profile?.loyaltyPoints ?? 0,
    loyaltyTier: profile?.loyaltyTier ?? "bronze",
    memberSince: profile?.createdAt?.toISOString(),
  };
}

async function getRecentOrders(userId: string) {
  await connectDB();

  const orders = await Order.find({ customerId: userId })
    .sort({ createdAt: -1 })
    .limit(3)
    .select("orderNumber status total createdAt")
    .lean();

  return orders.map((order) => ({
    _id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.total,
    createdAt: order.createdAt.toISOString(),
  }));
}

export default async function AccountPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Session is guaranteed by layout
  const user = session!.user;

  const [stats, recentOrders] = await Promise.all([
    getCustomerStats(user.id),
    getRecentOrders(user.id),
  ]);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CustomerDashboard
        locale={locale}
        user={{
          name: user.name,
          email: user.email,
          image: user.image || undefined,
        }}
        stats={stats}
        recentOrders={recentOrders}
      />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Recent orders skeleton */}
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
