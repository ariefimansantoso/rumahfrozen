import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { getSettings } from "@/models/settings.model";
import { notFoundResponse } from "@/lib/api/response";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffOrderScopeFilter,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import { isValidObjectId } from "@/lib/api/validate";
import { format, addDays } from "date-fns";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import type { InvoiceData, InvoiceItem } from "@/lib/invoice-pdf";
import type { IOrder, OrderItem } from "@/types";
import type { ISettings } from "@/models/settings.model";
import { DEFAULT_CURRENCY, DEFAULT_STORE_NAME } from "@/config/branding.config";
import { withApi } from "@/lib/api/handler";

function mapPaymentStatus(status: string): InvoiceData["status"] {
  switch (status) {
    case "paid":
      return "Paid";
    case "refunded":
    case "partially_refunded":
      return "Cancelled";
    default:
      return "Pending";
  }
}

function buildInvoiceData(
  order: IOrder & { customerId?: { name?: string; email?: string } },
  settings: ISettings,
  customerName: string
): InvoiceData {
  const currency = settings.general?.defaultCurrency || DEFAULT_CURRENCY;
  const storeName = settings.general?.storeName || DEFAULT_STORE_NAME;
  const storeEmail = settings.general?.storeEmail || "";
  const storePhone = settings.general?.storePhone || "";
  const storeAddress = settings.general?.storeAddress || "";
  const logoUrl = settings.general?.logoUrl || "";

  const createdAt = new Date(order.createdAt);
  const dueDate = addDays(createdAt, 30);

  const items: InvoiceItem[] = order.items.map((item: OrderItem) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.price * item.quantity,
  }));

  const shipping = order.shippingAddress;

  return {
    invoiceNumber: order.orderNumber,
    status: mapPaymentStatus(order.paymentStatus),
    dateCreated: format(createdAt, "dd MMM yyyy"),
    dueDate: format(dueDate, "dd MMM yyyy"),
    from: {
      name: storeName,
      street: storeAddress,
      city: "",
      postalCode: "",
      country: "",
      phone: storePhone,
      email: storeEmail || undefined,
    },
    to: {
      name: customerName,
      street: shipping.street,
      city: shipping.city,
      state: shipping.state,
      postalCode: shipping.postalCode,
      country: shipping.country,
      phone: shipping.phone,
      email: order.customerId?.email || undefined,
    },
    items,
    subtotal: order.subtotal,
    shipping: order.shippingCost,
    discount: order.discount,
    tax: order.tax,
    total: order.total,
    currency,
    supportEmail: storeEmail || undefined,
    logoUrl: logoUrl || undefined,
    storeName,
  };
}

/**
 * GET /api/admin/orders/[id]/invoice
 * Download invoice PDF for any order (admin/staff)
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_ORDERS],
    );

    await connectDB();

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Order");

    const order = await Order.findOne(
      mergeScopeFilter({ _id: id }, buildStaffOrderScopeFilter(access.staffScope)),
    )
      .populate("customerId", "name email")
      .lean<IOrder & { customerId?: { name?: string; email?: string } }>();

    if (!order) {
      return notFoundResponse("Order");
    }

    const settings = await getSettings();
    const customerName =
      order.customerId?.name || order.shippingAddress?.fullName || "Customer";
    const invoiceData = buildInvoiceData(order, settings, customerName);
    const pdfBuffer = await generateInvoicePdf(invoiceData);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${order.orderNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  },
);
