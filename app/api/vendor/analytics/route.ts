import { connectDB } from "@/lib/db";
import { Order, Product } from "@/models";
import { successResponse } from "@/lib/api/response";
import { NotFoundError } from "@/lib/api/errors";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getSettings } from "@/models/settings.model";
import { validateQuery } from "@/lib/api/validate";
import { z } from "zod";
import { withApi } from "@/lib/api/handler";

const VendorAnalyticsQuerySchema = z.object({
  period: z.coerce.number().min(1).max(365).default(30),
});

/**
 * GET /api/vendor/analytics
 * Get vendor dashboard analytics
 */
export const GET = withApi(
  {
    auth: "user",
    rateLimit: { action: "vendor:analytics", preset: "lenient" },
  },
  async ({ request, session }) => {
    const { period } = validateQuery(request, VendorAnalyticsQuerySchema);

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    // Get vendor
    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const vendorId = vendor._id;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get vendor stats
    const [
      revenueStats,
      totalProducts,
      activeProducts,
      pendingOrders,
      recentOrders,
      salesByDay,
      topProducts,
      productStats,
    ] = await Promise.all([
      // Revenue from sub-orders
      Order.aggregate([
        { $unwind: "$subOrders" },
        {
          $match: {
            "subOrders.vendorId": vendorId,
            status: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$subOrders.subtotal" },
            totalOrders: { $sum: 1 },
            totalCommission: { $sum: "$subOrders.commission" },
          },
        },
      ]),
      // Total products
      Product.countDocuments({ vendorId }),
      // Active products
      Product.countDocuments({ vendorId, status: "published" }),
      // Pending orders
      Order.countDocuments({
        "subOrders.vendorId": vendorId,
        "subOrders.status": "pending",
      }),
      // Recent orders
      Order.find({ "subOrders.vendorId": vendorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber total status createdAt items subOrders")
        .lean(),
      // Sales by day
      Order.aggregate([
        { $unwind: "$subOrders" },
        {
          $match: {
            "subOrders.vendorId": vendorId,
            createdAt: { $gte: startDate },
            status: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$subOrders.subtotal" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Top selling products
      Order.aggregate([
        { $unwind: "$items" },
        {
          $match: {
            "items.vendorId": vendorId,
            status: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: "$items.productId",
            name: { $first: "$items.name" },
            totalSold: { $sum: "$items.quantity" },
            revenue: {
              $sum: { $multiply: ["$items.price", "$items.quantity"] },
            },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
      ]),
      // Products by status
      Product.aggregate([
        { $match: { vendorId: vendorId } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = revenueStats[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      totalCommission: 0,
    };

    type VendorOrderRow = {
      orderNumber: string;
      status: string;
      createdAt: Date;
      subOrders?: Array<{
        vendorId?: { toString: () => string };
        subtotal?: number;
        status?: string;
      }>;
    };

    type ProductStatRow = {
      _id: string;
      count: number;
    };

    // Filter recent orders to show only vendor's items
    const filteredRecentOrders = (recentOrders as VendorOrderRow[]).map((order) => {
      const vendorSubOrder = order.subOrders?.find(
        (sub) => sub.vendorId?.toString() === vendorId.toString(),
      );
      return {
        orderNumber: order.orderNumber,
        total: vendorSubOrder?.subtotal || 0,
        status: vendorSubOrder?.status || order.status,
        createdAt: order.createdAt,
      };
    });

    return successResponse({
      stats: {
        totalRevenue: stats.totalRevenue,
        netRevenue: stats.totalRevenue - stats.totalCommission,
        totalOrders: stats.totalOrders,
        totalCommission: stats.totalCommission,
        totalProducts,
        activeProducts,
        pendingOrders,
      },
      recentOrders: filteredRecentOrders,
      salesByDay,
      topProducts,
      productStats: (productStats as ProductStatRow[]).reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
    });
  },
);
