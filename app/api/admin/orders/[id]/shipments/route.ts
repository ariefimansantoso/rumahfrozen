import { z } from "zod";
import { Order, Shipment } from "@/models";
import { getSettings } from "@/models/settings.model";
import { withApi } from "@/lib/api/handler";
import { validateBody, isValidObjectId } from "@/lib/api/validate";
import { notFoundResponse, successResponse } from "@/lib/api/response";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffOrderScopeFilter,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import { adminShipFrom, completeAddress } from "@/lib/shipments";

const ShipmentSchema = z.object({
  carrier: z.string().trim().max(100).optional(),
  service: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  subOrderId: z.string().optional(),
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

export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_ORDERS],
    );
    if (!isValidObjectId(params.id)) return notFoundResponse("Order");
    const order = await Order.findOne(
      mergeScopeFilter({ _id: params.id }, buildStaffOrderScopeFilter(access.staffScope)),
    ).select("_id").lean();
    if (!order) return notFoundResponse("Order");
    const shipments = await Shipment.find({ orderId: params.id })
      .sort({ createdAt: -1 })
      .lean();
    return successResponse(shipments);
  },
);

export const POST = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.EDIT_ORDERS, STAFF_PERMISSIONS.MANAGE_ORDERS],
    );
    if (!isValidObjectId(params.id)) return notFoundResponse("Order");
    const body = await validateBody(request, ShipmentSchema);
    const order = await Order.findOne(
      mergeScopeFilter({ _id: params.id }, buildStaffOrderScopeFilter(access.staffScope)),
    ).lean();
    if (!order) return notFoundResponse("Order");

    const subOrder = body.subOrderId
      ? order.subOrders?.find(
          (entry: { _id?: unknown }) => String(entry._id) === body.subOrderId,
        )
      : undefined;
    if (body.subOrderId && !subOrder) return notFoundResponse("Sub-order");

    const settings = await getSettings();
    const carrier = body.carrier || order.carrier || "Internal fulfillment";
    const trackingNumber =
      body.trackingNumber || subOrder?.trackingNumber || order.trackingNumber || order.orderNumber;
    const vendorId = subOrder?.vendorId;
    const shipment = await Shipment.findOneAndUpdate(
      {
        orderId: order._id,
        vendorId: vendorId || null,
        trackingNumber,
      },
      {
        $set: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          vendorId,
          subOrderId: subOrder?._id,
          carrier,
          service: body.service || order.shippingMethod?.name,
          trackingNumber,
          status: order.status === "shipped" ? "shipped" : "label_ready",
          source: "manual",
          shipFrom: adminShipFrom(settings),
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
