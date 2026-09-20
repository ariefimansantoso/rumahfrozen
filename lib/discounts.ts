export const FREE_SHIPPING_COUPON_TYPE = "free_shipping";

export type DiscountableCoupon = {
  type?: string | null;
  discount?: number | null;
  maxDiscount?: number | null;
};

export type CheckoutTotals = {
  subtotal: number;
  shippingCost: number;
  subtotalDiscount: number;
  shippingDiscount: number;
  discount: number;
  discountedSubtotal: number;
  discountedShippingCost: number;
  tax: number;
  total: number;
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function isFreeShippingCouponType(type?: string | null) {
  return String(type || "").toLowerCase() === FREE_SHIPPING_COUPON_TYPE;
}

function positiveMoney(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function calculateCheckoutTotals(params: {
  subtotal: number;
  shippingCost: number;
  taxRate: number;
  coupon?: DiscountableCoupon | null;
}): CheckoutTotals {
  const subtotal = roundMoney(positiveMoney(params.subtotal));
  const shippingCost = roundMoney(positiveMoney(params.shippingCost));
  const taxRate = positiveMoney(params.taxRate);
  const coupon = params.coupon;

  let subtotalDiscount = 0;
  let shippingDiscount = 0;

  if (coupon) {
    if (isFreeShippingCouponType(coupon.type)) {
      const maxDiscount = positiveMoney(coupon.maxDiscount);
      const cap = maxDiscount > 0 ? maxDiscount : shippingCost;
      shippingDiscount = roundMoney(Math.min(shippingCost, cap));
    } else {
      subtotalDiscount = roundMoney(
        Math.min(subtotal, positiveMoney(coupon.discount)),
      );
    }
  }

  const discountedSubtotal = roundMoney(
    Math.max(0, subtotal - subtotalDiscount),
  );
  const discountedShippingCost = roundMoney(
    Math.max(0, shippingCost - shippingDiscount),
  );
  const tax = roundMoney(discountedSubtotal * taxRate);
  const discount = roundMoney(subtotalDiscount + shippingDiscount);
  const total = roundMoney(discountedSubtotal + discountedShippingCost + tax);

  return {
    subtotal,
    shippingCost,
    subtotalDiscount,
    shippingDiscount,
    discount,
    discountedSubtotal,
    discountedShippingCost,
    tax,
    total,
  };
}
