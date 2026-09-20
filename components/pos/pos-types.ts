import type { POSSettings } from "@/lib/pos/build-pos-settings";

export interface POSProduct {
  _id: string;
  name: string;
  price: number;
  comparePrice?: number;
  images: string[];
  sku: string;
  barcode?: string;
  stock: number;
  vendorId: string;
  category: string;
  variants: POSVariant[];
  options?: POSOption[];
}

export interface POSVariant {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
  image?: string;
  optionValues?: { optionId: string; value: string }[];
}

export interface POSOption {
  _id: string;
  name: string;
  values: { _id: string; value: string }[];
}

export interface POSCategory {
  _id: string;
  name: string;
  slug: string;
  image?: string;
}

export interface POSVendorFilterOption {
  _id: string;
  storeName: string;
  slug: string;
}

export interface POSLineDiscount {
  type: "percent" | "amount";
  value: number;
}

export interface POSCartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
  vendorId: string;
  maxStock: number;
  lineDiscount?: POSLineDiscount;
  lineNote?: string;
}

export interface POSCustomer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string;
}

export interface POSTerminalProps {
  settings: POSSettings;
}

export interface ReceiptPrintPayload {
  orderNumber: string;
  createdAt: string | Date;
  paymentMethod: string;
  cashTendered?: number;
  paymentReference?: string;
  paymentNote?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  balanceReturned: number;
}

export interface POSCompletedOrder {
  _id: string;
  orderNumber: string;
  total: number;
  itemCount?: number;
  cashTendered?: number;
  changeDue: number;
  paymentReference?: string;
  paymentNote?: string;
}

export type POSView = "terminal" | "payment" | "complete";
export type CustomerMode = "search" | "create";
