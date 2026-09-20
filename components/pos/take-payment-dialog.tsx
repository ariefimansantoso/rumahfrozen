"use client";

import * as React from "react";
import {
  loadStripe,
  type Stripe,
  type StripeCardCvcElement,
  type StripeCardExpiryElement,
  type StripeCardNumberElement,
  type StripeElements,
} from "@stripe/stripe-js";
import { useTranslations } from "next-intl";
import {
  X,
  Banknote,
  CreditCard,
  Building2,
  Loader2,
  CheckCircle2,
  Tag,
  Nfc,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createStripeElementStyle } from "@/components/checkout/checkout-helpers";
import { cn } from "@/lib/utils";
import type { POSSettings } from "@/lib/pos/build-pos-settings";
import type { POSDiscount } from "@/components/pos/discount-dialog";

type PaymentMethodId = "cash" | "card" | "bank" | "manual";
type CardSubMethod = "touch" | "stripe";

interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

interface CardSubOption {
  id: CardSubMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface POSTakePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  itemCount: number;
  discount: POSDiscount | null;
  onProcess: (
    method: string,
    cashTendered: number,
    reference?: string,
    note?: string,
    stripePaymentIntentId?: string,
  ) => Promise<void> | void;
  onCreateStripeIntent: () => Promise<{
    paymentIntentId: string;
    clientSecret: string;
  }>;
  isProcessing: boolean;
  processingMethod: string | null;
  settings: POSSettings;
  fp: (amount: number) => string;
}

/**
 * Standard cash denominations (in major currency units) used to build
 * dynamic quick-amount suggestions for the cash payment flow. The list is
 * intentionally broad so the dialog adapts to both small and large totals.
 */
const QUICK_CASH_DENOMINATIONS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
];

/**
 * Build a dynamic list of quick-amount suggestions based on the order
 * total. The first entry is always the exact total (so the cashier can
 * charge the precise amount). The remaining entries are the next three
 * standard cash denominations greater than the total, so the customer can
 * hand over a common bill/note and receive change.
 *
 * @example
 *   getQuickCashAmounts(286)    // -> [286, 500, 1000, 2000]
 *   getQuickCashAmounts(50.25)  // -> [50.25, 100, 200, 500]
 *   getQuickCashAmounts(5.5)    // -> [5.5, 10, 20, 50]
 *   getQuickCashAmounts(100)    // -> [100, 200, 500, 1000]
 */
function getQuickCashAmounts(total: number): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const exact = Math.round(total * 100) / 100;
  const above = QUICK_CASH_DENOMINATIONS.filter((d) => d > total).slice(0, 3);
  // Dedupe in case total is exactly a denomination and also used for `exact`.
  const set = new Set<number>([exact, ...above]);
  return Array.from(set).sort((a, b) => a - b);
}

export function POSTakePaymentDialog({
  open,
  onOpenChange,
  total,
  itemCount,
  discount,
  onProcess,
  onCreateStripeIntent,
  isProcessing,
  processingMethod,
  settings,
  fp,
}: POSTakePaymentDialogProps) {
  const t = useTranslations();
  const [selectedMethod, setSelectedMethod] =
    React.useState<PaymentMethodId>("cash");
  const [cardSubMethod, setCardSubMethod] =
    React.useState<CardSubMethod>("touch");
  const [cashTendered, setCashTendered] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [stripeElementReady, setStripeElementReady] = React.useState(false);
  const [stripeElementError, setStripeElementError] = React.useState<
    string | null
  >(null);
  const [stripeProcessing, setStripeProcessing] = React.useState(false);
  const [cardNumberMountEl, setCardNumberMountEl] =
    React.useState<HTMLDivElement | null>(null);
  const [cardExpiryMountEl, setCardExpiryMountEl] =
    React.useState<HTMLDivElement | null>(null);
  const [cardCvcMountEl, setCardCvcMountEl] =
    React.useState<HTMLDivElement | null>(null);
  const stripeRef = React.useRef<Stripe | null>(null);
  const stripeElementsRef = React.useRef<StripeElements | null>(null);
  const cardNumberElementRef =
    React.useRef<StripeCardNumberElement | null>(null);
  const cardExpiryElementRef =
    React.useRef<StripeCardExpiryElement | null>(null);
  const cardCvcElementRef = React.useRef<StripeCardCvcElement | null>(null);
  const stripeElementStyle = React.useMemo(
    () => createStripeElementStyle(false),
    [],
  );

  const CARD_SUB_OPTIONS: CardSubOption[] = React.useMemo(
    () => [
      {
        id: "touch",
        label: "Touch",
        description: "Tap or insert card on reader",
        icon: <Nfc className="h-4 w-4" />,
      },
      {
        id: "stripe",
        label: "Stripe",
        description: "Card details form",
        icon: <Wallet className="h-4 w-4" />,
      },
    ],
    [],
  );

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedMethod("cash");
      setCardSubMethod("touch");
      setCashTendered("");
      setReference("");
      setStripeElementError(null);
    }
  }, [open]);

  // Available payment methods based on settings
  const methods: PaymentMethodOption[] = React.useMemo(() => {
    const list: PaymentMethodOption[] = [];
    if (settings.paymentMethods.includes("cash")) {
      list.push({
        id: "cash",
        label: t("pos.cash"),
        description: "With change",
        icon: <Banknote className="h-5 w-5" />,
        accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      });
    }
    if (settings.paymentMethods.includes("card")) {
      list.push({
        id: "card",
        label: "Card",
        description: "Touch or Stripe",
        icon: <CreditCard className="h-5 w-5" />,
        accent: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
      });
    }
    if (settings.paymentMethods.includes("bank")) {
      list.push({
        id: "bank",
        label: "Bank Transfer",
        description: "With reference",
        icon: <Building2 className="h-5 w-5" />,
        accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      });
    }
    if (settings.paymentMethods.includes("manual")) {
      list.push({
        id: "manual",
        label: t("pos.manual"),
        description: "Custom method",
        icon: <Tag className="h-5 w-5" />,
        accent: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
      });
    }
    return list;
  }, [settings.paymentMethods, t]);

  // Make sure selected method is valid
  React.useEffect(() => {
    if (!methods.find((m) => m.id === selectedMethod) && methods.length > 0) {
      setSelectedMethod(methods[0].id);
    }
  }, [methods, selectedMethod]);

  React.useEffect(() => {
    const publishableKey = settings.stripe?.publishableKey;
    const shouldMountStripe =
      open &&
      selectedMethod === "card" &&
      cardSubMethod === "stripe" &&
      Boolean(publishableKey);

    if (!shouldMountStripe) {
      setStripeElementReady(false);
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

    if (!cardNumberMountEl || !cardExpiryMountEl || !cardCvcMountEl) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const stripe = await loadStripe(publishableKey as string);
        if (!active) return;
        if (!stripe) {
          setStripeElementError("Stripe is not configured");
          setStripeElementReady(false);
          return;
        }

        cardNumberElementRef.current?.destroy();
        cardExpiryElementRef.current?.destroy();
        cardCvcElementRef.current?.destroy();

        const elements = stripe.elements();
        const cardNumber = elements.create("cardNumber", {
          style: stripeElementStyle,
          showIcon: false,
          placeholder: "1234 1234 1234 1234",
        });
        const cardExpiry = elements.create("cardExpiry", {
          style: stripeElementStyle,
          placeholder: "MM / YY",
        });
        const cardCvc = elements.create("cardCvc", {
          style: stripeElementStyle,
          placeholder: "CVC",
        });

        cardNumber.on("change", (event) => {
          setStripeElementError(event.error?.message || null);
        });
        cardExpiry.on("change", (event) => {
          setStripeElementError(event.error?.message || null);
        });
        cardCvc.on("change", (event) => {
          setStripeElementError(event.error?.message || null);
        });

        if (!active) {
          cardNumber.destroy();
          cardExpiry.destroy();
          cardCvc.destroy();
          return;
        }

        stripeRef.current = stripe;
        stripeElementsRef.current = elements;
        cardNumber.mount(cardNumberMountEl);
        cardExpiry.mount(cardExpiryMountEl);
        cardCvc.mount(cardCvcMountEl);
        cardNumberElementRef.current = cardNumber;
        cardExpiryElementRef.current = cardExpiry;
        cardCvcElementRef.current = cardCvc;
        setStripeElementReady(true);
        setStripeElementError(null);
      } catch (error) {
        if (!active) return;
        setStripeElementReady(false);
        setStripeElementError(
          error instanceof Error ? error.message : "Failed to load Stripe",
        );
      }
    })();

    return () => {
      active = false;
      cardNumberElementRef.current?.destroy();
      cardExpiryElementRef.current?.destroy();
      cardCvcElementRef.current?.destroy();
      cardNumberElementRef.current = null;
      cardExpiryElementRef.current = null;
      cardCvcElementRef.current = null;
    };
  }, [
    cardCvcMountEl,
    cardExpiryMountEl,
    cardNumberMountEl,
    cardSubMethod,
    open,
    selectedMethod,
    settings.stripe?.publishableKey,
    stripeElementStyle,
  ]);

  // Dynamic quick-amount suggestions based on the order total
  const quickAmounts = React.useMemo(
    () => getQuickCashAmounts(total),
    [total],
  );

  const cash = parseFloat(cashTendered) || 0;
  const change = Math.max(0, cash - total);
  const cashShort = selectedMethod === "cash" && cash < total;

  if (!open) return null;

  const handleConfirm = async () => {
    if (selectedMethod === "cash" && cashShort) return;

    if (selectedMethod === "card" && cardSubMethod === "stripe") {
      if (!settings.stripe?.enabled || !settings.stripe.configured) {
        setStripeElementError("Stripe is not configured");
        return;
      }
      const stripe = stripeRef.current;
      const cardNumber = cardNumberElementRef.current;
      if (!stripe || !cardNumber || !stripeElementReady) {
        setStripeElementError("Stripe is not ready");
        return;
      }

      setStripeProcessing(true);
      setStripeElementError(null);
      try {
        const intent = await onCreateStripeIntent();
        const confirmation = await stripe.confirmCardPayment(
          intent.clientSecret,
          {
            payment_method: {
              card: cardNumber,
            },
          },
        );

        if (confirmation.error) {
          throw new Error(confirmation.error.message || "Payment failed");
        }

        const status = confirmation.paymentIntent?.status;
        if (status !== "succeeded" && status !== "processing") {
          throw new Error("Payment was not completed");
        }

        const paymentIntentId =
          confirmation.paymentIntent?.id || intent.paymentIntentId;
        await onProcess(
          "card_stripe",
          total,
          paymentIntentId,
          undefined,
          paymentIntentId,
        );
      } catch (error) {
        setStripeElementError(
          error instanceof Error ? error.message : "Stripe payment failed",
        );
      } finally {
        setStripeProcessing(false);
      }
      return;
    }

    // Tag the method with the card sub-method when applicable
    const methodToSend =
      selectedMethod === "card"
        ? cardSubMethod === "touch"
          ? "card_touch"
          : "card_stripe"
        : selectedMethod;
    await onProcess(
      methodToSend,
      selectedMethod === "cash" ? cash : total,
      reference.trim() || undefined,
    );
  };

  const isCurrentlyProcessing = isProcessing || stripeProcessing;
  const stripeConfigured = Boolean(
    settings.stripe?.enabled &&
      settings.stripe.configured &&
      settings.stripe.publishableKey,
  );
  const stripeDisabled =
    selectedMethod === "card" &&
    cardSubMethod === "stripe" &&
    (!stripeConfigured || !stripeElementReady);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCurrentlyProcessing) {
          onOpenChange(false);
        }
      }}
    >
      <div className="bg-background w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Take payment
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Draft · {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={isCurrentlyProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-[260px_1fr]">
          {/* Methods list */}
          <div className="border-b sm:border-b-0 sm:border-r">
            <div className="p-2">
              {methods.map((m) => {
                const active = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethod(m.id)}
                    disabled={isCurrentlyProcessing}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active
                        ? "bg-muted"
                        : "hover:bg-muted/60",
                      isCurrentlyProcessing && "opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        m.accent,
                      )}
                    >
                      {m.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {m.description}
                      </p>
                    </div>
                    {active ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right side: amount + reference */}
          <div className="space-y-5 p-6">
            {/* Total due */}
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total due
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {fp(total)}
              </span>
            </div>

            {/* Discount note */}
            {discount ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                <Tag className="h-3.5 w-3.5" />
                <span>
                  {discount.type === "percent"
                    ? `${discount.value}% discount applied`
                    : `${fp(discount.value)} discount applied`}
                </span>
              </div>
            ) : null}

            {/* Cash input */}
            {selectedMethod === "cash" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Cash given
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder={total.toFixed(2)}
                      className="h-12 rounded-xl pl-8 pr-4 text-base font-semibold"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Dynamic quick amounts: exact total + next 3 cash denominations */}
                {quickAmounts.length > 0 ? (
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(4, quickAmounts.length)}, minmax(0, 1fr))`,
                    }}
                  >
                    {quickAmounts.map((amt) => {
                      const isExact = Math.abs(amt - total) < 0.005;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashTendered(amt.toFixed(2))}
                          className={cn(
                            "h-10 rounded-xl border text-sm font-medium tabular-nums transition-colors",
                            isExact
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 hover:border-primary/50 hover:bg-primary/5",
                          )}
                        >
                          {fp(amt)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* Change due */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    {cashShort ? "Still owed" : "Change due"}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      cashShort
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {fp(cashShort ? total - cash : change)}
                  </span>
                </div>
              </>
            ) : null}

            {/* Card sub-options (Touch / Stripe) */}
            {selectedMethod === "card" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {CARD_SUB_OPTIONS.map((opt) => {
                    const active = cardSubMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCardSubMethod(opt.id)}
                        disabled={isCurrentlyProcessing}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                          active
                            ? "border-blue-500/50 bg-blue-50/60 ring-1 ring-blue-500/30 dark:bg-blue-950/30"
                            : "border-border/60 hover:border-blue-300 hover:bg-blue-50/30",
                          isCurrentlyProcessing && "opacity-60",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-md",
                              active
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {opt.icon}
                          </div>
                          {active ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          ) : null}
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">
                            {opt.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {cardSubMethod === "touch" ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border-2 border-dashed border-blue-300/60 bg-blue-50/40 px-4 py-6 text-center dark:border-blue-800/50 dark:bg-blue-950/20">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                        <Nfc className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-pulse" />
                      </div>
                      <p className="mt-3 text-sm font-semibold">
                        Ready for tap or insert
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Customer taps or inserts their card on the reader.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Reference (optional)
                      </label>
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Transaction ID, auth code, etc."
                        className="h-11 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Card number
                      </label>
                      <div
                        className="relative cursor-text"
                        onClick={() => cardNumberElementRef.current?.focus()}
                      >
                        <div
                          ref={setCardNumberMountEl}
                          className="min-h-11 rounded-xl border bg-background px-4 py-3 text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Expiry
                        </label>
                        <div
                          className="relative cursor-text"
                          onClick={() => cardExpiryElementRef.current?.focus()}
                        >
                          <div
                            ref={setCardExpiryMountEl}
                            className="min-h-11 rounded-xl border bg-background px-4 py-3 text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          CVC
                        </label>
                        <div
                          className="relative cursor-text"
                          onClick={() => cardCvcElementRef.current?.focus()}
                        >
                          <div
                            ref={setCardCvcMountEl}
                            className="min-h-11 rounded-xl border bg-background px-4 py-3 text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                          />
                        </div>
                      </div>
                    </div>
                    {stripeElementError ? (
                      <p className="text-xs text-destructive">
                        {stripeElementError}
                      </p>
                    ) : !stripeConfigured ? (
                      <p className="text-xs text-destructive">
                        Stripe is not configured in payment settings.
                      </p>
                    ) : !stripeElementReady ? (
                      <p className="text-xs text-muted-foreground">
                        Loading secure card fields...
                      </p>
                    ) : null}
                    <div className="rounded-lg bg-blue-50/60 px-3 py-2 text-[11px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                      Secured by Stripe — card details are tokenized on submit.
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {/* Bank / Manual: reference field */}
            {selectedMethod === "bank" || selectedMethod === "manual" ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reference (optional)
                </label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction ID, authorization code, etc."
                  className="h-11 rounded-xl text-sm"
                  autoFocus
                />
              </div>
            ) : null}

            {/* Confirm button */}
            <Button
              onClick={handleConfirm}
              disabled={isCurrentlyProcessing || cashShort || stripeDisabled}
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white hover:bg-primary/90"
            >
              {isCurrentlyProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : selectedMethod === "cash" ? (
                "Accept cash"
              ) : selectedMethod === "card" && cardSubMethod === "touch" ? (
                <>
                  <Nfc className="mr-2 h-4 w-4" />
                  Charge {fp(total)} via card reader
                </>
              ) : selectedMethod === "card" && cardSubMethod === "stripe" ? (
                `Charge ${fp(total)} via Stripe`
              ) : (
                `Charge ${fp(total)}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
