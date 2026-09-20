import { connectDB } from "@/lib/db";
import { getSettings, Order, Product, ReturnRequest, User } from "@/models";
import { RETURN_REFUND_STATUS } from "@/lib/returns";
import { USER_ROLES } from "@/config/app.config";
import type {
  DashboardStats,
  LatestProduct,
  OrderChartMetrics,
  RecentOrder,
  VisitorsChartMetrics,
} from "@/components/admin/dashboard-content";

export interface DashboardData {
  recentOrders: RecentOrder[];
  orderChart: OrderChartMetrics;
  latestProducts: LatestProduct[];
  visitorsChart: VisitorsChartMetrics;
  stats: DashboardStats;
}

async function getRecentOrders(): Promise<RecentOrder[]> {
  await connectDB();

  const orders = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .select("orderNumber customerId total status paymentMethod items")
    .populate("customerId", "name email")
    .lean();

  return JSON.parse(JSON.stringify(orders));
}

async function getOrderChartMetrics(): Promise<OrderChartMetrics> {
  await connectDB();

  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  );
  const endDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const displayEndDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const monthlyBuckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + index,
        1,
      ),
    );

    return {
      key: `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`,
      year: date.getUTCFullYear(),
      monthIndex: date.getUTCMonth(),
      inStoreOrders: 0,
      onlineOrders: 0,
      inStoreSales: 0,
      onlineSales: 0,
    };
  });

  const bucketByKey = new Map(monthlyBuckets.map((bucket) => [bucket.key, bucket]));

  const rows = await Order.aggregate<{
    _id: { year: number; month: number; channel?: "online" | "pos" };
    orders: number;
    sales: number;
  }>([
    {
      $match: {
        createdAt: { $gte: startDate, $lt: endDate },
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          channel: "$channel",
        },
        orders: { $sum: 1 },
        sales: { $sum: "$total" },
      },
    },
  ]);

  for (const row of rows) {
    const bucket = bucketByKey.get(`${row._id.year}-${row._id.month}`);
    if (!bucket) continue;

    if (row._id.channel === "pos") {
      bucket.inStoreOrders += row.orders;
      bucket.inStoreSales += row.sales;
    } else {
      bucket.onlineOrders += row.orders;
      bucket.onlineSales += row.sales;
    }
  }

  const data = monthlyBuckets.map((bucket) => ({
    year: bucket.year,
    monthIndex: bucket.monthIndex,
    inStoreOrders: bucket.inStoreOrders,
    onlineOrders: bucket.onlineOrders,
    inStoreSales: bucket.inStoreSales,
    onlineSales: bucket.onlineSales,
  }));
  const totalOrders = data.reduce(
    (sum, bucket) => sum + bucket.inStoreOrders + bucket.onlineOrders,
    0,
  );
  const totalSales = data.reduce(
    (sum, bucket) => sum + bucket.inStoreSales + bucket.onlineSales,
    0,
  );

  return {
    data,
    dateRange: {
      start: startDate.toISOString(),
      end: displayEndDate.toISOString(),
    },
    totalOrders,
    totalSales,
  };
}

async function getLatestProducts(): Promise<LatestProduct[]> {
  await connectDB();

  const products = await Product.find({})
    .sort({ createdAt: -1 })
    .limit(4)
    .select("name title price images media")
    .lean<{
      _id: unknown;
      name?: string;
      title?: string;
      price?: number;
      images?: string[];
      media?: { type?: string; url?: string }[];
    }[]>();

  return products.map((product, index) => {
    const mediaImage = product.media?.find(
      (item) => (item?.type || "image") === "image" && item?.url,
    )?.url;

    return {
      _id: String(product._id ?? `latest-product-${index}`),
      name: product.name || product.title || `Product ${index + 1}`,
      price: typeof product.price === "number" ? product.price : 0,
      image: mediaImage || product.images?.[0],
    };
  });
}

interface PlausibleTimeseriesResult {
  date?: string;
  visitors?: number;
  pageviews?: number;
}

interface UtcDateRange {
  from: Date;
  to: Date;
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDayDifferenceInclusive(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / msPerDay) + 1);
}

function getCurrentMonthToDateRangeUTC(now: Date): UtcDateRange {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return { from, to };
}

function getPreviousMonthComparableRangeUTC(currentRange: UtcDateRange): UtcDateRange {
  const daysInCurrentRange = getDayDifferenceInclusive(
    currentRange.from,
    currentRange.to,
  );
  const previousMonthStart = new Date(
    Date.UTC(
      currentRange.from.getUTCFullYear(),
      currentRange.from.getUTCMonth() - 1,
      1,
    ),
  );
  const previousMonthLastDay = new Date(
    Date.UTC(
      previousMonthStart.getUTCFullYear(),
      previousMonthStart.getUTCMonth() + 1,
      0,
    ),
  );
  const previousMonthComparableEnd = new Date(
    Date.UTC(
      previousMonthStart.getUTCFullYear(),
      previousMonthStart.getUTCMonth(),
      daysInCurrentRange,
    ),
  );

  return {
    from: previousMonthStart,
    to:
      previousMonthComparableEnd <= previousMonthLastDay
        ? previousMonthComparableEnd
        : previousMonthLastDay,
  };
}

async function fetchPlausibleVisitorsTimeseries({
  baseUrl,
  domain,
  apiKey,
  range,
}: {
  baseUrl: string;
  domain: string;
  apiKey: string;
  range: UtcDateRange;
}): Promise<PlausibleTimeseriesResult[]> {
  const site = encodeURIComponent(domain);
  const dateRange = `${toUtcDateString(range.from)},${toUtcDateString(range.to)}`;
  const url =
    `${baseUrl}/api/v1/stats/timeseries?site_id=${site}` +
    `&period=custom&date=${dateRange}&metrics=visitors,pageviews`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Plausible timeseries request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { results?: PlausibleTimeseriesResult[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

async function getVisitorsChartMetrics(): Promise<VisitorsChartMetrics> {
  try {
    await connectDB();

    const settings = await getSettings();
    const analyticsSettings = settings.analytics;
    const domain = analyticsSettings?.plausibleDomain
      ? analyticsSettings.plausibleDomain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "")
      : undefined;
    const apiKey = analyticsSettings?.plausibleApiKey;

    if (!domain || !apiKey) {
      return {
        configured: false,
        currentTotal: 0,
        previousTotal: 0,
        data: [],
      };
    }

    const baseUrl =
      analyticsSettings?.plausibleSelfHosted && analyticsSettings?.plausibleBaseUrl
        ? analyticsSettings.plausibleBaseUrl.replace(/\/$/, "")
        : "https://plausible.io";

    const currentRange = getCurrentMonthToDateRangeUTC(new Date());
    const previousRange = getPreviousMonthComparableRangeUTC(currentRange);

    const [currentSeries, previousSeries] = await Promise.all([
      fetchPlausibleVisitorsTimeseries({
        baseUrl,
        domain,
        apiKey,
        range: currentRange,
      }),
      fetchPlausibleVisitorsTimeseries({
        baseUrl,
        domain,
        apiKey,
        range: previousRange,
      }),
    ]);

    const currentVisitorsValues = currentSeries.map((point) =>
      typeof point.visitors === "number" ? point.visitors : 0,
    );
    const currentPageviewsValues = currentSeries.map((point) =>
      typeof point.pageviews === "number" ? point.pageviews : 0,
    );
    const previousVisitorsValues = previousSeries.map((point) =>
      typeof point.visitors === "number" ? point.visitors : 0,
    );

    const pointsCount = Math.max(
      currentVisitorsValues.length,
      currentPageviewsValues.length,
      1,
    );
    const data = Array.from({ length: pointsCount }, (_, index) => ({
      day: currentSeries[index]?.date || String(index + 1),
      current: currentVisitorsValues[index] ?? 0,
      previous: currentPageviewsValues[index] ?? 0,
    }));

    return {
      configured: true,
      currentTotal: currentVisitorsValues.reduce((sum, value) => sum + value, 0),
      previousTotal: previousVisitorsValues.reduce((sum, value) => sum + value, 0),
      data,
    };
  } catch {
    return {
      configured: false,
      currentTotal: 0,
      previousTotal: 0,
      data: [],
    };
  }
}

function buildTrend(
  current: number,
  previous: number,
): { value: number | null; direction: "up" | "down" | "neutral" } {
  if (previous <= 0) {
    return {
      value: current > 0 ? 100 : null,
      direction: current > 0 ? "up" : "neutral",
    };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

interface OrderChannelBucket {
  _id?: "online" | "pos" | null;
  sales: number;
  orders: number;
  discount: number;
  discountOrders: number;
}

function sumOrderBuckets(
  buckets: OrderChannelBucket[],
  channel: "pos" | "online",
) {
  return buckets
    .filter((bucket) =>
      channel === "pos" ? bucket._id === "pos" : bucket._id !== "pos",
    )
    .reduce(
      (acc, bucket) => {
        acc.sales += bucket.sales;
        acc.orders += bucket.orders;
        acc.discount += bucket.discount;
        acc.discountOrders += bucket.discountOrders;
        return acc;
      },
      { sales: 0, orders: 0, discount: 0, discountOrders: 0 },
    );
}

async function getDashboardStats(): Promise<DashboardStats> {
  await connectDB();

  const now = new Date();
  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  const channelGroup = {
    $group: {
      _id: "$channel",
      sales: { $sum: "$total" },
      orders: { $sum: 1 },
      discount: { $sum: { $ifNull: ["$discount", 0] } },
      discountOrders: {
        $sum: { $cond: [{ $gt: ["$discount", 0] }, 1, 0] },
      },
    },
  } as const;

  const [orderFacet] = await Order.aggregate<{
    allTime: OrderChannelBucket[];
    currentMonth: OrderChannelBucket[];
    previousMonth: OrderChannelBucket[];
  }>([
    { $match: { status: { $ne: "cancelled" } } },
    {
      $facet: {
        allTime: [channelGroup],
        currentMonth: [
          { $match: { createdAt: { $gte: currentMonthStart } } },
          channelGroup,
        ],
        previousMonth: [
          {
            $match: {
              createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
            },
          },
          channelGroup,
        ],
      },
    },
  ]);

  const allTime = orderFacet?.allTime ?? [];
  const currentMonth = orderFacet?.currentMonth ?? [];
  const previousMonth = orderFacet?.previousMonth ?? [];

  const inStoreAll = sumOrderBuckets(allTime, "pos");
  const inStoreCurrent = sumOrderBuckets(currentMonth, "pos");
  const inStorePrevious = sumOrderBuckets(previousMonth, "pos");

  const onlineAll = sumOrderBuckets(allTime, "online");
  const onlineCurrent = sumOrderBuckets(currentMonth, "online");
  const onlinePrevious = sumOrderBuckets(previousMonth, "online");

  const ordersAll = inStoreAll.orders + onlineAll.orders;
  const ordersCurrent = inStoreCurrent.orders + onlineCurrent.orders;
  const ordersPrevious = inStorePrevious.orders + onlinePrevious.orders;

  const discountAll = inStoreAll.discount + onlineAll.discount;
  const discountCurrent = inStoreCurrent.discount + onlineCurrent.discount;
  const discountPrevious = inStorePrevious.discount + onlinePrevious.discount;
  const discountOrdersAll =
    inStoreAll.discountOrders + onlineAll.discountOrders;

  const refundMatch = {
    refundStatus: RETURN_REFUND_STATUS.SUCCEEDED,
  };

  const [refundFacet] = await ReturnRequest.aggregate<{
    allTime: { amount: number; cases: number }[];
    currentMonth: { amount: number }[];
    previousMonth: { amount: number }[];
  }>([
    { $match: refundMatch },
    {
      $facet: {
        allTime: [
          {
            $group: {
              _id: null,
              amount: { $sum: { $ifNull: ["$actualRefund.amount", 0] } },
              cases: { $sum: 1 },
            },
          },
        ],
        currentMonth: [
          { $match: { refundedAt: { $gte: currentMonthStart } } },
          {
            $group: {
              _id: null,
              amount: { $sum: { $ifNull: ["$actualRefund.amount", 0] } },
            },
          },
        ],
        previousMonth: [
          {
            $match: {
              refundedAt: { $gte: previousMonthStart, $lt: currentMonthStart },
            },
          },
          {
            $group: {
              _id: null,
              amount: { $sum: { $ifNull: ["$actualRefund.amount", 0] } },
            },
          },
        ],
      },
    },
  ]);

  const refundAll = refundFacet?.allTime?.[0] ?? { amount: 0, cases: 0 };
  const refundCurrent = refundFacet?.currentMonth?.[0]?.amount ?? 0;
  const refundPrevious = refundFacet?.previousMonth?.[0]?.amount ?? 0;

  const customerFilter = { roles: USER_ROLES.CUSTOMER };
  const [customersTotal, customersThisMonth, customersPrevMonth] =
    await Promise.all([
      User.countDocuments(customerFilter),
      User.countDocuments({
        ...customerFilter,
        createdAt: { $gte: currentMonthStart },
      }),
      User.countDocuments({
        ...customerFilter,
        createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
      }),
    ]);

  return {
    inStoreSales: {
      amount: inStoreAll.sales,
      count: inStoreAll.orders,
      ...buildTrend(inStoreCurrent.sales, inStorePrevious.sales),
    },
    websiteSales: {
      amount: onlineAll.sales,
      count: onlineAll.orders,
      ...buildTrend(onlineCurrent.sales, onlinePrevious.sales),
    },
    totalOrders: {
      amount: ordersAll,
      count: ordersAll,
      ...buildTrend(ordersCurrent, ordersPrevious),
    },
    discount: {
      amount: discountAll,
      count: discountOrdersAll,
      ...buildTrend(discountCurrent, discountPrevious),
    },
    refunds: {
      amount: refundAll.amount,
      count: refundAll.cases,
      ...buildTrend(refundCurrent, refundPrevious),
    },
    customers: {
      amount: customersTotal,
      count: customersThisMonth,
      ...buildTrend(customersThisMonth, customersPrevMonth),
    },
  };
}

/**
 * Aggregate every dataset the admin dashboard renders. Each query runs in
 * parallel; the visitors metric resolves to an "unconfigured" payload rather
 * than throwing when Plausible is unavailable.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [recentOrders, orderChart, latestProducts, visitorsChart, stats] =
    await Promise.all([
      getRecentOrders(),
      getOrderChartMetrics(),
      getLatestProducts(),
      getVisitorsChartMetrics(),
      getDashboardStats(),
    ]);

  return { recentOrders, orderChart, latestProducts, visitorsChart, stats };
}
