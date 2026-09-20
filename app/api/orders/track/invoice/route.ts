import { format, addDays } from "date-fns";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { getSettings } from "@/models/settings.model";
import { ValidationError } from "@/lib/api/errors";
import { rateLimitByIP } from "@/lib/api/rate-limit-middleware";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import type { InvoiceData, InvoiceItem } from "@/lib/invoice-pdf";
import type { ISettings } from "@/models/settings.model";
import { DEFAULT_CURRENCY, DEFAULT_STORE_NAME } from "@/config/branding.config";
import { withApi } from "@/lib/api/handler";

type InvoiceCustomer = {
  name?: string;
  email?: string;
  phone?: string;
};

type InvoiceOrder = {
  orderNumber: string;
  customerId?: InvoiceCustomer;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  shippingAddress: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  paymentStatus: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: Date;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCustomerName(order: InvoiceOrder) {
  const shipping = order.shippingAddress;
  const addressName =
    shipping.fullName ||
    [shipping.firstName, shipping.lastName].filter(Boolean).join(" ");
  return addressName || order.customerId?.name || "Customer";
}

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
  order: InvoiceOrder,
  settings: ISettings,
): InvoiceData {
  const currency = settings.general?.defaultCurrency || DEFAULT_CURRENCY;
  const storeName = settings.general?.storeName || DEFAULT_STORE_NAME;
  const storeEmail = settings.general?.storeEmail || "";
  const storePhone = settings.general?.storePhone || "";
  const storeAddress = settings.general?.storeAddress || "";
  const logoUrl = settings.general?.logoUrl || "";
  const createdAt = new Date(order.createdAt);
  const dueDate = addDays(createdAt, 30);

  const items: InvoiceItem[] = order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.price * item.quantity,
  }));

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
      name: getCustomerName(order),
      street: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
      phone: order.shippingAddress.phone,
      email: order.customerId?.email,
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

export const POST = withApi(
  {},
  async ({ request }) => {
    // Public, unauthenticated endpoint guarded only by email/phone match.
    // Throttle by IP to prevent brute-forcing contact details / PDF scraping.
    rateLimitByIP(request, "strict");

    const body = await request.json();
    const orderNumber = normalizeText(body.orderNumber || body.orderId);
    const identifier = normalizeText(body.identifier);

    if (!orderNumber || !identifier) {
      throw new ValidationError("Order number and email or phone are required");
    }

    await connectDB();

    const order = await Order.findOne({
      orderNumber: { $regex: `^${escapeRegex(orderNumber)}$`, $options: "i" },
    })
      .populate("customerId", "name email phone")
      .lean<InvoiceOrder | null>();

    if (!order) {
      return new Response("Order not found", { status: 404 });
    }

    const identifierLower = identifier.toLowerCase();
    const identifierPhone = normalizePhone(identifier);
    const emailMatches = order.customerId?.email?.toLowerCase() === identifierLower;
    const phoneMatches = [order.customerId?.phone, order.shippingAddress.phone]
      .filter(Boolean)
      .map((phone) => normalizePhone(phone!))
      .some((phone) => phone === identifierPhone);

    if (!emailMatches && !phoneMatches) {
      return new Response("Order not found", { status: 404 });
    }

    const settings = await getSettings();
    const invoiceData = buildInvoiceData(order, settings);
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
