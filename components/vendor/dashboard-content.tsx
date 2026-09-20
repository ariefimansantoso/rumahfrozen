"use client";

import Link from "next/link";
import * as React from "react";
import { AppImage } from "@/components/ui/app-image";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Banknote,
  CreditCard,
  DollarSign,
  Package,
  PackageCheck,
  ShoppingCart,
  Smartphone,
  Plus,
  TrendingUp,
  Wallet,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Blocks,
  Megaphone,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/providers/currency-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DashboardStatsGrid,
  DashboardStatsGridSkeleton,
  type DashboardStatCardItem,
} from "@/components/admin/dashboard-stat-card";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface VendorRecentOrder {
  _id?: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  paymentMethod?: string;
  customerId?: { name?: string; email?: string };
  items?: { name?: string; image?: string; quantity?: number }[];
}

interface VendorSalesByDayPoint {
  _id: string;
  revenue: number;
}

interface VendorAnalyticsData {
  stats: {
    totalRevenue: number;
    netRevenue: number;
    totalOrders: number;
    totalCommission: number;
    totalProducts: number;
    activeProducts: number;
    pendingOrders: number;
  };
  recentOrders: VendorRecentOrder[];
  salesByDay: VendorSalesByDayPoint[];
}

type VendorDateRangePreset = 30 | 90 | 180 | 365;
type AppliedDateRange = { from: Date; to: Date };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeDateRange(
  range: DateRange | undefined,
): AppliedDateRange | null {
  if (!range?.from || !range.to) return null;
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  return from <= to ? { from, to } : { from: to, to: from };
}

function rangeLengthDays(range: AppliedDateRange): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / msPerDay) + 1,
  );
}

function formatAppliedDateRange(
  range: AppliedDateRange,
  locale: string,
): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(range.from)} - ${formatter.format(range.to)}`;
}

function VendorDashboardDateRangePicker({
  value,
  onApply,
  locale,
  t,
}: {
  value: AppliedDateRange;
  onApply: (range: AppliedDateRange) => void;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>({
    from: value.from,
    to: value.to,
  });
  const normalizedDraft = normalizeDateRange(draft);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft({ from: value.from, to: value.to });
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 w-full max-w-full justify-between gap-2 rounded-[6px] border-border bg-muted/40 px-3 text-xs font-medium text-foreground hover:bg-muted/60 sm:w-auto"
        >
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <span className="truncate text-left">
              {formatAppliedDateRange(value, locale)}
            </span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[calc(100vw-2rem)] max-w-[636px] overflow-hidden p-0"
      >
        <div className="overflow-x-auto px-5 pb-5 pt-6">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? value.from}
            numberOfMonths={2}
            fixedWeeks
            weekStartsOn={1}
            autoFocus
            formatters={{
              formatCaption: (date) =>
                `${new Intl.DateTimeFormat(locale, { month: "long" }).format(date)} / ${date.getFullYear()}`,
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-9 rounded-lg px-4 text-[13px] font-medium"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!normalizedDraft}
            onClick={() => {
              if (!normalizedDraft) return;
              onApply(normalizedDraft);
              setOpen(false);
            }}
            className="h-9 rounded-lg px-4 text-[13px] font-semibold"
          >
            {t("common.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VendorDashboardContent() {
  const t = useTranslations();
  const intlLocale = useLocale();
  const params = useParams();
  const locale = (params.locale as string) || intlLocale || "en";
  const { formatPrice } = useCurrency();

  const [data, setData] = useState<VendorAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ordersChartView, setOrdersChartView] = React.useState<
    "orders" | "sales"
  >("orders");
  const [periodDays, setPeriodDays] =
    React.useState<VendorDateRangePreset>(365);
  const [ordersDateRange, setOrdersDateRange] =
    React.useState<AppliedDateRange>(() => {
      const to = startOfDay(new Date());
      const from = new Date(to);
      from.setMonth(from.getMonth() - 11);
      from.setDate(1);
      return { from, to };
    });
  const [highlightsOpen, setHighlightsOpen] = React.useState(false);
  const [salesDataOpen, setSalesDataOpen] = React.useState(false);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/vendor/analytics?period=${periodDays}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setData(json.data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalytics();
  }, [periodDays]);

  const safeData: VendorAnalyticsData = data ?? {
    stats: {
      totalRevenue: 0,
      netRevenue: 0,
      totalOrders: 0,
      totalCommission: 0,
      totalProducts: 0,
      activeProducts: 0,
      pendingOrders: 0,
    },
    recentOrders: [],
    salesByDay: [],
  };

  const monthlyOrderData = React.useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
    const buckets = new Map<
      string,
      { monthDate: Date; revenue: number; orders: number }
    >();

    for (const point of safeData.salesByDay) {
      const date = new Date(point._id);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const current = buckets.get(key) || { monthDate, revenue: 0, orders: 0 };
      current.revenue += point.revenue || 0;
      current.orders += 1;
      buckets.set(key, current);
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime())
      .slice(-12)
      .map((item) => ({
        month: monthFormatter.format(item.monthDate),
        monthDate: item.monthDate,
        inStore: 0,
        online: ordersChartView === "orders" ? item.orders : item.revenue,
        inStoreOrders: 0,
        onlineOrders: item.orders,
        inStoreSales: 0,
        onlineSales: item.revenue,
      }));
  }, [safeData.salesByDay, locale, ordersChartView]);

  const filteredMonthlyOrderData = React.useMemo(
    () =>
      monthlyOrderData.filter(
        (item) =>
          item.monthDate >= ordersDateRange.from &&
          item.monthDate <= ordersDateRange.to,
      ),
    [monthlyOrderData, ordersDateRange],
  );

  const maxSeriesValue = filteredMonthlyOrderData.reduce(
    (max, item) => Math.max(max, item.inStore, item.online),
    0,
  );
  const chartMaxValue = Math.max(
    maxSeriesValue,
    ordersChartView === "orders" ? 4 : 100,
  );
  const chartTicks = Array.from(
    { length: 5 },
    (_, index) => (chartMaxValue / 4) * index,
  );
  const totalChartValue =
    ordersChartView === "orders"
      ? filteredMonthlyOrderData.reduce(
          (sum, item) => sum + item.inStoreOrders + item.onlineOrders,
          0,
        )
      : filteredMonthlyOrderData.reduce(
          (sum, item) => sum + item.inStoreSales + item.onlineSales,
          0,
        );
  const totalChartTarget = Math.max(
    chartMaxValue,
    ordersChartView === "orders" ? 100 : safeData.stats.totalRevenue || 100,
  );
  const totalChartProgress =
    totalChartTarget > 0
      ? Math.min((totalChartValue / totalChartTarget) * 100, 100)
      : 0;

  const dashboardStats: DashboardStatCardItem[] = [
    {
      id: "vendor-total-revenue",
      label: t("vendor.totalRevenue"),
      value: formatPrice(safeData.stats.totalRevenue),
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      id: "vendor-net-earnings",
      label: t("vendor.netEarnings"),
      value: formatPrice(safeData.stats.netRevenue),
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      id: "vendor-total-orders",
      label: t("vendor.totalOrders"),
      value: safeData.stats.totalOrders.toLocaleString(locale),
      icon: <ShoppingCart className="w-5 h-5" />,
    },
    {
      id: "vendor-active-products",
      label: t("vendor.activeProducts"),
      value: safeData.stats.activeProducts.toLocaleString(locale),
      icon: <Package className="w-5 h-5" />,
      subLabel:
        safeData.stats.pendingOrders > 0
          ? `${safeData.stats.pendingOrders.toLocaleString(locale)} ${t(
              "vendor.pending",
            )}`
          : undefined,
      trend:
        safeData.stats.pendingOrders > 0
          ? {
              value: t("common.attention"),
              direction: "down",
            }
          : undefined,
    },
  ];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("vendor.unableToLoadData")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("common.dashboard")}
          </h2>
          <p className="text-muted-foreground">
            {t("vendor.dashboardSubtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/${locale}/vendor/orders`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              {t("vendor.viewOrders")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/${locale}/vendor/products/new`}>
              <Plus className="mr-2 h-4 w-4" />
              {t("vendor.addProduct")}
            </Link>
          </Button>
        </div>
      </div>

      <DashboardStatsGrid
        stats={dashboardStats}
        className="lg:grid-cols-4 2xl:grid-cols-4"
        cardClassName="px-4 py-4"
      />

      <section className="overflow-hidden rounded-sm border-none bg-card shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {ordersChartView === "orders"
              ? t("admin.dashboardPage.ordersTitle")
              : t("admin.dashboardPage.sales")}
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <VendorDashboardDateRangePicker
              value={ordersDateRange}
              onApply={(range) => {
                setOrdersDateRange(range);
                const days = rangeLengthDays(range);
                if (days <= 30) setPeriodDays(30);
                else if (days <= 90) setPeriodDays(90);
                else if (days <= 180) setPeriodDays(180);
                else setPeriodDays(365);
              }}
              locale={locale}
              t={t}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-8 w-full justify-center gap-2 rounded-[6px] border-border bg-muted/40 text-xs font-medium text-foreground hover:bg-muted/60 sm:w-auto"
                >
                  <Plus className="size-4" />
                  {t("admin.dashboardPage.addActivity")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {t("admin.dashboardPage.quickActions")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/vendor/products/new`}>
                    {t("admin.dashboardPage.addProduct")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/vendor/categories`}>
                    {t("admin.dashboardPage.addCategory")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/vendor/collections`}>
                    {t("admin.dashboardPage.addCollection")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/vendor/orders`}>
                    {t("admin.sidebar.orders")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px]">
          <div className="border-t p-4 sm:p-5 xl:border-t-0 xl:border-r">
            <div className="h-70 sm:h-85">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredMonthlyOrderData}
                  barCategoryGap="22%"
                  barGap={4}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="0"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    domain={[0, chartMaxValue]}
                    ticks={chartTicks}
                    tickFormatter={(value) =>
                      ordersChartView === "orders"
                        ? Number(value).toLocaleString(locale)
                        : formatPrice(Number(value))
                    }
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                    contentStyle={{
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--card)",
                      color: "var(--foreground)",
                    }}
                    formatter={(value, name) => [
                      ordersChartView === "orders"
                        ? Number(value).toLocaleString(locale)
                        : formatPrice(Number(value)),
                      name === "inStore"
                        ? t("admin.dashboardPage.stats.inStore")
                        : t("admin.dashboardPage.stats.online"),
                    ]}
                  />
                  <Bar
                    dataKey="inStore"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    dataKey="online"
                    fill="var(--muted-foreground)"
                    fillOpacity={0.45}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-[2px] bg-blue-600" />
                {t("admin.dashboardPage.stats.inStore")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-[2px] bg-muted-foreground/50" />
                {t("admin.dashboardPage.stats.online")}
              </span>
            </div>
          </div>

          <div className="space-y-5 border-t p-5 xl:border-t-0">
            <div className="flex items-center gap-6 border-b text-sm">
              <button
                type="button"
                onClick={() => setOrdersChartView("orders")}
                className={cn(
                  "-mb-px border-b-2 pb-3 transition-colors",
                  ordersChartView === "orders"
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t("admin.dashboardPage.ordersTitle")}
              </button>
              <button
                type="button"
                onClick={() => setOrdersChartView("sales")}
                className={cn(
                  "-mb-px border-b-2 pb-3 transition-colors",
                  ordersChartView === "sales"
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t("admin.dashboardPage.sales")}
              </button>
            </div>

            <div>
              <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-[40px] sm:leading-tight">
                {ordersChartView === "orders"
                  ? totalChartValue.toLocaleString(locale)
                  : formatPrice(totalChartValue)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-blue-600"
                  style={{ width: `${totalChartProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0.00</span>
                <span>
                  {ordersChartView === "orders"
                    ? Math.round(totalChartTarget).toLocaleString(locale)
                    : formatPrice(totalChartTarget)}
                </span>
              </div>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {t("admin.dashboardPage.ordersDescription")}
            </p>

            <div className="space-y-2">
              <ActionRow
                icon={<Megaphone className="size-4" />}
                label={t("admin.dashboardPage.showHighlights")}
                onClick={() => setHighlightsOpen(true)}
              />
              <ActionRow
                icon={<Blocks className="size-4" />}
                label={t("admin.dashboardPage.showSalesData")}
                onClick={() => setSalesDataOpen(true)}
              />
            </div>
          </div>
        </div>
      </section>

      <Dialog open={highlightsOpen} onOpenChange={setHighlightsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t("admin.dashboardPage.showHighlights")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.dashboardPage.highlightsDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboardPage.ordersTitle")}
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {safeData.stats.totalOrders.toLocaleString(locale)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboardPage.sales")}
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatPrice(safeData.stats.totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboardPage.stats.inStore")}
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatPrice(0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboardPage.stats.online")}
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatPrice(safeData.stats.totalRevenue)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={`/${locale}/vendor/dashboard`}
              className="inline-flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("common.dashboard")}
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <Link
              href={`/${locale}/vendor/orders`}
              className="inline-flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("admin.sidebar.orders")}
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={salesDataOpen} onOpenChange={setSalesDataOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("admin.dashboardPage.showSalesData")}
            </DialogTitle>
            <DialogDescription>
              {formatAppliedDateRange(ordersDateRange, locale)}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/70">
                <tr className="border-b text-left">
                  <th className="px-3 py-2 font-medium">
                    {t("common.month")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("admin.dashboardPage.stats.inStore")}{" "}
                    {t("admin.dashboardPage.ordersTitle")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("admin.dashboardPage.stats.online")}{" "}
                    {t("admin.dashboardPage.ordersTitle")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("admin.dashboardPage.stats.inStore")}{" "}
                    {t("admin.dashboardPage.sales")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("admin.dashboardPage.stats.online")}{" "}
                    {t("admin.dashboardPage.sales")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyOrderData.map((entry) => {
                  const monthLabel = new Intl.DateTimeFormat(locale, {
                    month: "short",
                    year: "numeric",
                  }).format(entry.monthDate);

                  return (
                    <tr
                      key={entry.monthDate.toISOString()}
                      className="border-b"
                    >
                      <td className="px-3 py-2">{monthLabel}</td>
                      <td className="px-3 py-2">
                        {entry.inStoreOrders.toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2">
                        {entry.onlineOrders.toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2">
                        {formatPrice(entry.inStoreSales)}
                      </td>
                      <td className="px-3 py-2">
                        {formatPrice(entry.onlineSales)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Link href={`/${locale}/vendor/orders`}>
              <Button variant="outline" className="h-8 text-xs">
                {t("admin.sidebar.orders")}
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <section className="rounded-sm border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold text-foreground">
            {t("vendor.recentOrders")}
          </h3>
          <Link
            href={`/${locale}/vendor/orders`}
            className="text-sm text-muted-foreground hover:text-foreground sm:text-base"
          >
            {t("admin.dashboardPage.viewAllOrders")}
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {safeData.recentOrders.length === 0 ? (
            <div className="rounded-xl border border-border px-4 py-10 text-center text-muted-foreground">
              {t("admin.dashboardPage.noRecentOrders")}
            </div>
          ) : (
            safeData.recentOrders.map((order) => (
              <VendorRecentOrderCard
                key={order._id || order.orderNumber}
                order={order}
                locale={locale}
                formatPrice={formatPrice}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
      <span className="inline-flex items-center gap-2.5 text-sm font-medium text-foreground">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-blue-600/10 text-blue-600">
          {icon}
        </span>
        {label}
      </span>
      <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
    </button>
  );
}

function getVendorStatusPill(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "delivered" || normalized === "completed") {
    return {
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      label: status,
    };
  }
  if (normalized === "pending" || normalized === "processing") {
    return {
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      label: status,
    };
  }
  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "failed"
  ) {
    return {
      className:
        "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      label: status,
    };
  }

  return {
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    label: status,
  };
}

function getVendorPaymentMethodMeta(
  t: ReturnType<typeof useTranslations>,
  paymentMethod?: string,
) {
  const key = (paymentMethod || "").toLowerCase();
  if (key.includes("paypal")) {
    return {
      label: t("admin.dashboardPage.payment.paypal"),
      Icon: Wallet,
    };
  }
  if (key.includes("razorpay")) {
    return { label: "Razorpay", Icon: Wallet };
  }
  if (key.includes("paystack")) {
    return { label: "Paystack", Icon: Wallet };
  }
  if (key.includes("cod") || key.includes("cash")) {
    return {
      label: t("admin.dashboardPage.payment.cashOnDelivery"),
      Icon: Banknote,
    };
  }
  if (key.includes("upi")) {
    return {
      label: t("admin.dashboardPage.payment.upi"),
      Icon: Smartphone,
    };
  }
  return {
    label:
      paymentMethod ||
      t("admin.dashboardPage.payment.card"),
    Icon: CreditCard,
  };
}

function VendorRecentOrderCard({
  order,
  locale,
  formatPrice,
}: {
  order: VendorRecentOrder;
  locale: string;
  formatPrice: (amount: number) => string;
}) {
  const t = useTranslations();
  const statusMeta = getVendorStatusPill(order.status);
  const paymentMeta = getVendorPaymentMethodMeta(t, order.paymentMethod);
  const primaryItem = order.items?.[0];
  const totalItems = (order.items || []).reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  return (
    <Link
      href={
        order._id
          ? `/${locale}/vendor/orders/${order._id}`
          : `/${locale}/vendor/orders`
      }
      className="grid grid-cols-1 gap-4 rounded-sm border border-border px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-2 lg:grid-cols-[minmax(260px,2.1fr)_1.1fr_0.6fr_0.8fr_1fr_0.7fr]"
    >
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
        <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted">
          {primaryItem?.image ? (
            <AppImage
              src={primaryItem.image}
              alt={primaryItem?.name || order.orderNumber}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <PackageCheck className="size-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {primaryItem?.name ||
              t("admin.dashboardPage.orderLabel", {
                orderNumber: order.orderNumber,
              })}
          </p>
          <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          {t("admin.dashboardPage.customer")}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {order.customerId?.name ||
            t("common.guest")}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          {t("common.qty")}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {totalItems || 0}{" "}
          {(totalItems || 0) === 1
            ? t("admin.dashboardPage.pc")
            : t("admin.dashboardPage.pcs")}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          {t("common.status")}
        </p>
        <span
          className={cn(
            "mt-1 inline-flex rounded-sm px-2 py-1 text-[12px] font-medium",
            statusMeta.className,
          )}
        >
          {statusMeta.label}
        </span>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          {t("admin.dashboardPage.paymentMethod")}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <paymentMeta.Icon className="size-3.5 text-muted-foreground" />
          {paymentMeta.label}
        </p>
      </div>

      <div className="sm:col-span-2 lg:col-span-1 lg:text-right">
        <p className="text-xs text-muted-foreground">
          {t("admin.dashboardPage.totalPrice")}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {formatPrice(order.total)}
        </p>
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <DashboardStatsGridSkeleton
        items={4}
        className="lg:grid-cols-4 2xl:grid-cols-4"
        cardClassName="px-4 py-4"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[350px] rounded-2xl" />
        <Skeleton className="h-[350px] rounded-2xl" />
      </div>
    </div>
  );
}
