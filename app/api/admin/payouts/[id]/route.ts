import { connectDB } from "@/lib/db";
import { getSettings, Order, Payout } from "@/models";
import { ValidationError } from "@/lib/api/errors";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import { isValidObjectId } from "@/lib/api/validate";
import { withApi } from "@/lib/api/handler";

export const GET = withApi<{ id: string }>(
  {
    auth: "admin",
    rateLimit: { action: "admin:payouts:read", preset: "lenient" },
  },
  async ({ params }) => {
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Payout");

    await connectDB();
    const payout = await Payout.findById(id)
      .populate("vendorId", "storeName slug userId")
      .lean();
    if (!payout) return notFoundResponse("Payout");

    const orderRows = await Order.find({
      _id: { $in: payout.orderIds || [] },
    })
      .select("orderNumber createdAt total paymentStatus status subOrders")
      .sort({ createdAt: -1 })
      .lean();

    return successResponse({
      payout,
      orders: orderRows,
    });
  },
);

export const PUT = withApi<{ id: string }>(
  {
    auth: "admin",
    rateLimit: { action: "admin:payouts:update", preset: "moderate" },
  },
  async ({ request, params, session }) => {
    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Payout");

    const body = (await request.json()) as {
      status?: string;
      note?: string;
    };
    const nextStatus = String(body.status || "").trim().toLowerCase();
    const allowed = new Set(["pending", "processing", "paid", "failed", "cancelled"]);
    if (!allowed.has(nextStatus)) {
      throw new ValidationError("Invalid payout status");
    }

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) {
      throw new ValidationError("Payouts are available only in multi-vendor mode");
    }

    const payout = await Payout.findById(id);
    if (!payout) return notFoundResponse("Payout");

    const currentStatus = String(payout.status || "pending");
    const allowedTransitions: Record<string, Set<string>> = {
      pending: new Set(["pending", "processing", "paid", "cancelled"]),
      processing: new Set(["processing", "paid", "failed", "cancelled"]),
      paid: new Set(["paid"]),
      failed: new Set(["failed"]),
      cancelled: new Set(["cancelled"]),
    };
    if (!allowedTransitions[currentStatus]?.has(nextStatus)) {
      throw new ValidationError(
        `Cannot transition payout from "${currentStatus}" to "${nextStatus}"`,
      );
    }

    payout.status = nextStatus;
    if (typeof body.note === "string") payout.note = body.note.trim() || undefined;

    if (nextStatus === "paid") {
      payout.paidAt = new Date();
      payout.paidBy = session.user.id;
      await Order.updateMany(
        { _id: { $in: payout.orderIds || [] } },
        {
          $set: {
            "subOrders.$[sub].payoutStatus": "paid",
            "subOrders.$[sub].payoutDate": new Date(),
          },
        },
        {
          arrayFilters: [{ "sub.payoutId": payout._id }],
        },
      );
    } else if (nextStatus === "cancelled" || nextStatus === "failed") {
      payout.paidAt = undefined;
      payout.paidBy = undefined;
      await Order.updateMany(
        { _id: { $in: payout.orderIds || [] } },
        {
          $set: {
            "subOrders.$[sub].payoutStatus": "unpaid",
          },
          $unset: {
            "subOrders.$[sub].payoutId": "",
            "subOrders.$[sub].payoutDate": "",
          },
        },
        {
          arrayFilters: [{ "sub.payoutId": payout._id }],
        },
      );
    }

    await payout.save();

    return successResponse({ payout });
  },
);
