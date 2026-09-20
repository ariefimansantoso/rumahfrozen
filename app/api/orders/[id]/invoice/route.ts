import { mongoose } from "@/lib/db";
import { Order } from "@/models";
import { getSettings } from "@/models/settings.model";
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
  order: IOrder & { customer?: { name: string; email: string } },
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
      email: order.customer?.email || undefined,
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
 * GET /api/orders/[id]/invoice
 * Download invoice PDF for an order
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ params, session }) => {
    const { id } = params;

    // Support lookup by ObjectId or orderNumber
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId
      ? { _id: id, customerId: session.user.id }
      : { orderNumber: id, customerId: session.user.id };

    const order = await Order.findOne(query)
      .populate("customer", "name email")
      .lean<IOrder & { customer?: { name: string; email: string } }>();

    if (!order) {
      return new Response("Order not found", { status: 404 });
    }

    const settings = await getSettings();
    const customerName = order.customer?.name || session.user.name || "Customer";
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
