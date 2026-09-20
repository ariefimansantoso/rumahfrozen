"use client";

import type { StripeElementStyle } from "@stripe/stripe-js";
import type { CartItem } from "@/types";
import type { ShippingRateOption } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import { FLOATING_INPUT_CLASS, FLOATING_LABEL_CLASS } from "@/lib/constants";

export type CheckoutFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  paymentMethod: "card" | "paypal" | "razorpay" | "paystack" | "cod";
  billingSameAsShipping: "same" | "different";
  billingFirstName: string;
  billingLastName: string;
  billingAddress: string;
  billingApartment?: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  billingPhone: string;
};

export type CheckoutAddressPayload = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
};

export type CheckoutCartProductRef = CartItem["productId"] | { _id?: unknown };
export type CheckoutCartItem = Omit<CartItem, "productId"> & {
  productId: CheckoutCartProductRef;
  categoryId?: unknown;
  variantLabel?: string;
  compareAtPrice?: number;
};

export type AppliedCoupon = {
  code: string;
  discount: number;
  type: string;
  discountTarget?: "subtotal" | "shipping";
  maxDiscount?: number;
};

export type CheckoutVendorRateGroup = {
  vendorId: string;
  vendorName: string;
  selectedOptionId?: string;
  cost: number;
  options: Array<{
    id: string;
    name: string;
    cost: number;
    deliveryDays?: { min: number; max: number };
  }>;
};

export type CheckoutShippingResolution = {
  available: boolean;
  mode: "single" | "vendor";
  shippingCost: number;
  singleOptions: ShippingRateOption[];
  customs?: { dutyAmount?: number; collectedAtCheckout?: boolean };
};

export type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayPaymentFailedResponse = {
  error?: {
    description?: string;
    reason?: string;
  };
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  handler: (response: RazorpayCheckoutResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

export type RazorpayCheckoutInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: RazorpayPaymentFailedResponse) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayCheckoutOptions,
    ) => RazorpayCheckoutInstance;
  }
}

export const floatingInputClass = FLOATING_INPUT_CLASS;
export const floatingLabelClass = FLOATING_LABEL_CLASS;
export const RAZORPAY_SCRIPT_ID = "razorpay-checkout-js";
export const STRIPE_ELEMENT_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial';

export function createStripeElementStyle(isDark: boolean): StripeElementStyle {
  return {
    base: {
      fontSize: "16px",
      color: isDark ? "#f8fafc" : "#0f172a",
      fontFamily: STRIPE_ELEMENT_FONT_FAMILY,
      "::placeholder": { color: isDark ? "#94a3b8" : "#64748b" },
      "::selection": {
        backgroundColor: isDark ? "#334155" : "#bfdbfe",
        color: isDark ? "#f8fafc" : "#0f172a",
      },
    },
    invalid: { color: isDark ? "#f87171" : "#dc2626" },
  };
}

export function loadRazorpayCheckoutScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay checkout is unavailable"));
      return;
    }
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existing = document.getElementById(
      RAZORPAY_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Razorpay checkout")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

export function getCheckoutProductId(productId: CheckoutCartProductRef): string {
  if (typeof productId === "string") return productId;
  if (typeof productId === "object" && productId && "_id" in productId) {
    const id = productId._id;
    if (id) return String(id);
  }
  return String(productId);
}

export function cleanCheckoutField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function formatPreorderDate(value?: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getCouponErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const errors = "errors" in payload ? payload.errors : null;
  if (errors && typeof errors === "object") {
    const firstFieldErrors = Object.values(
      errors as Record<string, unknown>,
    )[0];
    if (
      Array.isArray(firstFieldErrors) &&
      typeof firstFieldErrors[0] === "string"
    ) {
      return firstFieldErrors[0];
    }
  }

  const message = "message" in payload ? payload.message : null;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function buildCheckoutAddressPayload(
  input: {
    firstName?: unknown;
    lastName?: unknown;
    address?: unknown;
    apartment?: unknown;
    city?: unknown;
    state?: unknown;
    postalCode?: unknown;
    country?: unknown;
    phone?: unknown;
  },
  fallbackPhone = "",
): CheckoutAddressPayload {
  const firstName = cleanCheckoutField(input.firstName);
  const lastName = cleanCheckoutField(input.lastName);
  const phone = cleanCheckoutField(input.phone) || fallbackPhone.trim();

  return {
    fullName: `${firstName} ${lastName}`.trim(),
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    street: cleanCheckoutField(input.address),
    apartment: cleanCheckoutField(input.apartment) || undefined,
    city: cleanCheckoutField(input.city),
    state: cleanCheckoutField(input.state),
    postalCode: cleanCheckoutField(input.postalCode),
    country: cleanCheckoutField(input.country),
    phone: phone || undefined,
  };
}

export function PaymentProviderLogo({
  provider,
}: {
  provider: "paypal" | "razorpay" | "paystack";
}) {
  const config = {
    paypal: {
      label: "P",
      className: "text-[#003087]",
      textClassName: "italic",
    },
    razorpay: {
      label: "R",
      className: "text-[#0b5fff]",
      textClassName: "",
    },
    paystack: {
      label: "P",
      className: "text-[#09a5db]",
      textClassName: "",
    },
  }[provider];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[3px] bg-white px-1 text-[13px] font-black leading-none shadow-xs",
        config.className,
        config.textClassName,
      )}
    >
      {config.label}
    </span>
  );
}
