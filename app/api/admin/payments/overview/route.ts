import { getSettings, Order, PaymentTransaction, Payout } from "@/models";
import { successResponse } from "@/lib/api/response";
import { withApi } from "@/lib/api/handler";

export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:payments:overview", preset: "lenient" },
  },
  async () => {
    const [settings, orderAgg, txnAgg, payoutAgg, recentTransactions] =
      await Promise.all([
        getSettings(),
        Order.aggregate([
          {
            $facet: {
              paidRevenue: [
                { $match: { paymentStatus: "paid" } },
                { $group: { _id: null, total: { $sum: "$total" } } },
              ],
              pendingOrders: [
                {
                  $match: {
                    paymentStatus: { $in: ["pending", "partially_paid"] },
                  },
                },
                { $count: "count" },
              ],
              refundedOrders: [
                {
                  $match: {
                    paymentStatus: { $in: ["refunded", "partially_refunded"] },
                  },
                },
                { $count: "count" },
              ],
              methodBreakdown: [
                {
                  $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 },
                    total: { $sum: "$total" },
                  },
                },
              ],
            },
          },
        ]),
        PaymentTransaction.aggregate([
          {
            $facet: {
              byType: [
                { $group: { _id: "$type", count: { $sum: 1 }, total: { $sum: "$grossAmount" } } },
              ],
              byStatus: [
                { $group: { _id: "$status", count: { $sum: 1 } } },
              ],
              byProvider: [
                { $group: { _id: "$provider", count: { $sum: 1 }, total: { $sum: "$grossAmount" } } },
              ],
              refundTotal: [
                { $match: { type: "refund", status: "succeeded" } },
                { $group: { _id: null, total: { $sum: "$grossAmount" } } },
              ],
            },
          },
        ]),
        Payout.aggregate([
          {
            $facet: {
              pendingAmount: [
                { $match: { status: { $in: ["pending", "processing"] } } },
                { $group: { _id: null, total: { $sum: "$netAmount" } } },
              ],
              paidAmount: [
                { $match: { status: "paid" } },
                { $group: { _id: null, total: { $sum: "$netAmount" } } },
              ],
              byStatus: [
                { $group: { _id: "$status", count: { $sum: 1 } } },
              ],
            },
          },
        ]),
        PaymentTransaction.find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .select(
            "orderNumber type status provider paymentMethod grossAmount currency createdAt",
          )
          .lean(),
      ]);

    const orderMetrics = orderAgg?.[0] || {};
    const txnMetrics = txnAgg?.[0] || {};
    const payoutMetrics = payoutAgg?.[0] || {};

    const stripeEnabled = Boolean(settings.payment?.stripe?.enabled);
    const paypalEnabled = Boolean(settings.payment?.paypal?.enabled);
    const razorpayEnabled = Boolean(settings.payment?.razorpay?.enabled);
    const paystackEnabled = Boolean(settings.payment?.paystack?.enabled);
    const codEnabled = settings.payment?.cod?.enabled ?? true;

    return successResponse({
      totals: {
        paidRevenue: Number(orderMetrics.paidRevenue?.[0]?.total || 0),
        refundedAmount: Number(txnMetrics.refundTotal?.[0]?.total || 0),
        pendingPayments: Number(orderMetrics.pendingOrders?.[0]?.count || 0),
        refundedOrders: Number(orderMetrics.refundedOrders?.[0]?.count || 0),
        pendingPayoutAmount: Number(payoutMetrics.pendingAmount?.[0]?.total || 0),
        paidPayoutAmount: Number(payoutMetrics.paidAmount?.[0]?.total || 0),
      },
      breakdowns: {
        paymentMethods: orderMetrics.methodBreakdown || [],
        transactionsByType: txnMetrics.byType || [],
        transactionsByStatus: txnMetrics.byStatus || [],
        transactionsByProvider: txnMetrics.byProvider || [],
        payoutsByStatus: payoutMetrics.byStatus || [],
      },
      gatewayHealth: {
        stripe: {
          enabled: stripeEnabled,
          configured: stripeEnabled && Boolean(settings.payment?.stripe?.secretKey),
        },
        paypal: {
          enabled: paypalEnabled,
          configured:
            paypalEnabled &&
            Boolean(
              settings.payment?.paypal?.clientId &&
                settings.payment?.paypal?.clientSecret,
            ),
        },
        razorpay: {
          enabled: razorpayEnabled,
          configured:
            razorpayEnabled &&
            Boolean(
              (settings.payment?.razorpay?.keyId ||
                process.env.RAZORPAY_KEY_ID ||
                process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) &&
                (settings.payment?.razorpay?.keySecret ||
                  process.env.RAZORPAY_KEY_SECRET),
            ),
        },
        paystack: {
          enabled: paystackEnabled,
          configured:
            paystackEnabled &&
            Boolean(
              settings.payment?.paystack?.secretKey ||
                process.env.PAYSTACK_SECRET_KEY,
            ),
        },
        cod: {
          enabled: codEnabled,
        },
      },
      recentTransactions,
    });
  },
);
