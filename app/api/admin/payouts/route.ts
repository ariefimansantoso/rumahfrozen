import { connectDB, mongoose } from "@/lib/db";
import { getSettings, Order, PaymentTransaction, Payout, Vendor } from "@/models";
import { ValidationError } from "@/lib/api/errors";
import { paginatedResponse, successResponse } from "@/lib/api/response";
import { getExternalVendorFilter, isDefaultVendorRecord } from "@/lib/multi-vendor";
import { DEFAULT_MIN_WITHDRAWAL_AMOUNT } from "@/lib/order-settings";
import { withApi } from "@/lib/api/handler";

function buildPayoutNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PAYOUT-${ts}-${rand}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:payouts:list", preset: "lenient" },
  },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const status = (searchParams.get("status") || "all").trim().toLowerCase();
    const search = (searchParams.get("search") || "").trim();
    const vendorId = (searchParams.get("vendorId") || "").trim();
    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) {
      throw new ValidationError("Payouts are available only in multi-vendor mode");
    }

    const query: Record<string, unknown> = {};
    if (status !== "all") query.status = status;
    if (vendorId) query.vendorId = vendorId;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.payoutNumber = { $regex: escaped, $options: "i" };
    }

    const skip = (page - 1) * limit;
    const allowedSortFields = new Set([
      "createdAt",
      "payoutNumber",
      "status",
      "netAmount",
      "periodStart",
      "periodEnd",
    ]);
    const effectiveSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [effectiveSortBy]: sortDirection };

    const [rows, total] = await Promise.all([
      Payout.find(query)
        .populate("vendorId", "storeName slug")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Payout.countDocuments(query),
    ]);

    return paginatedResponse(rows as Record<string, unknown>[], page, limit, total);
  },
);

export const POST = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:payouts:create", preset: "moderate" },
  },
  async ({ request, session }) => {
    const body = (await request.json()) as {
      vendorId?: string;
      periodStart?: string;
      periodEnd?: string;
      note?: string;
    };

    const vendorId = String(body.vendorId || "").trim();
    if (!mongoose.isValidObjectId(vendorId)) {
      throw new ValidationError("Valid vendorId is required");
    }

    const periodStart = body.periodStart ? new Date(body.periodStart) : null;
    const periodEnd = body.periodEnd ? new Date(body.periodEnd) : null;
    if (!periodStart || Number.isNaN(periodStart.getTime())) {
      throw new ValidationError("Valid periodStart is required");
    }
    if (!periodEnd || Number.isNaN(periodEnd.getTime())) {
      throw new ValidationError("Valid periodEnd is required");
    }
    if (periodEnd < periodStart) {
      throw new ValidationError("periodEnd must be after periodStart");
    }

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) {
      throw new ValidationError("Payouts are available only in multi-vendor mode");
    }

    const vendor = await Vendor.findOne({
      ...getExternalVendorFilter(),
      _id: vendorId,
    })
      .select("storeName slug isDefault")
      .lean();
    if (!vendor || isDefaultVendorRecord(vendor)) {
      throw new ValidationError("Vendor not found");
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    const eligibleOrders = await Order.find({
      createdAt: { $gte: periodStart, $lte: periodEnd },
      status: "delivered",
      paymentStatus: { $in: ["paid", "partially_refunded"] },
      subOrders: {
        $elemMatch: {
          vendorId: vendorObjectId,
          status: "delivered",
          payoutStatus: { $nin: ["scheduled", "paid"] },
        },
      },
    })
      .select("_id")
      .lean();

    const eligibleOrderIds = eligibleOrders.map((order) => String(order._id));
    if (!eligibleOrderIds.length) {
      throw new ValidationError("No eligible orders found for payout");
    }

    const payout = await Payout.create({
      payoutNumber: buildPayoutNumber(),
      vendorId,
      periodStart,
      periodEnd,
      currency: (settings.general?.defaultCurrency || "USD").toUpperCase(),
      orderIds: [],
      grossSales: 0,
      commissionAmount: 0,
      netAmount: 0,
      status: "pending",
      note: typeof body.note === "string" ? body.note.trim() : undefined,
      createdBy: session.user.id,
    });

    const claimResult = await Order.updateMany(
      { _id: { $in: eligibleOrderIds } },
      {
        $set: {
          "subOrders.$[sub].payoutStatus": "scheduled",
          "subOrders.$[sub].payoutId": payout._id,
        },
      },
      {
        arrayFilters: [
          {
            "sub.vendorId": vendorObjectId,
            "sub.status": "delivered",
            "sub.payoutStatus": { $nin: ["scheduled", "paid"] },
          },
        ],
      },
    );

    if ((claimResult.modifiedCount ?? 0) === 0) {
      await Payout.deleteOne({ _id: payout._id });
      throw new ValidationError("No eligible orders found for payout");
    }

    const claimedOrders = await Order.find({
      _id: { $in: eligibleOrderIds },
      subOrders: {
        $elemMatch: {
          vendorId: vendorObjectId,
          payoutId: payout._id,
        },
      },
    })
      .select("total subOrders")
      .lean();

    const claimedOrderObjectIds = claimedOrders.map(
      (order) => new mongoose.Types.ObjectId(String(order._id)),
    );
    const refundRows = claimedOrderObjectIds.length
      ? await PaymentTransaction.aggregate([
          {
            $match: {
              orderId: { $in: claimedOrderObjectIds },
              type: "refund",
              status: "succeeded",
            },
          },
          {
            $group: {
              _id: "$orderId",
              totalRefunded: { $sum: "$grossAmount" },
            },
          },
        ])
      : [];
    const refundByOrderId = new Map(
      refundRows.map((row: { _id: { toString: () => string }; totalRefunded?: number }) => [
        row._id.toString(),
        Number(row.totalRefunded || 0),
      ]),
    );

    let grossSales = 0;
    let commissionAmount = 0;
    let netAmount = 0;
    const claimedOrderIds: string[] = [];

    for (const order of claimedOrders) {
      const orderId = String(order._id);
      const orderTotal = Number((order as { total?: number }).total || 0);
      const totalRefunded = refundByOrderId.get(orderId) || 0;
      const refundRatio =
        orderTotal > 0 ? Math.min(1, Math.max(0, totalRefunded / orderTotal)) : 0;
      const payableRatio = 1 - refundRatio;
      let hasPayableSubOrder = false;

      for (const sub of order.subOrders || []) {
        if (
          String(sub.vendorId) !== vendorId ||
          String(sub.payoutId) !== String(payout._id) ||
          sub.status !== "delivered"
        ) {
          continue;
        }

        const subGross = roundMoney(Number(sub.subtotal || 0) * payableRatio);
        const subCommission = roundMoney(Number(sub.commission || 0) * payableRatio);
        const subNet = roundMoney(Number(sub.vendorEarnings || 0) * payableRatio);

        grossSales += subGross;
        commissionAmount += subCommission;
        netAmount += subNet;
        hasPayableSubOrder = true;
      }

      if (hasPayableSubOrder) claimedOrderIds.push(orderId);
    }

    if (!claimedOrderIds.length) {
      await Order.updateMany(
        { _id: { $in: eligibleOrderIds } },
        {
          $set: {
            "subOrders.$[sub].payoutStatus": "unpaid",
          },
          $unset: {
            "subOrders.$[sub].payoutId": "",
          },
        },
        {
          arrayFilters: [{ "sub.payoutId": payout._id }],
        },
      );
      await Payout.deleteOne({ _id: payout._id });
      throw new ValidationError("No eligible orders found for payout");
    }

    const roundedNetAmount = roundMoney(netAmount);
    const minWithdrawalAmount = Number(
      settings.orders?.commission?.minWithdrawalAmount ??
        DEFAULT_MIN_WITHDRAWAL_AMOUNT,
    );
    if (roundedNetAmount < minWithdrawalAmount) {
      await Order.updateMany(
        { _id: { $in: eligibleOrderIds } },
        {
          $set: {
            "subOrders.$[sub].payoutStatus": "unpaid",
          },
          $unset: {
            "subOrders.$[sub].payoutId": "",
          },
        },
        {
          arrayFilters: [{ "sub.payoutId": payout._id }],
        },
      );
      await Payout.deleteOne({ _id: payout._id });
      const currency = (settings.general?.defaultCurrency || "USD").toUpperCase();
      throw new ValidationError(
        `Payout must be at least ${currency} ${minWithdrawalAmount.toFixed(2)}`,
      );
    }

    payout.orderIds = claimedOrderIds;
    payout.grossSales = roundMoney(grossSales);
    payout.commissionAmount = roundMoney(commissionAmount);
    payout.netAmount = roundedNetAmount;
    await payout.save();

    return successResponse(
      { payoutId: String(payout._id), payoutNumber: payout.payoutNumber },
      "Payout created",
      201,
    );
  },
);
