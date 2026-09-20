import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ValidationError } from "@/lib/api/errors";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import { validateBody, isValidObjectId } from "@/lib/api/validate";
import { CreateReturnRequestSchema } from "@/lib/validations";
import { Order, Product, ReturnRequest } from "@/models";
import {
  OPEN_RETURN_STATUSES,
  RETURN_REFUND_STATUS,
  RETURN_STATUS,
  roundMoney,
} from "@/lib/returns";
import { getNextReturnNumber } from "@/lib/return-number";
import { getSettings } from "@/models/settings.model";
import { notifyReturnRequestSubmitted } from "@/lib/notifications";
import { withApi } from "@/lib/api/handler";

const RETURN_WINDOW_DAYS = 30;

type OrderItemLike = {
  productId: unknown;
  variantId?: unknown;
  vendorId: unknown;
  name?: string;
  sku?: string;
  price?: number;
  quantity?: number;
  image?: string;
};

type SelectedReturnItem = {
  requestItem: { orderItemIndex: number; quantity: number };
  orderItem: OrderItemLike;
  orderedQuantity: number;
  ownerType: "admin" | "vendor";
  ownerVendorId?: string;
};

function getDateBasis(order: { deliveredAt?: Date; shippedAt?: Date; createdAt?: Date }) {
  return order.deliveredAt || order.shippedAt || order.createdAt || new Date();
}

function assertReturnEligible(order: {
  status?: string;
  paymentStatus?: string;
  deliveredAt?: Date;
  shippedAt?: Date;
  createdAt?: Date;
}) {
  if (order.status !== "delivered") {
    throw new ValidationError("Only delivered orders can be returned");
  }
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    throw new ValidationError("Only paid orders can be returned");
  }

  const basis = getDateBasis(order);
  const elapsedMs = Date.now() - new Date(basis).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  if (elapsedDays > RETURN_WINDOW_DAYS) {
    throw new ValidationError("The 30-day return window has closed for this order");
  }
}

function buildRequestedByIndex(
  returns: Array<{ items?: Array<{ orderItemIndex?: number; quantityRequested?: number }> }>,
) {
  const map = new Map<number, number>();
  for (const request of returns) {
    for (const item of request.items || []) {
      const index = Number(item.orderItemIndex);
      map.set(index, (map.get(index) || 0) + Number(item.quantityRequested || 0));
    }
  }
  return map;
}

export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 10)));
    const orderId = request.nextUrl.searchParams.get("orderId");
    const query: Record<string, unknown> = { customerId: session.user.id };

    if (orderId) {
      if (!isValidObjectId(orderId)) {
        throw new ValidationError("Invalid order ID");
      }
      query.orderId = orderId;
    }

    const skip = (page - 1) * limit;
    const [returns, total] = await Promise.all([
      ReturnRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ReturnRequest.countDocuments(query),
    ]);

    return paginatedResponse(returns, page, limit, total);
  },
);

export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const body = await validateBody(request, CreateReturnRequestSchema);

    await connectDB();

    const order = await Order.findOne({
      _id: body.orderId,
      customerId: session.user.id,
    }).lean();
    if (!order) {
      throw new ValidationError("Order not found");
    }

    assertReturnEligible(order);

    const existingOpenReturns = await ReturnRequest.find({
      orderId: order._id,
      status: { $in: OPEN_RETURN_STATUSES },
    })
      .select("items")
      .lean();
    const alreadyRequestedByIndex = buildRequestedByIndex(existingOpenReturns);
    const orderItems = (order.items || []) as OrderItemLike[];
    const productIds = Array.from(
      new Set(
        body.items
          .map((requestItem) => String(orderItems[requestItem.orderItemIndex]?.productId || ""))
          .filter(Boolean),
      ),
    );
    const products = await Product.find({ _id: { $in: productIds } })
      .select("_id productSource vendorId")
      .lean();
    const productById = new Map(products.map((product) => [String(product._id), product]));

    const selectedItems: SelectedReturnItem[] = body.items.map((requestItem) => {
      const orderItem = orderItems[requestItem.orderItemIndex];
      if (!orderItem) {
        throw new ValidationError("Selected return item was not found on the order");
      }

      const orderedQuantity = Number(orderItem.quantity || 0);
      const alreadyRequested =
        alreadyRequestedByIndex.get(requestItem.orderItemIndex) || 0;
      const availableQuantity = orderedQuantity - alreadyRequested;
      if (requestItem.quantity > availableQuantity) {
        throw new ValidationError(
          `"${orderItem.name || "Item"}" only has ${Math.max(availableQuantity, 0)} returnable quantity left`,
        );
      }

      const product = productById.get(String(orderItem.productId));
      const ownerType = product?.productSource === "vendor" ? "vendor" : "admin";
      const ownerVendorId =
        ownerType === "vendor" ? String(product?.vendorId || orderItem.vendorId) : undefined;

      return { requestItem, orderItem, orderedQuantity, ownerType, ownerVendorId };
    });

    const subtotal = Number(order.subtotal || 0);
    const settings = await getSettings();
    const currency = settings.general?.defaultCurrency || "USD";
    const groupedItems = new Map<string, SelectedReturnItem[]>();
    for (const item of selectedItems) {
      const key =
        item.ownerType === "vendor"
          ? `vendor:${item.ownerVendorId}`
          : "admin";
      if (!groupedItems.has(key)) groupedItems.set(key, []);
      groupedItems.get(key)!.push(item);
    }

    const createdRequests = [];
    const notificationJobs: Promise<unknown>[] = [];
    for (const [key, groupItems] of groupedItems.entries()) {
      const ownerType = key.startsWith("vendor:") ? "vendor" : "admin";
      const ownerVendorId = ownerType === "vendor" ? key.slice("vendor:".length) : undefined;
      const itemsSubtotal = roundMoney(
        groupItems.reduce(
          (sum, item) =>
            sum + Number(item.orderItem.price || 0) * item.requestItem.quantity,
          0,
        ),
      );
      const ratio = subtotal > 0 ? Math.min(1, itemsSubtotal / subtotal) : 0;
      const discountAdjustment = roundMoney(Number(order.discount || 0) * ratio);
      const tax = roundMoney(Number(order.tax || 0) * ratio);
      const total = Math.max(0, roundMoney(itemsSubtotal + tax - discountAdjustment));
      const vendorIds = Array.from(
        new Set(groupItems.map((item) => String(item.orderItem.vendorId))),
      ).map((id) => new Types.ObjectId(id));

      const returnRequest = await ReturnRequest.create({
        returnNumber: await getNextReturnNumber(),
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        ownerType,
        ownerVendorId: ownerVendorId ? new Types.ObjectId(ownerVendorId) : undefined,
        vendorIds,
        status: RETURN_STATUS.REQUESTED,
        refundStatus: RETURN_REFUND_STATUS.PENDING,
        reason: body.reason,
        customerNote: body.customerNote,
        requestedAt: new Date(),
        createdBy: session.user.id,
        items: groupItems.map(({ requestItem, orderItem, orderedQuantity }) => ({
          productId: orderItem.productId,
          variantId: orderItem.variantId,
          vendorId: orderItem.vendorId,
          orderItemIndex: requestItem.orderItemIndex,
          name: orderItem.name || "Item",
          sku: orderItem.sku || "",
          quantityOrdered: orderedQuantity,
          quantityRequested: requestItem.quantity,
          quantityApproved: requestItem.quantity,
          quantityReceived: 0,
          unitPrice: Number(orderItem.price || 0),
          image: orderItem.image,
        })),
        estimatedRefund: {
          itemsSubtotal,
          shipping: 0,
          tax,
          discountAdjustment,
          restockingFee: 0,
          returnShippingFee: 0,
          total,
          currency,
        },
      });
      createdRequests.push(returnRequest);
      notificationJobs.push(
        notifyReturnRequestSubmitted(returnRequest.toObject(), settings),
      );
    }

    await Promise.allSettled(notificationJobs);

    return createdResponse(
      createdRequests.length === 1 ? createdRequests[0] : createdRequests,
      "Return request submitted",
    );
  },
);
