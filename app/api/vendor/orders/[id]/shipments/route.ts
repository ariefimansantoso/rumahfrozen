import { z } from "zod";
import { Order, Shipment } from "@/models";
import { withApi } from "@/lib/api/handler";
import { validateBody, isValidObjectId } from "@/lib/api/validate";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import { AuthorizationError } from "@/lib/api/errors";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { completeAddress, vendorShipFrom } from "@/lib/shipments";
import type { IUser, IVendor } from "@/types";

const ShipmentSchema = z.object({
  carrier: z.string().trim().max(100).optional(),
  service: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  parcel: z
    .object({
      weight: z.number().min(0).optional(),
      weightUnit: z.enum(["g", "kg", "lb", "oz"]).optional(),
      length: z.number().min(0).optional(),
      width: z.number().min(0).optional(),
      height: z.number().min(0).optional(),
      dimensionUnit: z.enum(["cm", "in"]).optional(),
    })
    .optional(),
});

async function vendorAccess(session: { user: { id: string; role: string } }, permission: string) {
  const user = session.user as unknown as IUser;
  const allowed = await hasVendorPermission(
    user,
    permission as (typeof VENDOR_PERMISSIONS)[keyof typeof VENDOR_PERMISSIONS],
  );
  if (!allowed && !isAdmin(user)) throw new AuthorizationError();
  return requireApprovedVendorByUserId(session.user.id);
}

export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    const vendor = await vendorAccess(session, VENDOR_PERMISSIONS.VIEW_ORDERS);
    if (!isValidObjectId(params.id)) return notFoundResponse("Order");
    const order = await Order.findOne({
      _id: params.id,
      "subOrders.vendorId": vendor._id,
    }).select("_id").lean();
    if (!order) return notFoundResponse("Order");
    const shipments = await Shipment.find({
      orderId: params.id,
      vendorId: vendor._id,
    }).sort({ createdAt: -1 }).lean();
    return successResponse(shipments);
  },
);

export const POST = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const vendor = await vendorAccess(session, VENDOR_PERMISSIONS.EDIT_ORDERS);
    if (!isValidObjectId(params.id)) return notFoundResponse("Order");
    const body = await validateBody(request, ShipmentSchema);
    const order = await Order.findOne({
      _id: params.id,
      "subOrders.vendorId": vendor._id,
    }).lean();
    if (!order) return notFoundResponse("Order");
    const subOrder = order.subOrders.find(
      (entry: { vendorId?: unknown }) =>
        String(entry.vendorId) === String(vendor._id),
    );
    if (!subOrder) return notFoundResponse("Sub-order");
    const carrier = body.carrier || "Internal fulfillment";
    const trackingNumber =
      body.trackingNumber || subOrder.trackingNumber || order.orderNumber;
    const shipment = await Shipment.findOneAndUpdate(
      { orderId: order._id, vendorId: vendor._id, trackingNumber },
      {
        $set: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          vendorId: vendor._id,
          subOrderId: subOrder._id,
          carrier,
          service: body.service || subOrder.shippingMethod?.name,
          trackingNumber,
          status: subOrder.status === "shipped" ? "shipped" : "label_ready",
          source: "manual",
          shipFrom: vendorShipFrom(vendor as unknown as IVendor),
          shipTo: completeAddress(order.shippingAddress, "Customer"),
          parcel: body.parcel || {},
          label: { source: "internal", format: "pdf" },
          createdBy: session.user.id,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    return successResponse(shipment);
  },
);
