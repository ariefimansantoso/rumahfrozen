"use client";

import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import * as React from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  Blocks,
  CreditCard,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Megaphone,
  PackageCheck,
  Plus,
  Smartphone,
  Wallet,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useCurrency } from "@/providers/currency-provider";
import { DashboardStatTrend } from "@/components/admin/dashboard-stat-card";

const visitorsLineData = [
  { day: "1", current: 0, previous: 0 },
  { day: "2", current: 0, previous: 0 },
  { day: "3", current: 0, previous: 0 },
  { day: "4", current: 0, previous: 0 },
  { day: "5", current: 0, previous: 0 },
  { day: "6", current: 0, previous: 0 },
  { day: "7", current: 0, previous: 0 },
  { day: "8", current: 0, previous: 0 },
  { day: "9", current: 0, previous: 0 },
  { day: "10", current: 0, previous: 0 },
];

function TrendText({ value, up }: { value: string; up: boolean }) {
  return <DashboardStatTrend value={value} direction={up ? "up" : "down"} />;
}

function truncateWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/);
  if (words.length <= maxWords) return value;

  return `${words.slice(0, maxWords).join(" ")}...`;
}

export interface RecentOrder {
  _id: string;
  orderNumber: string;
  customerId?: { name?: string; email?: string };
  total: number;
  status: string;
  paymentMethod?: string;
  items: { name?: string; image?: string; quantity: number }[];
}

export interface OrderChartPoint {
  year: number;
  monthIndex: number;
  inStoreOrders: number;
  onlineOrders: number;
  inStoreSales: number;
  onlineSales: number;
}

export interface OrderChartMetrics {
  data: OrderChartPoint[];
  dateRange: {
    start: string;
    end: string;
  };
  totalOrders: number;
  totalSales: number;
}

export interface LatestProduct {
  _id: string;
  name: string;
  price: number;
  image?: string;
}

export interface VisitorsChartPoint {
  day: string;
  current: number;
  previous: number;
}

export interface VisitorsChartMetrics {
  configured: boolean;
  currentTotal: number;
  previousTotal: number;
  data: VisitorsChartPoint[];
}

export interface DashboardStatMetric {
  /** Primary value: currency amount for sales/discount/refunds, count for orders/customers. */
  amount: number;
  /** Secondary count shown in the sub-label (orders, cases, or new customers). */
  count: number;
  /** Percent change vs the previous month, or null when there is no trend to show. */
  value: number | null;
  direction: "up" | "down" | "neutral";
}

export interface DashboardStats {
  inStoreSales: DashboardStatMetric;
  websiteSales: DashboardStatMetric;
  totalOrders: DashboardStatMetric;
  discount: DashboardStatMetric;
  refunds: DashboardStatMetric;
  customers: DashboardStatMetric;
}

interface AdminDashboardContentProps {
  recentOrders: RecentOrder[];
  orderChart: OrderChartMetrics;
  latestProducts: LatestProduct[];
  visitorsChart: VisitorsChartMetrics;
}

type OrdersChartView = "orders" | "sales";
type AppliedDateRange = { from: Date; to: Date };

function getNiceMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 4;

  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function getChartTicks(maxValue: number) {
  return Array.from({ length: 5 }, (_, index) => (maxValue / 4) * index);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeDateRange(range: DateRange | undefined): AppliedDateRange | null {
  if (!range?.from || !range.to) return null;
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  return from <= to ? { from, to } : { from: to, to: from };
}

function formatAppliedDateRange(range: AppliedDateRange, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(range.from)} - ${formatter.format(range.to)}`;
}

function AdminDashboardDateRangePicker({
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft({ from: value.from, to: value.to });
    }
    setOpen(nextOpen);
  };

  const handleApply = () => {
    if (!normalizedDraft) return;
    onApply(normalizedDraft);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
            onClick={handleApply}
            className="h-9 rounded-lg px-4 text-[13px] font-semibold"
          >
            {t("common.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AdminDashboardContent({
  recentOrders,
  orderChart,
  latestProducts,
  visitorsChart,
}: AdminDashboardContentProps) {
  const t = useTranslations();
  const intlLocale = useLocale();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale || intlLocale || "en";
  const { formatPrice } = useCurrency();
  const [ordersChartView, setOrdersChartView] =
    React.useState<OrdersChartView>("orders");
  const [ordersDateRange, setOrdersDateRange] = React.useState<AppliedDateRange>(() => {
    const allData = orderChart.data || [];
    if (allData.length === 0) {
      const now = startOfDay(new Date());
      return { from: now, to: now };
    }
    const first = allData[0];
    const last = allData[allData.length - 1];
    return {
      from: startOfDay(new Date(first.year, first.monthIndex, 1)),
      to: startOfDay(new Date(last.year, last.monthIndex + 1, 0)),
    };
  });
  const [highlightsOpen, setHighlightsOpen] = React.useState(false);
  const [salesDataOpen, setSalesDataOpen] = React.useState(false);

  const formatNumber = React.useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );

  const formatCompactNumber = React.useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value),
    [locale],
  );

  const filteredOrderChartData = React.useMemo(() => {
    return (orderChart.data || []).filter((entry) => {
      const monthDate = startOfDay(new Date(entry.year, entry.monthIndex, 1));
      return monthDate >= ordersDateRange.from && monthDate <= ordersDateRange.to;
    });
  }, [orderChart.data, ordersDateRange]);

  const localizedOrderData = React.useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    });

    return filteredOrderChartData.map((entry) => ({
      month: monthFormatter.format(
        new Date(Date.UTC(entry.year, entry.monthIndex, 1)),
      ),
      inStore:
        ordersChartView === "orders" ? entry.inStoreOrders : entry.inStoreSales,
      online:
        ordersChartView === "orders" ? entry.onlineOrders : entry.onlineSales,
    }));
  }, [locale, filteredOrderChartData, ordersChartView]);

  const filteredOrderTotals = React.useMemo(() => {
    return filteredOrderChartData.reduce(
      (acc, entry) => {
        acc.totalOrders += entry.inStoreOrders + entry.onlineOrders;
        acc.totalSales += entry.inStoreSales + entry.onlineSales;
        return acc;
      },
      { totalOrders: 0, totalSales: 0 },
    );
  }, [filteredOrderChartData]);

  const chartMaxValue = React.useMemo(() => {
    const maxSeriesValue = localizedOrderData.reduce(
      (max, item) => Math.max(max, item.inStore, item.online),
      0,
    );
    return getNiceMax(maxSeriesValue);
  }, [localizedOrderData]);

  const chartTicks = React.useMemo(
    () => getChartTicks(chartMaxValue),
    [chartMaxValue],
  );
  const visitorsTrendDelta =
    visitorsChart.currentTotal - visitorsChart.previousTotal;
  const visitorsTrendUp = visitorsTrendDelta >= 0;
  const visitorsTrendPercent = React.useMemo(() => {
    if (visitorsChart.previousTotal > 0) {
      return (Math.abs(visitorsTrendDelta) / visitorsChart.previousTotal) * 100;
    }

    return visitorsChart.currentTotal > 0 ? 100 : 0;
  }, [
    visitorsChart.currentTotal,
    visitorsChart.previousTotal,
    visitorsTrendDelta,
  ]);
  const visitorsTrendLabel = React.useMemo(() => {
    if (visitorsTrendPercent === 0) return "0%";

    const formatted =
      visitorsTrendPercent >= 10
        ? visitorsTrendPercent.toFixed(0)
        : visitorsTrendPercent.toFixed(1);

    return `${formatted}%`;
  }, [visitorsTrendPercent]);
  const visitorsChartMaxValue = React.useMemo(() => {
    const maxSeriesValue = visitorsChart.data.reduce(
      (max, point) => Math.max(max, point.current, point.previous),
      0,
    );
    return getNiceMax(maxSeriesValue);
  }, [visitorsChart.data]);
  const visitorsChartTicks = React.useMemo(
    () => getChartTicks(visitorsChartMaxValue),
    [visitorsChartMaxValue],
  );

  const totalChartValue =
    ordersChartView === "orders"
      ? filteredOrderTotals.totalOrders
      : filteredOrderTotals.totalSales;
  const totalChartTarget = Math.max(
    getNiceMax(totalChartValue),
    ordersChartView === "orders" ? 100 : 1000,
  );
  const totalChartProgress =
    totalChartTarget > 0
      ? Math.min((totalChartValue / totalChartTarget) * 100, 100)
      : 0;

  return (
    <>
      <section className="overflow-hidden rounded-sm border-none bg-card shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {ordersChartView === "orders"
              ? t("admin.dashboardPage.ordersTitle")
              : t("admin.dashboardPage.sales")}
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <AdminDashboardDateRangePicker
              value={ordersDateRange}
              onApply={setOrdersDateRange}
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
                  <Link href={`/${locale}/admin/products/new`}>
                    {t("admin.dashboardPage.addProduct")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/admin/categories/new`}>
                    {t("admin.dashboardPage.addCategory")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/admin/collections/new`}>
                    {t("admin.dashboardPage.addCollection")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/admin/customers/new`}>
                    {t("admin.dashboardPage.addCustomer")}
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
                  data={localizedOrderData}
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
                      formatCompactNumber(Number(value))
                    }
                    width={40}
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
                        ? formatNumber(Number(value))
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
                    activeBar={{ fill: "var(--primary)" }}
                  />
                  <Bar
                    dataKey="online"
                    fill="var(--muted-foreground)"
                    fillOpacity={0.45}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                    activeBar={{
                      fill: "var(--muted-foreground)",
                      fillOpacity: 0.45,
                    }}
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
                  ? formatNumber(totalChartValue)
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
                    ? formatNumber(totalChartTarget)
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
                {formatNumber(filteredOrderTotals.totalOrders)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboardPage.sales")}
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatPrice(filteredOrderTotals.totalSales)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboardPage.stats.inStore")}
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatPrice(
                  filteredOrderChartData.reduce((sum, item) => sum + item.inStoreSales, 0),
                )}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboardPage.stats.online")}
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatPrice(
                  filteredOrderChartData.reduce((sum, item) => sum + item.onlineSales, 0),
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={`/${locale}/admin/analytics`}
              className="inline-flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("admin.sidebar.analytics")}
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <Link
              href={`/${locale}/admin/orders`}
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
                {filteredOrderChartData.map((entry) => {
                  const monthLabel = new Intl.DateTimeFormat(locale, {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(entry.year, entry.monthIndex, 1)));

                  return (
                    <tr key={`${entry.year}-${entry.monthIndex}`} className="border-b">
                      <td className="px-3 py-2">{monthLabel}</td>
                      <td className="px-3 py-2">{formatNumber(entry.inStoreOrders)}</td>
                      <td className="px-3 py-2">{formatNumber(entry.onlineOrders)}</td>
                      <td className="px-3 py-2">{formatPrice(entry.inStoreSales)}</td>
                      <td className="px-3 py-2">{formatPrice(entry.onlineSales)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Link href={`/${locale}/admin/analytics`}>
              <Button variant="outline" className="h-8 text-xs">
                {t("admin.sidebar.analytics")}
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <section className="rounded-sm border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold text-foreground">
            {t("admin.dashboardPage.recentOrders")}
          </h3>
          <Link
            href={`/${locale}/admin/orders`}
            className="text-sm text-muted-foreground hover:text-foreground sm:text-base"
          >
            {t("admin.dashboardPage.viewAllOrders")}
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {recentOrders.length === 0 ? (
            <div className="rounded-xl border border-border px-4 py-10 text-center text-muted-foreground">
              {t("admin.dashboardPage.noRecentOrders")}
            </div>
          ) : (
            recentOrders.map((order) => (
              <RecentOrderCard
                key={order._id}
                order={order}
                locale={locale}
                formatPrice={formatPrice}
              />
            ))
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LatestProductsCard
          titleKey="admin.dashboardPage.latestProducts"
          products={latestProducts}
          locale={locale}
          formatPrice={formatPrice}
          emptyStateKey="admin.dashboardPage.noLatestProducts"
          t={t}
        />
        <MiniChartCard
          title={t("admin.dashboardPage.totalVisitors")}
          trend={visitorsTrendLabel}
          trendUp={visitorsTrendUp}
          total={formatNumber(visitorsChart.currentTotal)}
          sideLabel={`${formatNumber(visitorsChart.currentTotal)} ${t(
            "admin.analyticsPage.visitors",
          )}`}
          data={
            visitorsChart.configured ? visitorsChart.data : visitorsLineData
          }
          yTicks={
            visitorsChart.configured
              ? visitorsChartTicks
              : [0, 12.5, 25, 37.5, 50]
          }
          yDomain={
            visitorsChart.configured ? [0, visitorsChartMaxValue] : [0, 50]
          }
          primaryLabel={t("admin.analyticsPage.visitors")}
          secondaryLabel={t("admin.analyticsPage.pageviews")}
          locale={locale}
        />
      </div>
    </>
  );
}

function LatestProductsCard({
  titleKey,
  products,
  locale,
  formatPrice,
  emptyStateKey,
  t,
}: {
  titleKey: string;
  products: LatestProduct[];
  locale: string;
  formatPrice: (amount: number) => string;
  emptyStateKey: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="rounded-sm border bg-card p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-foreground sm:text-[20px]">
        {t(titleKey, { defaultMessage: "Latest Products" })}
      </h3>

      {products.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {t(emptyStateKey, { defaultMessage: "No latest products found." })}
        </p>
      ) : (
        <div className="mt-5 divide-y divide-border">
          {products.map((product) => (
            <Link
              key={product._id}
              href={`/${locale}/admin/products/${product._id}/edit`}
              className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {product.image ? (
                  <AppImage
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <PackageCheck className="size-4" />
                  </div>
                )}
              </div>
              <p
                className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground"
                title={
                  truncateWords(product.name, 9) !== product.name
                    ? product.name
                    : undefined
                }
              >
                {truncateWords(product.name, 9)}
              </p>
              <span className="shrink-0 text-[15px] text-muted-foreground">
                {formatPrice(product.price)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function getStatusPill(
  t: ReturnType<typeof useTranslations>,
  orderStatus: string,
) {
  const config: Record<string, { label: string; className: string }> = {
    pending: {
      label: t("admin.dashboardPage.status.pending"),
      className: "bg-red-500/15 text-red-600 dark:text-red-400",
    },
    processing: {
      label: t("admin.dashboardPage.status.processing"),
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    },
    shipped: {
      label: t("admin.dashboardPage.status.shipped"),
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    delivered: {
      label: t("admin.dashboardPage.status.delivered"),
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
    cancelled: {
      label: t("admin.dashboardPage.status.cancelled"),
      className: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    },
  };
  return config[orderStatus] || config.pending;
}

function getPaymentMethodMeta(
  t: ReturnType<typeof useTranslations>,
  paymentMethod?: string,
) {
  const key = (paymentMethod || "card").toLowerCase();
  if (key.includes("card")) {
    return {
      label: t("admin.dashboardPage.payment.creditCard"),
      Icon: CreditCard,
    };
  }
  if (key.includes("paypal")) {
    return {
      label: t("admin.dashboardPage.payment.paypal"),
      Icon: Wallet,
    };
  }
  if (key.includes("razorpay")) {
    return {
      label: "Razorpay",
      Icon: Wallet,
    };
  }
  if (key.includes("paystack")) {
    return {
      label: "Paystack",
      Icon: Wallet,
    };
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

function RecentOrderCard({
  order,
  locale,
  formatPrice,
}: {
  order: RecentOrder;
  locale: string;
  formatPrice: (amount: number) => string;
}) {
  const t = useTranslations();
  const primaryItem = order.items[0];
  const totalItems = order.items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );
  const statusMeta = getStatusPill(t, order.status);
  const paymentMeta = getPaymentMethodMeta(t, order.paymentMethod);
  const productName = primaryItem?.name;
  const displayProductName = productName
    ? truncateWords(productName, 5)
    : t("admin.dashboardPage.orderLabel", {
        orderNumber: order.orderNumber,
      });

  return (
    <Link
      href={`/${locale}/admin/orders/${order._id}`}
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
          <p
            className="truncate text-sm font-medium text-foreground"
            title={
              productName && displayProductName !== productName
                ? productName
                : undefined
            }
          >
            {displayProductName}
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
          {totalItems}{" "}
          {totalItems === 1
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

function ActionRow({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60";

  const content = (
    <>
      <span className="inline-flex items-center gap-2.5 text-sm font-medium text-foreground">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-blue-600/10 text-blue-600">
          {icon}
        </span>
        {label}
      </span>
      <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function MiniChartCard({
  title,
  trend,
  trendUp,
  total,
  sideLabel,
  data,
  yTicks,
  yDomain,
  primaryLabel,
  secondaryLabel,
  locale,
}: {
  title: string;
  trend: string;
  trendUp: boolean;
  total: string;
  sideLabel: string;
  data: { day: string; current: number; previous: number }[];
  yTicks: number[];
  yDomain: [number, number];
  primaryLabel: string;
  secondaryLabel: string;
  locale: string;
}) {
  const formatTooltipLabel = (label: unknown) => {
    if (typeof label !== "string") return String(label ?? "");

    if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
      const date = new Date(`${label.slice(0, 10)}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat(locale, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(date);
      }
    }

    return label;
  };

  return (
    <section className="rounded-sm border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground sm:text-[20px]">
            {title}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground sm:text-[24px]">
              {total}
            </span>
            <TrendText value={trend} up={trendUp} />
          </div>
        </div>
        <span className="text-sm text-muted-foreground">{sideLabel}</span>
      </div>

      <div className="mt-4 h-[220px] sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="0"
            />
            <XAxis dataKey="day" hide />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              ticks={yTicks}
              domain={yDomain}
            />
            <Tooltip
              cursor={{
                stroke: "var(--border)",
                strokeDasharray: "3 3",
                strokeWidth: 1,
              }}
              wrapperStyle={{ outline: "none" }}
              contentStyle={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--foreground)",
              }}
              formatter={(value, name) => [
                new Intl.NumberFormat(locale).format(Number(value)),
                name,
              ]}
              labelFormatter={formatTooltipLabel}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke="var(--primary)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "var(--primary)" }}
              name={primaryLabel}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--muted-foreground)"
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 0,
                fill: "var(--muted-foreground)",
              }}
              name={secondaryLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-[2px] bg-blue-600" /> {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-[2px] bg-muted-foreground/60" />{" "}
          {secondaryLabel}
        </span>
      </div>
    </section>
  );
}
