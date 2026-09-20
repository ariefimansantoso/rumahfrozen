"use client";

import { z } from "zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loadStripe,
  type Stripe,
  type StripeCardCvcElement,
  type StripeCardExpiryElement,
  type StripeCardNumberElement,
  type StripeElements,
} from "@stripe/stripe-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Loader2, AlertCircle, Truck, Wallet } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/providers/currency-provider";
import { toast } from "@/components/ui/toast-notification";
import { AppImage } from "@/components/ui/app-image";
import { CouponInput } from "@/components/checkout/coupon-input";
import { CountrySelect } from "@/components/common/country-multi-select";
import { useAppTheme } from "@/providers/theme-provider";
import {
  calculateShipping,
  estimateCustomsDuty,
  SHIPPING_UNAVAILABLE_MESSAGE,
  type ShippingSettings,
} from "@/lib/shipping";
import {
  calculateCheckoutTotals,
  isFreeShippingCouponType,
} from "@/lib/discounts";
import {
  analyticsItemsFromCart,
  saveCheckoutAnalyticsSnapshot,
  trackCheckout,
  trackPaymentInfo,
} from "@/lib/analytics/events";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_ORDER_SHIPPING_COST,
  DEFAULT_ORDER_TAX_RATE,
} from "@/lib/order-settings";
import { signOut } from "@/lib/auth-client";
import type { Address } from "@/types";
import {
  PaymentProviderLogo,
  buildCheckoutAddressPayload,
  createStripeElementStyle,
  floatingInputClass,
  floatingLabelClass,
  formatPreorderDate,
  getCheckoutProductId,
  getCouponErrorMessage,
  loadRazorpayCheckoutScript,
  type AppliedCoupon,
  type CheckoutCartItem,
  type CheckoutFormData,
  type CheckoutShippingResolution,
  type CheckoutVendorRateGroup,
  type RazorpayCheckoutResponse,
} from "@/components/checkout/checkout-helpers";


export function CheckoutContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const couponCodeFromCart = (searchParams.get("coupon") || "")
    .trim()
    .toUpperCase();

  const checkoutSchema = z
    .object({
      firstName: z.string(),
      lastName: z.string().min(1, t("validation.required")),
      email: z.string().email(t("validation.email")),
      phone: z.string(),
      address: z.string().min(1, t("validation.required")),
      apartment: z.string().optional(),
      city: z.string().min(1, t("validation.required")),
      state: z.string(),
      postalCode: z.string(),
      country: z.string().min(1, t("validation.required")),
      paymentMethod: z.enum(["card", "paypal", "razorpay", "paystack", "cod"]),
      billingSameAsShipping: z.enum(["same", "different"]),
      billingFirstName: z.string(),
      billingLastName: z.string(),
      billingAddress: z.string(),
      billingApartment: z.string().optional(),
      billingCity: z.string(),
      billingState: z.string(),
      billingPostalCode: z.string(),
      billingCountry: z.string(),
      billingPhone: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.billingSameAsShipping !== "different") return;

      const requiredBillingFields: Array<keyof CheckoutFormData> = [
        "billingLastName",
        "billingAddress",
        "billingCity",
        "billingPostalCode",
        "billingCountry",
      ];

      for (const field of requiredBillingFields) {
        const value = data[field];
        if (typeof value !== "string" || !value.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: t("validation.required"),
          });
        }
      }
    });

  const { items, subtotal, clearCart, refreshCart, isLoading } = useCart();
  const { formatPrice, currency } = useCurrency();
  const { user, isAuthenticated } = useAuth();
  const { isDark } = useAppTheme();
  const stripeElementStyle = useMemo(
    () => createStripeElementStyle(isDark),
    [isDark],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [emailMarketingOptIn, setEmailMarketingOptIn] = useState(false);
  const [preorderAccepted, setPreorderAccepted] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<{
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    codEnabled: boolean;
    stripeConfigured?: boolean;
    stripePublishableKey?: string;
    paypalConfigured?: boolean;
    razorpayEnabled: boolean;
    razorpayConfigured?: boolean;
    paystackEnabled: boolean;
    paystackConfigured?: boolean;
    codInstructions?: string;
    codMinOrderAmount?: number;
    codMaxOrderAmount?: number;
  }>({
    stripeEnabled: false,
    paypalEnabled: false,
    codEnabled: true,
    stripeConfigured: false,
    paypalConfigured: false,
    razorpayEnabled: false,
    razorpayConfigured: false,
    paystackEnabled: false,
    paystackConfigured: false,
  });
  const [orderConfig, setOrderConfig] = useState<{
    taxRate: number;
    freeShippingThreshold: number;
    defaultShippingCost: number;
  }>({
    taxRate: DEFAULT_ORDER_TAX_RATE,
    freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD,
    defaultShippingCost: DEFAULT_ORDER_SHIPPING_COST,
  });
  const [shippingConfig, setShippingConfig] = useState<ShippingSettings>({
    enabled: false,
    delivery: {
      processingDaysMin: 0,
      processingDaysMax: 0,
      showEstimatedDelivery: true,
    },
    zones: [],
    fallbackRate: { enabled: false, name: "Standard", price: 0 },
    localPickup: { enabled: false },
  });

  const [cardholderName, setCardholderName] = useState("");
  const [stripeElementReady, setStripeElementReady] = useState(false);
  const [stripeElementError, setStripeElementError] = useState<string | null>(
    null,
  );
  const stripeRef = useRef<Stripe | null>(null);
  const stripeElementsRef = useRef<StripeElements | null>(null);
  const cardNumberElementRef = useRef<StripeCardNumberElement | null>(null);
  const cardExpiryElementRef = useRef<StripeCardExpiryElement | null>(null);
  const cardCvcElementRef = useRef<StripeCardCvcElement | null>(null);
  const recoveredTokenRef = useRef<string | null>(null);
  const autoAppliedCouponRef = useRef<string | null>(null);
  const trackedCheckoutSignaturesRef = useRef<Set<string>>(new Set());
  const [cardNumberMountEl, setCardNumberMountEl] =
    useState<HTMLDivElement | null>(null);
  const [cardExpiryMountEl, setCardExpiryMountEl] =
    useState<HTMLDivElement | null>(null);
  const [cardCvcMountEl, setCardCvcMountEl] = useState<HTMLDivElement | null>(
    null,
  );
  const [checkoutStickyOffset, setCheckoutStickyOffset] = useState(112);
  const hasPreorderItems = useMemo(
    () => items.some((item) => item.purchaseType === "preorder"),
    [items],
  );
  const preorderDateLabel = useMemo(() => {
    const dates = items
      .filter((item) => item.purchaseType === "preorder")
      .map((item) => {
        const date = item.preorderReleaseDate
          ? new Date(item.preorderReleaseDate)
          : null;
        return date && !Number.isNaN(date.getTime()) ? date : null;
      })
      .filter((date): date is Date => Boolean(date));
    if (dates.length === 0) return "";
    const latest = dates.reduce((max, date) =>
      date.getTime() > max.getTime() ? date : max,
    );
    return formatPreorderDate(latest);
  }, [items]);

  useEffect(() => {
    if (!hasPreorderItems) setPreorderAccepted(false);
  }, [hasPreorderItems]);

  useEffect(() => {
    if (searchParams.get("canceled") === "true") {
      setError("Payment was canceled. Please try again.");
    }
  }, [searchParams]);

  useEffect(() => {
    const token = searchParams.get("recover");
    if (!token || recoveredTokenRef.current === token) return;
    recoveredTokenRef.current = token;

    (async () => {
      try {
        const res = await fetch("/api/checkout/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(
            json?.message || "Recovery link is no longer available",
          );
        }
        await refreshCart();
        toast.success("Checkout restored");
        router.replace(`/${locale}/checkout`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Recovery link is no longer available",
        );
      }
    })();
  }, [locale, refreshCart, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const header = document.querySelector<HTMLElement>("[data-sticky-header]");
    const updateOffset = () => {
      setCheckoutStickyOffset((header?.offsetHeight ?? 88) + 24);
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);

    if (!header || typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateOffset);
    }

    const observer = new ResizeObserver(updateOffset);
    observer.observe(header);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  useEffect(() => {
    setEmailMarketingOptIn(isAuthenticated);
  }, [isAuthenticated]);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      apartment: "",
      city: "",
      state: "",
      postalCode: "",
      country: "United States",
      paymentMethod: "cod",
      billingSameAsShipping: "same",
      billingFirstName: "",
      billingLastName: "",
      billingAddress: "",
      billingApartment: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      billingCountry: "United States",
      billingPhone: "",
    },
  });

  // Auto-fill email and default address for logged-in users
  useEffect(() => {
    if (!isAuthenticated) return;

    const currentEmail = form.getValues("email");
    if (!currentEmail && user?.email) {
      form.setValue("email", user.email, { shouldValidate: true });
    }

    // Fill name from user profile
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      const first = parts.slice(0, -1).join(" ") || "";
      const last = parts[parts.length - 1] || "";
      if (!form.getValues("firstName") && first) {
        form.setValue("firstName", first);
      }
      if (!form.getValues("lastName") && last) {
        form.setValue("lastName", last);
      }
    }

    // Fetch default address and auto-fill
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/user/addresses");
        if (!res.ok) return;
        const json = await res.json();
        if (!active || !json?.success) return;
        const addresses = (json.data?.addresses || []) as Address[];
        const defaultAddr =
          addresses.find((address) => address.isDefault) || addresses[0];
        if (!defaultAddr) return;

        // Only fill if the form fields are still empty
        if (!form.getValues("address") && defaultAddr.street) {
          form.setValue("address", defaultAddr.street);
        }
        if (!form.getValues("apartment") && defaultAddr.apartment) {
          form.setValue("apartment", defaultAddr.apartment);
        }
        if (!form.getValues("city") && defaultAddr.city) {
          form.setValue("city", defaultAddr.city);
        }
        if (!form.getValues("state") && defaultAddr.state) {
          form.setValue("state", defaultAddr.state);
        }
        if (!form.getValues("postalCode") && defaultAddr.postalCode) {
          form.setValue("postalCode", defaultAddr.postalCode);
        }
        if (defaultAddr.country) {
          form.setValue("country", defaultAddr.country);
        }
        if (!form.getValues("phone") && defaultAddr.phone) {
          form.setValue("phone", defaultAddr.phone);
        }
      } catch {
        // ignore - form stays empty
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user, form]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/public");
        const json = await res.json();
        if (!active) return;
        if (res.ok && json?.success) {
          setPaymentConfig(json.data.payment);
          setOrderConfig(json.data.orders);
          setShippingConfig(
            json.data.shipping || { enabled: false, zones: [] },
          );

          const enabledMethods: Array<CheckoutFormData["paymentMethod"]> = [];
          if (json.data.payment?.stripeConfigured) enabledMethods.push("card");
          if (json.data.payment?.paypalConfigured)
            enabledMethods.push("paypal");
          if (json.data.payment?.razorpayConfigured)
            enabledMethods.push("razorpay");
          if (json.data.payment?.paystackConfigured)
            enabledMethods.push("paystack");
          if (json.data.payment?.codEnabled) enabledMethods.push("cod");
          const current = form.getValues("paymentMethod");
          if (!enabledMethods.includes(current) && enabledMethods.length > 0) {
            form.setValue("paymentMethod", enabledMethods[0]);
          }
          if (enabledMethods.length === 0) {
            setError(
              "No payment method is configured. Please contact support.",
            );
          }
        }
        setSettingsLoaded(true);
      } catch {
        if (!active) return;
        setPaymentConfig({
          stripeEnabled: false,
          paypalEnabled: false,
          codEnabled: true,
          stripeConfigured: false,
          paypalConfigured: false,
          razorpayEnabled: false,
          razorpayConfigured: false,
          paystackEnabled: false,
          paystackConfigured: false,
        });
        setOrderConfig({
          taxRate: DEFAULT_ORDER_TAX_RATE,
          freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD,
          defaultShippingCost: DEFAULT_ORDER_SHIPPING_COST,
        });
        setShippingConfig({ enabled: false, zones: [] });
        setSettingsLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [form]);

  const freeShippingThreshold =
    orderConfig.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;
  const defaultShippingCost =
    orderConfig.defaultShippingCost ?? DEFAULT_ORDER_SHIPPING_COST;
  const taxRate = orderConfig.taxRate ?? DEFAULT_ORDER_TAX_RATE;

  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState<
    string | undefined
  >(undefined);
  const [vendorRateGroups, setVendorRateGroups] = useState<
    CheckoutVendorRateGroup[]
  >([]);
  const [vendorShippingSelections, setVendorShippingSelections] = useState<
    Record<string, string>
  >({});
  const [serverShippingResolution, setServerShippingResolution] =
    useState<CheckoutShippingResolution | null>(null);

  const watchedCountry = form.watch("country");
  const watchedState = form.watch("state");

  const shippingResult = calculateShipping({
    subtotal,
    totalWeight: 0,
    destination: {
      country: watchedCountry,
      state: watchedState,
    },
    shipping: shippingConfig,
    orders: { freeShippingThreshold, defaultShippingCost },
    selectedOptionId: selectedShippingOptionId,
  });
  const shippingOptions =
    serverShippingResolution?.mode === "single"
      ? serverShippingResolution.singleOptions
      : shippingResult.options;

  // Per-vendor shipping: each vendor's items are rated separately. When active,
  // the displayed shipping cost is the sum of the selected per-vendor options.
  const vendorShippingActive =
    Boolean(shippingConfig?.enabled) &&
    Boolean(shippingConfig?.vendorShipping?.enabled);
  const perVendorMode = vendorShippingActive && vendorRateGroups.length > 0;
  const perVendorShippingCost = useMemo(() => {
    if (!perVendorMode) return 0;
    return vendorRateGroups.reduce((sum, g) => {
      const selId = vendorShippingSelections[g.vendorId] ?? g.selectedOptionId;
      const opt =
        g.options.find((o) => o.id === selId) ||
        g.options.find((o) => o.id === g.selectedOptionId);
      return sum + (opt?.cost ?? g.cost);
    }, 0);
  }, [perVendorMode, vendorRateGroups, vendorShippingSelections]);

  const selectedSingleOption =
    shippingOptions.find((option) => option.id === selectedShippingOptionId) ||
    shippingOptions.find(
      (option) => option.cost === serverShippingResolution?.shippingCost,
    );
  const singleShippingCost =
    serverShippingResolution?.mode === "single"
      ? (selectedSingleOption?.cost ?? serverShippingResolution.shippingCost)
      : shippingResult.shippingCost;
  const shippingCost = perVendorMode
    ? perVendorShippingCost
    : singleShippingCost;
  const shippingUnavailable = serverShippingResolution?.available === false;
  const customsDutyAmount =
    serverShippingResolution?.customs?.dutyAmount ??
    estimateCustomsDuty({
      subtotal,
      destination: {
        country: watchedCountry,
        state: watchedState,
      },
      originCountry: shippingConfig?.origin?.country,
      customs: shippingConfig?.customs,
    }).dutyAmount;

  // Keep the selected option valid as address/cart changes the available rates.
  useEffect(() => {
    if (
      selectedShippingOptionId &&
      !shippingOptions.some((o) => o.id === selectedShippingOptionId)
    ) {
      setSelectedShippingOptionId(undefined);
    }
  }, [shippingOptions, selectedShippingOptionId]);

  // Fetch authoritative product/variant-aware rates for both single and
  // per-vendor carts. The server normalizes weight units and excludes digital
  // items before selecting rates.
  useEffect(() => {
    if (!watchedCountry) {
      setVendorRateGroups([]);
      setServerShippingResolution(null);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/shipping-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            country: watchedCountry,
            state: watchedState,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok && data?.success) {
          const resolution = data.data as CheckoutShippingResolution & {
            vendorGroups?: CheckoutVendorRateGroup[];
          };
          setServerShippingResolution(resolution);
          setVendorRateGroups(
            resolution.mode === "vendor" ? resolution.vendorGroups || [] : [],
          );
        } else {
          setVendorRateGroups([]);
          setServerShippingResolution(null);
        }
      } catch {
        if (active) {
          setVendorRateGroups([]);
          setServerShippingResolution(null);
        }
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [items, watchedCountry, watchedState]);
  const couponCartItems = useMemo(
    () =>
      items.map((item) => {
        const checkoutItem = item as CheckoutCartItem;
        return {
          productId: getCheckoutProductId(checkoutItem.productId),
          price: checkoutItem.price,
          quantity: checkoutItem.quantity,
          categoryId: checkoutItem.categoryId
            ? String(checkoutItem.categoryId)
            : undefined,
        };
      }),
    [items],
  );
  const totals = calculateCheckoutTotals({
    subtotal,
    shippingCost,
    taxRate,
    coupon: appliedCoupon,
  });
  const discount = totals.subtotalDiscount;
  const shippingDiscount = totals.shippingDiscount;
  const discountedShippingCost = totals.discountedShippingCost;
  const tax = totals.tax;
  const total = totals.total + customsDutyAmount;
  const preorderOutstandingAmount = hasPreorderItems
    ? items.reduce(
        (sum, item) => sum + Number(item.preorderOutstandingAmount || 0),
        0,
      )
    : 0;
  const preorderDueNow = Math.max(0, total - preorderOutstandingAmount);
  const appliedCouponForDisplay = appliedCoupon
    ? {
        ...appliedCoupon,
        discount: isFreeShippingCouponType(appliedCoupon.type)
          ? shippingDiscount
          : discount,
      }
    : null;
  const deliveryEstimate =
    !perVendorMode &&
    shippingConfig?.enabled &&
    shippingConfig?.delivery?.showEstimatedDelivery &&
    shippingOptions.length > 0
      ? selectedSingleOption?.deliveryDays
      : undefined;
  const checkoutAnalyticsSignature = useMemo(
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
    if (!items.length || !checkoutAnalyticsSignature) return;
    if (trackedCheckoutSignaturesRef.current.has(checkoutAnalyticsSignature)) {
      return;
    }

    trackedCheckoutSignaturesRef.current.add(checkoutAnalyticsSignature);

    trackCheckout({
      currency: currency.code,
      value: total,
      items: analyticsItemsFromCart(items),
    });
  }, [checkoutAnalyticsSignature, currency.code, items, total]);

  useEffect(() => {
    if (
      appliedCoupon &&
      isFreeShippingCouponType(appliedCoupon.type) &&
      shippingCost <= 0
    ) {
      setAppliedCoupon(null);
    }
  }, [appliedCoupon, shippingCost]);

  useEffect(() => {
    if (!settingsLoaded || !couponCodeFromCart || !items.length) return;
    if (appliedCoupon?.code?.toUpperCase() === couponCodeFromCart) return;
    if (autoAppliedCouponRef.current === couponCodeFromCart) return;

    autoAppliedCouponRef.current = couponCodeFromCart;
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: couponCodeFromCart,
            cartItems: couponCartItems,
            subtotal,
            shippingCost,
          }),
        });
        const data = await res.json().catch(() => null);

        if (!active) return;
        if (!res.ok || !data?.success) {
          throw new Error(
            getCouponErrorMessage(
              data,
              t("coupon.invalid"),
            ),
          );
        }

        setAppliedCoupon({
          code: data.data.code,
          discount: data.data.discount,
          type: data.data.type,
          discountTarget: data.data.discountTarget,
          maxDiscount: data.data.maxDiscount,
        });
      } catch (error) {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : t("coupon.invalid"),
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [
    appliedCoupon?.code,
    couponCartItems,
    couponCodeFromCart,
    items.length,
    settingsLoaded,
    shippingCost,
    subtotal,
    t,
  ]);

  useEffect(() => {
    if (!items.length) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const subscription = form.watch((value) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const email = typeof value.email === "string" ? value.email.trim() : "";
        const phone = typeof value.phone === "string" ? value.phone.trim() : "";
        if (!email && !phone) return;

        const shippingAddress = buildCheckoutAddressPayload({
          firstName: value.firstName,
          lastName: value.lastName,
          address: value.address,
          apartment: value.apartment,
          city: value.city,
          state: value.state,
          postalCode: value.postalCode,
          country: value.country,
          phone,
        });
        const billingAddress =
          value.billingSameAsShipping === "different"
            ? buildCheckoutAddressPayload(
                {
                  firstName: value.billingFirstName,
                  lastName: value.billingLastName,
                  address: value.billingAddress,
                  apartment: value.billingApartment,
                  city: value.billingCity,
                  state: value.billingState,
                  postalCode: value.billingPostalCode,
                  country: value.billingCountry,
                  phone: value.billingPhone,
                },
                phone,
              )
            : shippingAddress;

        void fetch("/api/checkout/abandoned", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            email,
            phone,
            customerName: shippingAddress.fullName,
            buyerAcceptsMarketing: emailMarketingOptIn,
            shippingAddress,
            billingAddress,
            subtotalPrice: subtotal,
            shippingPrice: discountedShippingCost,
            totalTax: tax,
            totalDiscounts: totals.discount,
            totalPrice: total,
            presentmentCurrency: currency.code,
          }),
        }).catch(() => undefined);
      }, 900);
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [
    currency.code,
    discountedShippingCost,
    emailMarketingOptIn,
    form,
    items.length,
    locale,
    subtotal,
    tax,
    total,
    totals.discount,
  ]);

  const contactLabel = user?.email || form.watch("email");
  const contactInitial = String(user?.name || contactLabel || "C")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  const shippingMethodName =
    shippingResult.source === "shipping"
      ? (() => {
          const zones = Array.isArray(shippingConfig?.zones)
            ? shippingConfig.zones
            : [];
          const rateId = shippingResult.rateId;
          for (const zone of zones) {
            const rates = Array.isArray(zone?.rates) ? zone.rates : [];
            const match = rates.find((rate) => rate?.id === rateId);
            if (match?.name) return String(match.name);
          }
          const fallbackName = shippingConfig?.fallbackRate?.name;
          return fallbackName ? String(fallbackName) : "Standard";
        })()
      : "Standard";

  const selectedPayment = form.watch("paymentMethod");

  useEffect(() => {
    const publishableKey = paymentConfig.stripePublishableKey;
    if (selectedPayment !== "card" || !publishableKey) {
      setStripeElementReady(false);
      setStripeElementError(null);
      cardNumberElementRef.current?.destroy();
      cardExpiryElementRef.current?.destroy();
      cardCvcElementRef.current?.destroy();
      cardNumberElementRef.current = null;
      cardExpiryElementRef.current = null;
      cardCvcElementRef.current = null;
      stripeElementsRef.current = null;
      stripeRef.current = null;
      return;
    }

    // Wait for mount elements to be available - effect will re-run when they're set
    if (!cardNumberMountEl || !cardExpiryMountEl || !cardCvcMountEl) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!active) return;
        if (!stripe) {
          setStripeElementError("Stripe is not configured");
          setStripeElementReady(false);
          return;
        }

        stripeRef.current = stripe;

        // Always destroy old elements before creating new ones
        // (mount divs may have changed due to conditional rendering)
        cardNumberElementRef.current?.destroy();
        cardExpiryElementRef.current?.destroy();
        cardCvcElementRef.current?.destroy();
        cardNumberElementRef.current = null;
        cardExpiryElementRef.current = null;
        cardCvcElementRef.current = null;

        const elements = stripe.elements();
        stripeElementsRef.current = elements;

        const cardNumber = elements.create("cardNumber", {
          style: stripeElementStyle,
          showIcon: false,
          placeholder: t("payment.cardNumber"),
        });
        const cardExpiry = elements.create("cardExpiry", {
          style: stripeElementStyle,
          placeholder: t("payment.expiryDate"),
        });
        const cardCvc = elements.create("cardCvc", {
          style: stripeElementStyle,
          placeholder: t("payment.cvv"),
        });

        cardNumber.on("change", (ev) => {
          setStripeElementError(ev.error?.message || null);
        });
        cardExpiry.on("change", (ev) => {
          setStripeElementError(ev.error?.message || null);
        });
        cardCvc.on("change", (ev) => {
          setStripeElementError(ev.error?.message || null);
        });

        if (!active) {
          cardNumber.destroy();
          cardExpiry.destroy();
          cardCvc.destroy();
          return;
        }

        cardNumber.mount(cardNumberMountEl);
        cardExpiry.mount(cardExpiryMountEl);
        cardCvc.mount(cardCvcMountEl);

        cardNumberElementRef.current = cardNumber;
        cardExpiryElementRef.current = cardExpiry;
        cardCvcElementRef.current = cardCvc;
        setStripeElementReady(true);
        setStripeElementError(null);
      } catch (err: unknown) {
        if (!active) return;
        console.error("Stripe Element initialization failed:", err);
        setStripeElementError(
          err instanceof Error ? err.message : "Failed to load payment form",
        );
        setStripeElementReady(false);
      }
    })();

    return () => {
      active = false;
      // Destroy elements on cleanup so fresh ones are created on re-mount
      cardNumberElementRef.current?.destroy();
      cardExpiryElementRef.current?.destroy();
      cardCvcElementRef.current?.destroy();
      cardNumberElementRef.current = null;
      cardExpiryElementRef.current = null;
      cardCvcElementRef.current = null;
    };
  }, [
    selectedPayment,
    paymentConfig.stripePublishableKey,
    cardNumberMountEl,
    cardExpiryMountEl,
    cardCvcMountEl,
    stripeElementStyle,
    t,
  ]);

  // Build enabled payment methods list
  const paymentMethods: {
    value: CheckoutFormData["paymentMethod"];
    label: string;
    icon: typeof CreditCard;
    detail: string;
  }[] = [];
  if (paymentConfig.stripeEnabled && paymentConfig.stripeConfigured !== false) {
    paymentMethods.push({
      value: "card",
      label: t("checkout.card"),
      icon: CreditCard,
      detail: t("checkout.payment.cardDetailsParams"),
    });
  }
  if (paymentConfig.paypalEnabled && paymentConfig.paypalConfigured !== false) {
    paymentMethods.push({
      value: "paypal",
      label: "PayPal",
      icon: Wallet,
      detail: t("checkout.payment.paypalRedirect"),
    });
  }
  if (
    paymentConfig.razorpayEnabled &&
    paymentConfig.razorpayConfigured !== false
  ) {
    paymentMethods.push({
      value: "razorpay",
      label: "Razorpay",
      icon: Wallet,
      detail: "You will complete payment securely with Razorpay.",
    });
  }
  if (
    paymentConfig.paystackEnabled &&
    paymentConfig.paystackConfigured !== false
  ) {
    paymentMethods.push({
      value: "paystack",
      label: "Paystack",
      icon: Wallet,
      detail: "You will be redirected to Paystack to complete payment.",
    });
  }
  if (paymentConfig.codEnabled) {
    paymentMethods.push({
      value: "cod",
      label: t("checkout.cod"),
      icon: Truck,
      detail:
        paymentConfig.codInstructions ||
        t("checkout.payment.payOnDeliveryDescription"),
    });
  }

  const redirectPaymentProvider = (
    ["paypal", "razorpay", "paystack"] as const
  ).includes(selectedPayment as "paypal" | "razorpay" | "paystack")
    ? (selectedPayment as "paypal" | "razorpay" | "paystack")
    : null;
  const redirectPaymentProviderName = redirectPaymentProvider
    ? paymentMethods.find((method) => method.value === redirectPaymentProvider)
        ?.label || redirectPaymentProvider
    : "";
  const checkoutSummaryStyle = {
    "--checkout-summary-offset": `${checkoutStickyOffset}px`,
  } as CSSProperties;

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (shippingUnavailable) {
        throw new Error(SHIPPING_UNAVAILABLE_MESSAGE);
      }
      if (
        data.paymentMethod === "card" &&
        paymentConfig.stripeConfigured === false
      ) {
        throw new Error("Stripe is not configured");
      }
      if (
        data.paymentMethod === "paypal" &&
        paymentConfig.paypalConfigured === false
      ) {
        throw new Error("PayPal is not configured");
      }
      if (
        data.paymentMethod === "razorpay" &&
        paymentConfig.razorpayConfigured === false
      ) {
        throw new Error("Razorpay is not configured");
      }
      if (
        data.paymentMethod === "paystack" &&
        paymentConfig.paystackConfigured === false
      ) {
        throw new Error("Paystack is not configured");
      }
      if (data.paymentMethod === "cod" && paymentConfig.codEnabled === false) {
        throw new Error("Cash on Delivery is disabled");
      }
      if (hasPreorderItems && !preorderAccepted) {
        throw new Error("Please confirm the pre-order shipping terms");
      }

      const shippingAddress = buildCheckoutAddressPayload(
        {
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          apartment: data.apartment,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          phone: data.phone,
        },
        user?.phone || "",
      );
      const billingAddress =
        data.billingSameAsShipping === "different"
          ? buildCheckoutAddressPayload(
              {
                firstName: data.billingFirstName,
                lastName: data.billingLastName,
                address: data.billingAddress,
                apartment: data.billingApartment,
                city: data.billingCity,
                state: data.billingState,
                postalCode: data.billingPostalCode,
                country: data.billingCountry,
                phone: data.billingPhone,
              },
              shippingAddress.phone || "",
            )
          : shippingAddress;
      const checkoutAnalyticsPayload = {
        currency: currency.code,
        value: total,
        paymentMethod: data.paymentMethod,
        items: analyticsItemsFromCart(items),
      };

      saveCheckoutAnalyticsSnapshot(checkoutAnalyticsPayload);
      trackPaymentInfo(checkoutAnalyticsPayload);

      if (
        data.paymentMethod === "card" &&
        paymentConfig.stripeEnabled &&
        paymentConfig.stripeConfigured !== false &&
        paymentConfig.stripePublishableKey
      ) {
        const stripe = stripeRef.current;
        const cardNumber = cardNumberElementRef.current;
        if (!stripe || !cardNumber || !stripeElementReady) {
          throw new Error("Stripe is not ready");
        }

        const intentRes = await fetch("/api/payments/stripe/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shippingAddress,
            billingAddress,
            locale,
            email: data.email,
            couponCode: appliedCoupon?.code,
            selectedShippingOptionId,
            vendorShippingSelections: perVendorMode
              ? vendorShippingSelections
              : undefined,
            preorderAcknowledged: hasPreorderItems
              ? preorderAccepted
              : undefined,
          }),
        });
        const intentJson = await intentRes.json().catch(() => null);
        if (!intentRes.ok || !intentJson?.success) {
          throw new Error(
            intentJson?.message || "Failed to initialize card payment",
          );
        }

        const clientSecret = String(intentJson.data?.clientSecret || "");
        const paymentIntentId = String(intentJson.data?.paymentIntentId || "");
        if (!clientSecret || !paymentIntentId) {
          throw new Error("Failed to initialize card payment");
        }

        const confirm = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardNumber,
            billing_details: {
              name: cardholderName || billingAddress.fullName,
              email: data.email,
              phone: billingAddress.phone,
              address: {
                line1: billingAddress.street,
                line2: billingAddress.apartment || undefined,
                city: billingAddress.city,
                state: billingAddress.state || undefined,
                postal_code: billingAddress.postalCode,
              },
            },
          },
        });

        if (confirm.error) {
          throw new Error(confirm.error.message || "Payment failed");
        }

        const status = confirm.paymentIntent?.status;
        if (status !== "succeeded" && status !== "processing") {
          throw new Error("Payment was not completed");
        }

        router.push(
          `/${locale}/checkout/success?payment_intent=${encodeURIComponent(
            confirm.paymentIntent?.id || paymentIntentId,
          )}`,
        );
        return;
      }

      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          billingAddress,
          paymentMethod: data.paymentMethod,
          email: data.email,
          couponCode: appliedCoupon?.code,
          locale,
          selectedShippingOptionId,
          vendorShippingSelections: perVendorMode
            ? vendorShippingSelections
            : undefined,
          preorderAcknowledged: hasPreorderItems ? preorderAccepted : undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to process checkout");
      }

      if (data.paymentMethod === "cod") {
        await clearCart();
        toast.success(
          t("checkout.orderPlaced"),
        );
        router.push(
          result.data.redirectUrl ||
            `/${locale}/checkout/success?order=${result.data.orderNumber}`,
        );
        return;
      }

      if (data.paymentMethod === "razorpay") {
        const payload = result.data || {};
        const keyId = String(payload.keyId || "");
        const razorpayOrderId = String(payload.razorpayOrderId || "");
        const amount = Number(payload.amount || 0);
        const checkoutCurrency = String(
          payload.currency || currency.code || "INR",
        );

        if (!keyId || !razorpayOrderId || !amount) {
          throw new Error("Failed to initialize Razorpay payment");
        }

        await loadRazorpayCheckoutScript();
        const Razorpay = window.Razorpay;
        if (!Razorpay) {
          throw new Error("Razorpay checkout is unavailable");
        }

        const checkoutResponse = await new Promise<RazorpayCheckoutResponse>(
          (resolve, reject) => {
            let settled = false;
            const razorpay = new Razorpay({
              key: keyId,
              amount,
              currency: checkoutCurrency,
              name: String(payload.name || "Store"),
              description: String(payload.description || "Order payment"),
              order_id: razorpayOrderId,
              prefill: {
                name: shippingAddress.fullName,
                email: data.email,
                contact: shippingAddress.phone,
              },
              notes: {
                orderNumber: String(payload.orderNumber || ""),
              },
              handler: (response) => {
                settled = true;
                resolve(response);
              },
              modal: {
                ondismiss: () => {
                  if (!settled) {
                    reject(
                      new Error("Payment was canceled. Please try again."),
                    );
                  }
                },
              },
            });

            razorpay.on("payment.failed", (response) => {
              settled = true;
              reject(
                new Error(
                  response.error?.description ||
                    response.error?.reason ||
                    "Razorpay payment failed",
                ),
              );
            });

            razorpay.open();
          },
        );

        const verifyRes = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkoutResponse),
        });
        const verifyJson = await verifyRes.json().catch(() => null);

        if (!verifyRes.ok || !verifyJson?.success) {
          throw new Error(
            verifyJson?.message || "Failed to verify Razorpay payment",
          );
        }

        await clearCart();
        toast.success(
          t("checkout.orderPlaced"),
        );
        router.push(
          `/${locale}/checkout/success?order=${verifyJson.data.orderNumber}`,
        );
        return;
      }

      if (result.data.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error("Failed to create payment session");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message || t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">
          {t("cart.emptyCart")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {t("checkout.emptyCartMessage")}
        </p>
        <Button asChild>
          <Link href={`/${locale}/products`}>
            {t("common.shopNow")}
          </Link>
        </Button>
      </div>
    );
  }

  // Helper to render a floating label input field
  const renderFloatingField = (
    name: keyof CheckoutFormData,
    label: string,
    type = "text",
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-0">
          <div className="relative">
            <FormControl>
              <Input
                {...field}
                type={type}
                placeholder=" "
                className={floatingInputClass}
              />
            </FormControl>
            <label className={floatingLabelClass}>{label}</label>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  const billingAddressMode = form.watch("billingSameAsShipping");

  return (
    <div className="min-h-screen bg-background">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mx-auto  lg:grid lg:grid-cols-2">
            {/* Left column - Form */}
            <div className="px-4 py-8 lg:px-10 lg:py-12 lg:pr-16">
              <div className="max-w-[480px] mx-auto lg:mx-0 lg:ml-auto">
                {error ? (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-8">
                  {/* Contact Section */}
                  <section className="space-y-4 border-b pb-6">
                    {!isAuthenticated && (
                      <div className="space-y-1">
                        <h2 className="text-xl font-semibold tracking-tight">
                          Checkout as Guest
                        </h2>
                        <p className="text-muted-foreground text-sm">
                          {t("common.or")}{" "}
                          <Link
                            href={`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/checkout`)}`}
                            className="font-medium text-foreground underline underline-offset-4"
                          >
                            Log in
                          </Link>{" "}
                          for faster checkout
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Contact details</h3>
                      {isAuthenticated && contactLabel ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {user?.image ? (
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                                <AppImage
                                  src={user.image}
                                  alt={user.name || ""}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                                {contactInitial}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm text-muted-foreground">
                                {contactLabel}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto px-0 text-base underline underline-offset-4"
                            onClick={async () => {
                              await signOut();
                              window.location.reload();
                            }}
                          >
                            {t("common.logout")}
                          </Button>
                        </div>
                      ) : (
                        renderFloatingField("email", "Email", "email")
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id="checkout-newsletter"
                          checked={emailMarketingOptIn}
                          onCheckedChange={(checked) =>
                            setEmailMarketingOptIn(checked === true)
                          }
                        />
                        <Label
                          htmlFor="checkout-newsletter"
                          className="cursor-pointer text-sm font-normal"
                        >
                          Email me with news and others
                        </Label>
                      </div>
                    </div>
                  </section>

                  {/* Delivery Section */}
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold">
                      {t("checkout.delivery")}
                    </h2>

                    <div className="space-y-3">
                      {/* Country Select */}
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem className="w-full space-y-0">
                            <div className="relative w-full">
                              <CountrySelect
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder=" "
                                searchPlaceholder={t("checkout.searchCountry")}
                                triggerClassName="h-14 rounded-lg pt-6 pb-2 items-end [&>span]:text-base"
                              />
                              <span className="pointer-events-none absolute left-3 top-2 text-xs text-muted-foreground z-10">
                                {t("checkout.country")}
                              </span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        {renderFloatingField(
                          "firstName",
                          t("checkout.firstName"),
                        )}
                        {renderFloatingField(
                          "lastName",
                          t("checkout.lastName"),
                        )}
                      </div>

                      {/* Address */}
                      {renderFloatingField(
                        "address",
                        t("checkout.address"),
                      )}

                      {/* Apartment */}
                      {renderFloatingField(
                        "apartment",
                        t("checkout.apartment"),
                      )}

                      {/* City + Postal code */}
                      <div className="grid grid-cols-2 gap-3">
                        {renderFloatingField(
                          "city",
                          t("checkout.city"),
                        )}
                        {renderFloatingField(
                          "postalCode",
                          t("checkout.postalCode"),
                        )}
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Shipping Method */}
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold">
                      {t("checkout.shippingMethod")}
                    </h2>
                    <div className="space-y-2">
                      {shippingUnavailable ? (
                        <div
                          role="alert"
                          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
                        >
                          {t("checkout.shippingUnavailable", {
                            defaultMessage: SHIPPING_UNAVAILABLE_MESSAGE,
                          })}
                        </div>
                      ) : perVendorMode ? (
                        vendorRateGroups.map((group) => {
                          const selectedId =
                            vendorShippingSelections[group.vendorId] ??
                            group.selectedOptionId;
                          return (
                            <div key={group.vendorId} className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                {group.vendorName}
                              </p>
                              {group.options.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {t("checkout.noShippingRates")}
                                </p>
                              ) : (
                                group.options.map((option) => {
                                  const checked = selectedId === option.id;
                                  return (
                                    <label
                                      key={option.id}
                                      className={cn(
                                        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4 text-sm transition-colors hover:bg-muted/40",
                                        checked
                                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                                          : "border-border",
                                      )}
                                    >
                                      <span className="flex items-center gap-3">
                                        <input
                                          type="radio"
                                          name={`shippingOption-${group.vendorId}`}
                                          className="accent-primary"
                                          checked={checked}
                                          onChange={() =>
                                            setVendorShippingSelections(
                                              (prev) => ({
                                                ...prev,
                                                [group.vendorId]: option.id,
                                              }),
                                            )
                                          }
                                        />
                                        <span>
                                          <span className="font-medium">
                                            {option.name}
                                          </span>
                                          {option.deliveryDays ? (
                                            <span className="block text-xs text-muted-foreground">
                                              {option.deliveryDays.min}-
                                              {option.deliveryDays.max}{" "}
                                              {t("checkout.days")}
                                            </span>
                                          ) : null}
                                        </span>
                                      </span>
                                      <span className="font-semibold">
                                        {option.cost > 0
                                          ? formatPrice(option.cost)
                                          : t("checkout.free")}
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          );
                        })
                      ) : shippingOptions.length > 1 ? (
                        shippingOptions.map((option) => {
                          const checked =
                            (selectedShippingOptionId ??
                              shippingResult.selectedOptionId) === option.id;
                          return (
                            <label
                              key={option.id}
                              className={cn(
                                "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4 text-sm transition-colors hover:bg-muted/40",
                                checked
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border",
                              )}
                            >
                              <span className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="shippingOption"
                                  className="accent-primary"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedShippingOptionId(option.id)
                                  }
                                />
                                <span>
                                  <span className="font-medium">
                                    {option.name}
                                  </span>
                                  {option.deliveryDays ? (
                                    <span className="block text-xs text-muted-foreground">
                                      {option.deliveryDays.min}-
                                      {option.deliveryDays.max}{" "}
                                      {t("checkout.days")}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                              <span className="font-semibold">
                                {option.cost > 0
                                  ? formatPrice(option.cost)
                                  : t("checkout.free")}
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-4 w-4 rounded-full border-4 border-primary bg-primary" />
                            <span className="text-sm text-muted-foreground">
                              {shippingMethodName ||
                                t("checkout.standardShipping")}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {shippingDiscount > 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="line-through">
                                  {formatPrice(shippingCost)}
                                </span>
                                <span>
                                  {discountedShippingCost === 0
                                    ? t("common.free")
                                    : formatPrice(discountedShippingCost)}
                                </span>
                              </span>
                            ) : discountedShippingCost === 0 ? (
                              t("common.free")
                            ) : (
                              formatPrice(discountedShippingCost)
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Payment */}
                  <section className="space-y-4">
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold">
                        {t("checkout.paymentMethod")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        All transactions are secure and encrypted.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="gap-0 overflow-hidden rounded-lg border bg-background"
                            >
                              {paymentMethods.map((method, index) => {
                                const isSelected = field.value === method.value;
                                const isCard =
                                  method.value === "card" &&
                                  paymentConfig.stripeEnabled &&
                                  paymentConfig.stripeConfigured !== false &&
                                  paymentConfig.stripePublishableKey;

                                return (
                                  <div
                                    key={method.value}
                                    className={cn(
                                      index > 0 && "border-t",
                                      isSelected && "bg-background",
                                    )}
                                  >
                                    <Label
                                      htmlFor={`pm_${method.value}`}
                                      className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
                                    >
                                      <RadioGroupItem
                                        value={method.value}
                                        id={`pm_${method.value}`}
                                        className="size-4 shrink-0 border-muted-foreground/30"
                                      />
                                      <span className="min-w-0 flex-1">
                                        {method.label}
                                      </span>
                                      <method.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </Label>

                                    {isSelected ? (
                                      isCard ? (
                                        <div className="space-y-3 border-t bg-muted/20 px-4 py-4">
                                          <h3 className="text-base font-semibold">
                                            {t("checkout.cardDetails")}
                                          </h3>
                                          <div
                                            className="relative cursor-text"
                                            onClick={() =>
                                              cardNumberElementRef.current?.focus()
                                            }
                                          >
                                            <div
                                              ref={setCardNumberMountEl}
                                              className="dark:bg-input/30 border-input min-h-11 rounded-md border bg-background px-4 py-3 pr-4 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] sm:pr-36"
                                            />
                                            <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 sm:flex">
                                              <span className="inline-flex h-5 min-w-8 items-center justify-center rounded-[3px] border bg-white px-1 text-[9px] font-bold leading-none text-blue-700 shadow-xs">
                                                VISA
                                              </span>
                                              <span className="inline-flex h-5 min-w-8 items-center justify-center rounded-[3px] border bg-white px-1 shadow-xs">
                                                <span className="h-3 w-3 rounded-full bg-red-500" />
                                                <span className="-ml-1 h-3 w-3 rounded-full bg-amber-400" />
                                              </span>
                                              <span className="inline-flex h-5 min-w-8 items-center justify-center rounded-[3px] border bg-white px-1 text-[8px] font-bold leading-none text-cyan-700 shadow-xs">
                                                AMEX
                                              </span>
                                              <span className="inline-flex h-5 min-w-8 items-center justify-center rounded-[3px] border bg-white px-1 text-[8px] font-bold leading-none text-orange-700 shadow-xs">
                                                DISC
                                              </span>
                                            </div>
                                          </div>

                                          <div className="grid gap-2 sm:grid-cols-2">
                                            <div
                                              className="relative cursor-text"
                                              onClick={() =>
                                                cardExpiryElementRef.current?.focus()
                                              }
                                            >
                                              <div
                                                ref={setCardExpiryMountEl}
                                                className="dark:bg-input/30 border-input min-h-11 rounded-md border bg-background px-4 py-3 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
                                              />
                                            </div>

                                            <div
                                              className="relative cursor-text"
                                              onClick={() =>
                                                cardCvcElementRef.current?.focus()
                                              }
                                            >
                                              <div
                                                ref={setCardCvcMountEl}
                                                className="dark:bg-input/30 border-input min-h-11 rounded-md border bg-background px-4 py-3 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
                                              />
                                              <CreditCard className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                                            </div>
                                          </div>

                                          <Input
                                            value={cardholderName}
                                            onChange={(e) =>
                                              setCardholderName(e.target.value)
                                            }
                                            placeholder={t(
                                              "payment.cardHolder",
                                            )}
                                            className="h-11 rounded-md px-4 text-[15px]"
                                          />

                                          {stripeElementError ? (
                                            <div className="text-sm text-destructive">
                                              {stripeElementError}
                                            </div>
                                          ) : null}
                                          {!stripeElementReady ? (
                                            <div className="text-sm text-muted-foreground">
                                              {t("common.loading")}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <div className="border-t bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
                                          {method.detail}
                                        </div>
                                      )
                                    ) : null}
                                  </div>
                                );
                              })}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </section>

                  {/* Billing Address */}
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold">
                      {t("checkout.billingAddress")}
                    </h2>
                    <FormField
                      control={form.control}
                      name="billingSameAsShipping"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <div className="rounded-lg border overflow-hidden">
                                <div
                                  className={cn(
                                    "flex items-center gap-3 p-4 transition-colors",
                                    field.value === "same" && "bg-accent",
                                  )}
                                >
                                  <RadioGroupItem value="same" id="bill_same" />
                                  <Label
                                    htmlFor="bill_same"
                                    className="cursor-pointer font-normal"
                                  >
                                    {t("checkout.billingSame")}
                                  </Label>
                                </div>
                                <div className="border-t" />
                                <div
                                  className={cn(
                                    "flex items-center gap-3 p-4 transition-colors",
                                    field.value === "different" && "bg-accent",
                                  )}
                                >
                                  <RadioGroupItem
                                    value="different"
                                    id="bill_diff"
                                  />
                                  <Label
                                    htmlFor="bill_diff"
                                    className="cursor-pointer font-normal"
                                  >
                                    {t("checkout.billingDifferent")}
                                  </Label>
                                </div>
                                {billingAddressMode === "different" ? (
                                  <div className="space-y-3 border-t bg-background p-4">
                                    <FormField
                                      control={form.control}
                                      name="billingCountry"
                                      render={({ field }) => (
                                        <FormItem className="w-full space-y-0">
                                          <div className="relative w-full">
                                            <CountrySelect
                                              value={field.value || ""}
                                              onChange={field.onChange}
                                              placeholder=" "
                                              searchPlaceholder={t(
                                                "checkout.searchCountry",
                                              )}
                                              triggerClassName="h-14 rounded-lg pt-6 pb-2 items-end [&>span]:text-base"
                                            />
                                            <span className="pointer-events-none absolute left-3 top-2 z-10 text-xs text-muted-foreground">
                                              {t("checkout.country")}
                                            </span>
                                          </div>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <div className="grid grid-cols-2 gap-3">
                                      {renderFloatingField(
                                        "billingFirstName",
                                        t("checkout.firstName"),
                                      )}
                                      {renderFloatingField(
                                        "billingLastName",
                                        t("checkout.lastName"),
                                      )}
                                    </div>

                                    {renderFloatingField(
                                      "billingAddress",
                                      t("checkout.address"),
                                    )}
                                    {renderFloatingField(
                                      "billingApartment",
                                      t("checkout.apartment"),
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                      {renderFloatingField(
                                        "billingCity",
                                        t("checkout.city"),
                                      )}
                                      {renderFloatingField(
                                        "billingPostalCode",
                                        t("checkout.postalCode"),
                                      )}
                                    </div>

                                    {renderFloatingField(
                                      "billingPhone",
                                      t("checkout.phone"),
                                      "tel",
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </section>

                  {hasPreorderItems && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="checkout-preorder-ack"
                          checked={preorderAccepted}
                          onCheckedChange={(checked) =>
                            setPreorderAccepted(checked === true)
                          }
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor="checkout-preorder-ack"
                          className="cursor-pointer text-sm font-normal leading-5 text-blue-900 dark:text-blue-100"
                        >
                          {preorderDateLabel
                            ? `I understand this cart contains pre-order items expected to ship on or around ${preorderDateLabel}.`
                            : "I understand this cart contains pre-order items that will ship when released."}{" "}
                          {preorderOutstandingAmount > 0
                            ? `Due today: ${formatPrice(preorderDueNow)}. Due before shipping: ${formatPrice(preorderOutstandingAmount)}.`
                            : ""}
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full h-12 gap-2 text-base"
                    size="lg"
                    disabled={isSubmitting || shippingUnavailable}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("common.loading")}
                      </>
                    ) : redirectPaymentProvider ? (
                      <>
                        <PaymentProviderLogo
                          provider={redirectPaymentProvider}
                        />
                        <span>Continue with {redirectPaymentProviderName}</span>
                      </>
                    ) : (
                      t("checkout.completeOrder")
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right column - Order Summary */}
            <aside className="border-t bg-zinc-50 px-4 py-8 lg:border-t-0 lg:px-12 lg:py-12 dark:bg-background">
              <div
                className="mx-auto max-w-[440px] lg:sticky lg:top-[var(--checkout-summary-offset)] lg:mx-0 lg:max-h-[calc(100dvh-var(--checkout-summary-offset)-1rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
                style={checkoutSummaryStyle}
              >
                <div className="space-y-6">
                  {/* Order summary header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("checkout.orderSummary")}
                    </h3>
                    <Link
                      href={`/${locale}/cart`}
                      className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {t("checkout.editCart")}
                    </Link>
                  </div>

                  {/* Summary rows */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("common.subtotal")}
                      </span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    {discount > 0 ? (
                      <div className="flex items-center justify-between text-green-700 dark:text-green-400">
                        <span>
                          {t("checkout.discount")}
                          {appliedCoupon ? ` (${appliedCoupon.code})` : ""}
                        </span>
                        <span>-{formatPrice(discount)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("common.shipping")}
                      </span>
                      <span>
                        {shippingDiscount > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-muted-foreground line-through">
                              {formatPrice(shippingCost)}
                            </span>
                            <span>
                              {discountedShippingCost === 0
                                ? t("common.free")
                                : formatPrice(discountedShippingCost)}
                            </span>
                          </span>
                        ) : discountedShippingCost === 0 ? (
                          t("common.free")
                        ) : (
                          formatPrice(discountedShippingCost)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("checkout.estimatedTax")}
                      </span>
                      <span>{formatPrice(tax)}</span>
                    </div>
                    {hasPreorderItems && preorderOutstandingAmount > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-blue-700 dark:text-blue-300">
                          <span>Pre-order due today</span>
                          <span>{formatPrice(preorderDueNow)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Due before shipping</span>
                          <span>{formatPrice(preorderOutstandingAmount)}</span>
                        </div>
                      </>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t("checkout.promoCode")}
                      </span>
                      {!appliedCoupon ? (
                        <span className="text-sm text-muted-foreground">
                          {t("checkout.enterCode")}
                        </span>
                      ) : null}
                    </div>
                    <CouponInput
                      cartItems={couponCartItems}
                      subtotal={subtotal}
                      shippingCost={shippingCost}
                      appliedCoupon={appliedCouponForDisplay}
                      onApply={(coupon) => setAppliedCoupon(coupon)}
                      onRemove={() => setAppliedCoupon(null)}
                    />
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">
                      {t("common.total")}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-muted-foreground uppercase">
                        {currency.code}
                      </span>
                      <span className="text-2xl font-bold">
                        {formatPrice(total).replace(/[^\d.,]/g, "")}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Cart items */}
                  <div className="space-y-5">
                    {items.map((item) => {
                      const checkoutItem = item as CheckoutCartItem;
                      const rawVariant =
                        checkoutItem.variantLabel ||
                        (item.name.includes(" - ")
                          ? item.name.split(" - ").slice(1).join(" - ")
                          : "");

                      // Split by common separators and process each part
                      const variantParts = String(rawVariant)
                        .split(/[,|/]/)
                        .map((part) => part.trim())
                        .filter(Boolean);

                      // Check for sale price
                      const compareAtPrice =
                        typeof checkoutItem.compareAtPrice === "number"
                          ? checkoutItem.compareAtPrice
                          : null;
                      const hasDiscount =
                        compareAtPrice !== null && compareAtPrice > item.price;
                      const originalLinePrice =
                        hasDiscount && compareAtPrice !== null
                          ? compareAtPrice * item.quantity
                          : null;

                      return (
                        <div
                          key={`${item.productId}-${item.variantId || ""}`}
                          className="flex items-start gap-4"
                        >
                          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-muted">
                            {item.image ? (
                              <AppImage
                                src={item.image}
                                alt={item.name}
                                fill
                                className="object-cover"
                              />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug mb-1">
                              {item.name.split(" - ")[0]}
                            </p>
                            <div className="space-y-0.5 text-xs text-muted-foreground">
                              {checkoutItem.purchaseType === "preorder" ? (
                                <>
                                  <p className="font-medium text-blue-600 dark:text-blue-300">
                                    {formatPreorderDate(
                                      checkoutItem.preorderReleaseDate,
                                    )
                                      ? `Pre-order - ships around ${formatPreorderDate(
                                          checkoutItem.preorderReleaseDate,
                                        )}`
                                      : "Pre-order"}
                                  </p>
                                  {Number(
                                    checkoutItem.preorderOutstandingAmount || 0,
                                  ) > 0 ? (
                                    <p>
                                      Due now{" "}
                                      {formatPrice(
                                        Number(
                                          checkoutItem.preorderDepositAmount ||
                                            0,
                                        ),
                                      )}{" "}
                                      / later{" "}
                                      {formatPrice(
                                        Number(
                                          checkoutItem.preorderOutstandingAmount ||
                                            0,
                                        ),
                                      )}
                                    </p>
                                  ) : null}
                                </>
                              ) : null}
                              {variantParts.map((part, idx) => (
                                <p key={`${item.productId}-variant-${idx}`}>
                                  {part}
                                </p>
                              ))}
                              <p>Qty: {item.quantity}</p>
                            </div>
                            <div className="mt-1">
                              {hasDiscount ? (
                                <p className="text-sm">
                                  <span className="text-muted-foreground line-through mr-1.5">
                                    {formatPrice(originalLinePrice || 0)}
                                  </span>
                                  <span className="font-semibold text-rose-500">
                                    {formatPrice(item.price * item.quantity)}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-sm font-semibold">
                                  {formatPrice(item.price * item.quantity)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {customsDutyAmount > 0 ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("checkout.estimatedDuties")}
                      </span>
                      <span>{formatPrice(customsDutyAmount)}</span>
                    </div>
                  ) : null}

                  {deliveryEstimate ? (
                    <div className="text-xs text-muted-foreground">
                      {t("checkout.estimatedDelivery")}
                      : {deliveryEstimate.min}-{deliveryEstimate.max}{" "}
                      {t("checkout.days")}
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </form>
      </Form>
    </div>
  );
}
