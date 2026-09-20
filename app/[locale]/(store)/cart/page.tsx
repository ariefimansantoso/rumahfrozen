"use client";

import posthog from "posthog-js";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { AppImage } from "@/components/ui/app-image";
import { useParams, useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast-notification";
import { useCurrency } from "@/providers/currency-provider";
import { CouponInput } from "@/components/checkout/coupon-input";
import { WishlistButton } from "@/components/products/wishlist-button";
import { ChevronDown, Clock3, Loader2, ShoppingBag } from "lucide-react";
import {
  calculateCheckoutTotals,
  isFreeShippingCouponType,
} from "@/lib/discounts";
import {
  analyticsItemsFromCart,
  trackCartView,
} from "@/lib/analytics/events";

type VariantDetails = {
  color: string;
  size: string;
};

type CartLineMetadata = {
  availableStock?: number | null;
  categoryId?: string | null;
  comparePrice?: number | null;
  stock?: number | null;
};

type AppliedCoupon = {
  code: string;
  discount: number;
  type: string;
  discountTarget?: "subtotal" | "shipping";
  maxDiscount?: number;
};

type OrderConfig = {
  taxRate: number;
};

const CART_SUMMARY_SHIPPING_COST = 0;

function stripZeroDecimals(price: string) {
  return price.replace(/([.,]00)(?!\d)/, "");
}

function formatPreorderDate(value?: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getPreorderPaymentLabel(item: {
  preorderDepositAmount?: number;
  preorderOutstandingAmount?: number;
}) {
  const dueNow = Number(item.preorderDepositAmount || 0);
  const dueLater = Number(item.preorderOutstandingAmount || 0);
  if (dueLater <= 0) return "";
  return { dueNow, dueLater };
}

function getQuantityOptions(quantity: number) {
  const maxQuantity = Math.max(10, quantity);

  return Array.from({ length: maxQuantity }, (_, index) => index + 1);
}

function parseVariantDetails(variantName?: string): VariantDetails {
  if (!variantName) {
    return { color: "-", size: "-" };
  }

  const parts = variantName
    .split(/\s*(?:\/|,|\||;)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const details: VariantDetails = { color: "-", size: "-" };

  for (const part of parts) {
    const [rawLabel, ...rawValue] = part.split(":");
    const value = rawValue.join(":").trim();

    if (!value) {
      continue;
    }

    const label = rawLabel.trim().toLowerCase();

    if (label.includes("color") || label.includes("colour")) {
      details.color = value;
    }

    if (label.includes("size")) {
      details.size = value;
    }
  }

  if (details.color === "-" && details.size === "-") {
    return {
      color: parts[0] || variantName,
      size: parts[1] || "-",
    };
  }

  return details;
}

function CartAttribute({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[14px] leading-5 text-muted-foreground">{label}</p>
      <span className="mt-[7px] inline-flex min-h-8 min-w-0 max-w-full items-center rounded-[8px] border border-input bg-background px-[10px] py-[6px] text-[12px] leading-none text-foreground">
        {value}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 text-[14px] leading-5">
      <span className="text-foreground">{label}</span>
      <span className="text-right text-muted-foreground">{children}</span>
    </div>
  );
}

export default function CartPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const { items, isLoading, subtotal, updateItem, removeItem } = useCart();
  const { currency, formatPrice } = useCurrency();

  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [orderConfig, setOrderConfig] = useState<OrderConfig>({ taxRate: 0 });
  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );
  const [taxRequested, setTaxRequested] = useState(false);
  const cartViewSignature = useMemo(
    () =>
      items
        .map(
          (item) =>
            `${String(item.productId)}:${String(item.variantId || "")}:${
              item.quantity
            }`,
        )
        .join("|"),
    [items],
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/settings/public");
        const json = await res.json().catch(() => null);
        if (!active) return;

        if (res.ok && json?.success) {
          setOrderConfig({
            taxRate: Number(json.data?.orders?.taxRate || 0),
          });
        }
      } catch {
        if (active) {
          setOrderConfig({ taxRate: 0 });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const formatCartPrice = (amount: number) =>
    stripZeroDecimals(formatPrice(amount));

  const handleUpdateQuantity = async (
    productId: string,
    quantity: number,
    variantId?: string,
  ) => {
    const key = variantId ? `${productId}-${variantId}` : productId;
    setUpdatingItems((prev) => new Set(prev).add(key));

    try {
      await updateItem(productId, quantity, variantId);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRemoveItem = async (productId: string, variantId?: string) => {
    try {
      const removedItem = items.find(
        (item) =>
          String(item.productId) === productId &&
          item.variantId?.toString() === variantId,
      );
      await removeItem(productId, variantId);
      posthog.capture("cart_item_removed", {
        product_id: productId,
        product_name: removedItem?.name,
        variant_id: variantId,
        price: removedItem?.price,
        quantity: removedItem?.quantity,
      });
      toast.success(t("cart.itemRemoved"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleCheckout = () => {
    posthog.capture("checkout_started", {
      item_count: items.length,
      subtotal,
      coupon_code: appliedCoupon?.code,
      currency: currency.code,
    });
    const couponQuery = appliedCoupon?.code
      ? `?coupon=${encodeURIComponent(appliedCoupon.code)}`
      : "";
    router.push(`/${locale}/checkout${couponQuery}`);
  };

  const saleSavings = items.reduce((sum, item) => {
    const comparePrice = (item as CartLineMetadata).comparePrice;

    if (!comparePrice || comparePrice <= item.price) {
      return sum;
    }

    return sum + (comparePrice - item.price) * item.quantity;
  }, 0);
  const couponCartItems = useMemo(
    () =>
      items.map((item) => {
        const metadata = item as CartLineMetadata;

        return {
          productId: String(item.productId),
          price: item.price,
          quantity: item.quantity,
          categoryId: metadata.categoryId
            ? String(metadata.categoryId)
            : undefined,
        };
      }),
    [items],
  );
  const taxRate = Math.max(0, Number(orderConfig.taxRate || 0));
  const isTaxConfigured = taxRate > 0;
  const totals = calculateCheckoutTotals({
    subtotal,
    shippingCost: CART_SUMMARY_SHIPPING_COST,
    taxRate: taxRequested && isTaxConfigured ? taxRate : 0,
    coupon: appliedCoupon,
  });
  const discount = totals.subtotalDiscount;
  const shippingDiscount = totals.shippingDiscount;
  const tax = totals.tax;
  const total = totals.total;
  const calculateTaxLabel = t.has("checkout.calculate")
    ? t("checkout.calculate")
    : "Calculate";
  const taxNotApplicableLabel = t.has("cart.taxNotApplicable")
    ? t("cart.taxNotApplicable")
    : "Tax is not applicable";
  const appliedCouponForDisplay = appliedCoupon
    ? {
        ...appliedCoupon,
        discount: isFreeShippingCouponType(appliedCoupon.type)
          ? shippingDiscount
          : discount,
      }
    : null;

  useEffect(() => {
    if (!items.length || !cartViewSignature) return;

    trackCartView({
      currency: currency.code,
      value: subtotal,
      items: analyticsItemsFromCart(items),
    });
  }, [cartViewSignature, currency.code, items, subtotal]);

  if (isLoading) {
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <ShoppingBag className="mx-auto mb-6 h-24 w-24 text-muted-foreground/30" />
          <h1 className="mb-2 text-2xl font-bold">{t("cart.emptyCart")}</h1>
          <p className="mb-6 text-muted-foreground">
            {t("cart.emptyCartDescription")}
          </p>
          <Button asChild>
            <Link href={`/${locale}/products`}>{t("common.shopNow")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1298px] px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-[42px] xl:px-0">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,837px)_minmax(320px,378px)] lg:justify-between lg:gap-12">
        <section aria-labelledby="shopping-bag-heading" className="min-w-0">
          <h1
            id="shopping-bag-heading"
            className="mb-[26px] text-[20px] font-semibold leading-6 text-foreground"
          >
            Shopping bag
          </h1>

          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => {
              const productId = String(item.productId);
              const variantId = item.variantId?.toString();
              const itemKey = variantId
                ? `${productId}-${variantId}`
                : productId;
              const isUpdating = updatingItems.has(itemKey);
              const details = parseVariantDetails(item.variantName);
              const metadata = item as CartLineMetadata;
              const comparePrice = metadata.comparePrice;
              const hasComparePrice =
                typeof comparePrice === "number" && comparePrice > item.price;
              const stock =
                typeof metadata.stock === "number"
                  ? metadata.stock
                  : metadata.availableStock;
              const isLowStock =
                typeof stock === "number" && stock > 0 && stock <= 5;
              const preorderPayment = getPreorderPaymentLabel(item);

              return (
                <article
                  key={itemKey}
                  className="grid grid-cols-1 gap-5 py-6 first:pt-0 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-5"
                >
                  <div className="relative h-40 w-32 overflow-hidden rounded-[10px] bg-muted">
                    {item.image ? (
                      <AppImage
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                        No Image
                      </div>
                    )}
                    <WishlistButton
                      productId={productId}
                      size="sm"
                      className="absolute right-2 top-2 h-7 w-7 border-white/80 bg-background text-foreground shadow-none hover:bg-accent"
                    />
                  </div>

                  <div className="min-w-0 pt-1">
                    <div>
                      <h2
                        className="truncate text-[16px] font-normal leading-5 text-foreground"
                        title={item.name}
                      >
                        {item.name}
                      </h2>
                      {item.purchaseType === "preorder" && (
                        <div className="mt-2 space-y-1 text-[13px] font-semibold leading-5 text-blue-600 dark:text-blue-300">
                          <p>
                            {formatPreorderDate(item.preorderReleaseDate)
                              ? `Pre-order - ships around ${formatPreorderDate(
                                  item.preorderReleaseDate,
                                )}`
                              : "Pre-order"}
                          </p>
                          {preorderPayment ? (
                            <p className="font-medium text-muted-foreground">
                              Due now {formatCartPrice(preorderPayment.dueNow)} /
                              later {formatCartPrice(preorderPayment.dueLater)}
                            </p>
                          ) : null}
                        </div>
                      )}
                      <div className="mt-[9px] flex items-center gap-1.5 text-[14px] font-semibold leading-5">
                        {hasComparePrice && (
                          <span className="text-muted-foreground line-through">
                            {formatCartPrice(comparePrice)}
                          </span>
                        )}
                        <span
                          className={
                            hasComparePrice
                              ? "text-destructive"
                              : "text-foreground"
                          }
                        >
                          {formatCartPrice(item.price)}
                        </span>
                      </div>
                      {isLowStock && (
                        <p className="mt-1 flex items-center gap-1 text-[14px] leading-5 text-[#ff5c00]">
                          <Clock3 className="h-3.5 w-3.5" />
                          Low in stock
                        </p>
                      )}
                    </div>

                    <div className="mt-[14px] grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-[42px]">
                      <CartAttribute
                        label={t("products.color")}
                        value={details.color}
                      />
                      <CartAttribute
                        label={t("products.size")}
                        value={details.size}
                      />
                      <div>
                        <p className="text-[14px] leading-5 text-muted-foreground">
                          {t("common.quantity")}
                        </p>
                        <div className="relative mt-[7px] inline-flex">
                          <select
                            aria-label={t("common.quantity")}
                            value={String(item.quantity)}
                            disabled={isUpdating}
                            onChange={(event) =>
                              handleUpdateQuantity(
                                productId,
                                Number(event.target.value),
                                variantId,
                              )
                            }
                            className="h-8 w-[56px] appearance-none rounded-[8px] border border-input bg-background py-0 pl-[10px] pr-7 text-[12px] leading-none text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {getQuantityOptions(item.quantity).map(
                              (quantity) => (
                                <option key={quantity} value={quantity}>
                                  {quantity}
                                </option>
                              ),
                            )}
                          </select>
                          {isUpdating ? (
                            <Loader2 className="pointer-events-none absolute right-[9px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                          ) : (
                            <ChevronDown className="pointer-events-none absolute right-[9px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(productId, variantId)}
                      className="mt-[17px] text-[14px] leading-5 text-foreground underline underline-offset-2 transition-colors hover:text-destructive"
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside
          aria-labelledby="order-summary-heading"
          className="lg:sticky lg:top-24"
        >
          <h2
            id="order-summary-heading"
            className="text-[16px] font-semibold leading-6 text-foreground"
          >
            {t("checkout.orderSummary")}
          </h2>

          <div className="mt-[22px] space-y-[12px]">
            <SummaryRow label={t("common.subtotal")}>
              <span className="font-semibold text-foreground">
                {formatCartPrice(subtotal)}
              </span>
            </SummaryRow>
            <SummaryRow label={t("common.shipping")}>
              <span aria-label={t("cart.shippingCalculatedAtCheckout")}>
                &mdash;
              </span>
            </SummaryRow>
            <SummaryRow label={t("checkout.estimatedTax")}>
              {taxRequested ? (
                isTaxConfigured ? (
                  <span>{formatCartPrice(tax)}</span>
                ) : (
                  <span>{taxNotApplicableLabel}</span>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setTaxRequested(true)}
                  className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  {calculateTaxLabel}
                </button>
              )}
            </SummaryRow>
            <SummaryRow label={t("checkout.promoCode")}>
              {appliedCoupon ? (
                <span className="font-medium uppercase text-foreground">
                  {appliedCoupon.code}
                </span>
              ) : isCouponOpen ? (
                <span />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCouponOpen(true)}
                  className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  {t("checkout.enterCode")}
                </button>
              )}
            </SummaryRow>
            {isCouponOpen || appliedCoupon ? (
              <CouponInput
                cartItems={couponCartItems}
                subtotal={subtotal}
                shippingCost={CART_SUMMARY_SHIPPING_COST}
                appliedCoupon={appliedCouponForDisplay}
                onApply={(coupon) => {
                  setAppliedCoupon(coupon);
                  setIsCouponOpen(true);
                }}
                onRemove={() => {
                  setAppliedCoupon(null);
                  setIsCouponOpen(false);
                }}
              />
            ) : null}
            {discount > 0 ? (
              <SummaryRow
                label={`${t("common.discount")}${
                  appliedCoupon ? ` (${appliedCoupon.code})` : ""
                }`}
              >
                <span className="text-green-700 dark:text-green-400">
                  -{formatCartPrice(discount)}
                </span>
              </SummaryRow>
            ) : null}
            <SummaryRow label={t("common.sale")}>
              {saleSavings > 0 ? (
                <span>-{formatCartPrice(saleSavings)}</span>
              ) : (
                <span>&mdash;</span>
              )}
            </SummaryRow>
          </div>

          <div className="mt-[16px] flex items-baseline justify-between gap-6">
            <span className="text-[14px] font-semibold leading-5 text-foreground">
              {t("common.total")}
            </span>
            <div className="text-right">
              <span className="mr-2 text-[11px] font-medium uppercase leading-none text-muted-foreground">
                {currency.code}
              </span>
              <span className="text-[18px] font-semibold leading-none text-foreground">
                {formatCartPrice(total)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            className="mt-[22px] h-[46px] w-full rounded-[7px] bg-primary px-4 text-[14px] font-semibold leading-none text-primary-foreground transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {t("checkout.checkout")}
          </button>

          <Link
            href={`/${locale}/products`}
            className="mt-3 flex h-[46px] w-full items-center justify-center rounded-[7px] border border-input bg-background px-4 text-center text-[14px] font-semibold leading-none text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {t("cart.continueShopping")}
          </Link>
        </aside>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mx-auto max-w-[1298px] px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-[42px] xl:px-0">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,837px)_minmax(320px,378px)] lg:justify-between lg:gap-12">
        <section>
          <Skeleton className="mb-[26px] h-6 w-32" />
          <div className="divide-y divide-[var(--border)]">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-5 py-6 first:pt-0 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-5"
              >
                <Skeleton className="h-40 w-32 rounded-[10px]" />
                <div className="pt-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-[9px] h-5 w-16" />
                  <div className="mt-[14px] grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-[42px]">
                    <div>
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="mt-[7px] h-8 w-14 rounded-[8px]" />
                    </div>
                    <div>
                      <Skeleton className="h-5 w-10" />
                      <Skeleton className="mt-[7px] h-8 w-14 rounded-[8px]" />
                    </div>
                    <div>
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="mt-[7px] h-8 w-14 rounded-[8px]" />
                    </div>
                  </div>
                  <Skeleton className="mt-[17px] h-5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside>
          <Skeleton className="h-6 w-32" />
          <div className="mt-[22px] space-y-[12px]">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
          <Skeleton className="mt-[16px] h-6 w-full" />
          <Skeleton className="mt-[22px] h-[46px] w-full rounded-[7px]" />
          <Skeleton className="mt-3 h-[46px] w-full rounded-[7px]" />
        </aside>
      </div>
    </div>
  );
}
