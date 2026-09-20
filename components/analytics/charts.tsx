"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/providers/currency-provider";
import { useTranslations } from "next-intl";

interface ChartDataPoint {
  _id: string;
  revenue?: number;
  orders?: number;
  [key: string]: unknown;
}

interface SimpleChartProps {
  data: ChartDataPoint[];
  title: string;
  valueKey?: "revenue" | "orders";
  valuePrefix?: string;
  className?: string;
  color?: string;
}

export function SimpleBarChart({
  data,
  title,
  valueKey = "revenue",
  valuePrefix = "$",
  className,
  color = "bg-primary",
}: SimpleChartProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const { maxValue, total } = useMemo(() => {
    const values = data.map((d) => (d[valueKey] as number) || 0);
    return {
      maxValue: Math.max(...values, 1),
      total: values.reduce((sum, v) => sum + v, 0),
    };
  }, [data, valueKey]);

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {t("vendor.charts.noDataAvailable")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-2xl font-bold">
            {valueKey === "revenue" ? formatPrice(total) : `${valuePrefix}${total.toLocaleString()}`}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-32">
          {data.map((item, index) => {
            const value = (item[valueKey] as number) || 0;
            const height = (value / maxValue) * 100;
            return (
              <div
                key={item._id || index}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className={cn("w-full rounded-t transition-all", color)}
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${item._id}: ${
                    valueKey === "revenue"
                      ? formatPrice(value)
                      : `${valuePrefix}${value.toLocaleString()}`
                  }`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{data[0]?._id}</span>
          <span>{data[data.length - 1]?._id}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface TopItemsListProps {
  items: Array<{
    _id?: string;
    name?: string;
    storeName?: string;
    totalSold?: number;
    revenue?: number;
    totalOrders?: number;
  }>;
  title: string;
  className?: string;
}

export function TopItemsList({ items, title, className }: TopItemsListProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            {t("vendor.charts.noDataAvailable")}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...items.map((i) => i.revenue || 0), 1);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => {
          const progress = ((item.revenue || 0) / maxRevenue) * 100;
          return (
            <div key={item._id || index} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium truncate max-w-[60%]">
                  {item.name ||
                    item.storeName ||
                    t("vendor.charts.unknown")}
                </span>
                <span className="text-muted-foreground">
                  {formatPrice(item.revenue || 0)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {item.totalSold
                    ? t("vendor.dashboardWidgets.soldCount", {
                        count: item.totalSold,
                      })
                    : item.totalOrders
                      ? t("vendor.charts.ordersCount", {
                          count: item.totalOrders,
                        })
                    : ""}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface RecentOrdersListProps {
  orders: Array<{
    orderNumber?: string;
    _id?: string;
    total: number;
    status: string;
    createdAt: string;
    userId?: { name?: string; email?: string };
  }>;
  title: string;
  className?: string;
}

export function RecentOrdersList({
  orders,
  title,
  className,
}: RecentOrdersListProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const statusColors: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    shipped:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    delivered:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            {t("vendor.charts.noRecentOrders")}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.orderNumber || order._id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">
                    #{order.orderNumber || order._id?.toString().slice(-8)}
                  </p>
                  {order.userId?.name && (
                    <p className="text-xs text-muted-foreground">
                      {order.userId.name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">
                    {formatPrice(order.total)}
                  </p>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      statusColors[order.status] || "bg-gray-100 text-gray-800"
                    )}
                  >
                    {t(`vendor.fulfillmentStatus.${order.status}`, {
                      defaultMessage: order.status,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
