"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Package,
  ShoppingBag,
  ChevronRight,
  Clock,
  Heart,
  Star,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/providers/currency-provider";
import type { LoyaltyTier } from "@/types";

interface CustomerDashboardProps {
  locale: string;
  user: {
    name: string;
    email: string;
    image?: string;
  };
  stats: {
    totalOrders: number;
    wishlistCount: number;
    pendingOrders: number;
    totalSpent?: number;
    loyaltyPoints?: number;
    loyaltyTier?: LoyaltyTier;
    memberSince?: string;
  };
  recentOrders: Array<{
    _id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const tierColors: Record<LoyaltyTier, string> = {
  bronze: "bg-orange-100 text-orange-800 border-orange-300",
  silver: "bg-gray-100 text-gray-700 border-gray-300",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
  platinum: "bg-violet-100 text-violet-800 border-violet-300",
};

export function CustomerDashboard({
  locale,
  stats,
  recentOrders,
}: CustomerDashboardProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("common.overview")}</h1>
          <p className="text-muted-foreground">
            {t("account.overviewDesc")}
          </p>
        </div>
        {stats.loyaltyTier && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={tierColors[stats.loyaltyTier]}
            >
              <Star className="h-3 w-3 mr-1" />
              {t(`customerProfile.${stats.loyaltyTier}`)}
            </Badge>
            {typeof stats.loyaltyPoints === "number" && (
              <span className="text-sm text-muted-foreground">
                {stats.loyaltyPoints.toLocaleString(locale)}{" "}
                {t("customerProfile.loyaltyPoints")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <ShoppingBag className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-sm text-muted-foreground">
                  {t("account.totalOrders")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                <p className="text-sm text-muted-foreground">
                  {t("account.pendingOrders")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.wishlistCount}</p>
                <p className="text-sm text-muted-foreground">
                  {t("account.wishlistItems")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-500/10">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.totalSpent ?? 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("customerProfile.totalSpent")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("account.recentOrders")}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${locale}/account/orders`}>
              {t("common.viewAll")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t("account.noOrders")}</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href={`/${locale}/products`}>
                  {t("account.startShopping")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <Link
                  key={order._id}
                  href={`/${locale}/account/orders/${order._id}`}
                  className="block"
                >
                  <div className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          #{order.orderNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
                      <Badge
                        variant="secondary"
                        className={statusColors[order.status] || ""}
                      >
                        {order.status}
                      </Badge>
                      <span className="shrink-0 whitespace-nowrap font-semibold">
                        {formatPrice(order.totalAmount)}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
