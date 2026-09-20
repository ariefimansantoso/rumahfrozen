/**
 * Order Email Notifications
 * Functions to send order-related emails
 */

import { sendEmail } from "./email";
import type { ISettings } from "@/models/settings.model";
import {
  orderConfirmationTemplate,
  orderStatusUpdateTemplate,
  vendorNewOrderTemplate,
} from "./email-templates";
import { generateInvoicePdf } from "./invoice-pdf";
import type { InvoiceData } from "./invoice-pdf";
import { format, addDays } from "date-fns";
import { DEFAULT_CURRENCY, DEFAULT_STORE_NAME } from "@/config/branding.config";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface OrderData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  discount?: number;
  total: number;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
}

/**
 * Build invoice data from order and settings
 */
function buildInvoiceFromOrder(
  order: OrderData,
  settings?: ISettings
): InvoiceData {
  const currency = settings?.general?.defaultCurrency || DEFAULT_CURRENCY;
  const storeName = settings?.general?.storeName || DEFAULT_STORE_NAME;
  const storeEmail = settings?.general?.storeEmail || "";
  const storePhone = settings?.general?.storePhone || "";
  const storeAddress = settings?.general?.storeAddress || "";
  const logoUrl = settings?.general?.logoUrl || "";

  const now = new Date();

  return {
    invoiceNumber: order.orderNumber,
    status: "Paid",
    dateCreated: format(now, "dd MMM yyyy"),
    dueDate: format(addDays(now, 30), "dd MMM yyyy"),
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
      name: order.customerName || order.shippingAddress.fullName || "",
      street: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
      phone: order.shippingAddress.phone,
      email: order.customerEmail || undefined,
    },
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.price * item.quantity,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount || 0,
    tax: order.tax,
    total: order.total,
    currency,
    supportEmail: storeEmail || undefined,
    logoUrl: logoUrl || undefined,
    storeName,
  };
}

/**
 * Send order confirmation email to customer with invoice PDF attached
 */
export async function sendOrderConfirmationEmail(
  order: OrderData,
  settings?: ISettings
): Promise<boolean> {
  const html = orderConfirmationTemplate(order, {
    currency: settings?.general?.defaultCurrency,
    storeName: settings?.general?.storeName,
    logoUrl: settings?.general?.logoUrl,
  });

  // Generate invoice PDF attachment
  let attachments;
  try {
    const invoiceData = buildInvoiceFromOrder(order, settings);
    const pdfBuffer = await generateInvoicePdf(invoiceData);
    attachments = [
      {
        filename: `invoice-${order.orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  } catch (error) {
    console.error("Failed to generate invoice PDF for email:", error);
    // Send email without attachment if PDF generation fails
  }

  return sendEmail({
    to: order.customerEmail,
    subject: `Order Confirmed - ${order.orderNumber}`,
    html,
    settings,
    attachments,
  });
}

/**
 * Send order status update email to customer
 */
export async function sendOrderStatusUpdateEmail(
  order: OrderData & { newStatus: string; trackingNumber?: string },
  settings?: ISettings
): Promise<boolean> {
  const statusSubjects: Record<string, string> = {
    processing: "Order Update - Being Prepared",
    shipped: "Order Shipped - On the Way",
    delivered: "Order Delivered",
    cancelled: "Order Cancelled",
  };

  const subject =
    statusSubjects[order.newStatus] || `Order Update - ${order.orderNumber}`;

  const html = orderStatusUpdateTemplate(order);

  return sendEmail({
    to: order.customerEmail,
    subject: `${subject} - ${order.orderNumber}`,
    html,
    settings,
  });
}

/**
 * Send new order notification to vendor
 */
export async function sendVendorNewOrderEmail(
  vendorEmail: string,
  vendorName: string,
  order: OrderData,
  vendorItems: OrderItem[],
  vendorSubtotal: number,
  settings?: ISettings
): Promise<boolean> {
  const html = vendorNewOrderTemplate({
    ...order,
    vendorName,
    vendorItems,
    vendorSubtotal,
  }, {
    currency: settings?.general?.defaultCurrency,
    storeName: settings?.general?.storeName,
    logoUrl: settings?.general?.logoUrl,
  });

  return sendEmail({
    to: vendorEmail,
    subject: `New Order - ${order.orderNumber}`,
    html,
    settings,
  });
}
