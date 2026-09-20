"use client";

import posthog from "posthog-js";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  Loader2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/hooks/use-cart";
import {
  analyticsPayloadFromOrder,
  clearCheckoutAnalyticsSnapshot,
  readCheckoutAnalyticsSnapshot,
  trackPurchase,
} from "@/lib/analytics/events";
import type { IOrder } from "@/types";

const PAYMENT_VERIFY_ATTEMPTS = 10;
const PAYMENT_VERIFY_DELAY_MS = 1500;

type PaymentVerificationState =
  | "verifying"
  | "confirmed"
  | "pending"
  | "failed";

type PaymentVerificationData = {
  status?: string;
  orderCreated?: boolean;
  orderId?: string;
  orderNumber?: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFinalPaymentIntentStatus(status: string) {
  return status === "succeeded";
}

function isPendingPaymentIntentStatus(status: string) {
  return status === "processing" || status === "requires_capture";
}

function isFailedPaymentIntentStatus(status: string) {
  return (
    status === "canceled" ||
    status === "requires_payment_method" ||
    status === "requires_action" ||
    status === "requires_confirmation"
  );
}

function isFinalCheckoutSessionStatus(status: string) {
  return status === "paid" || status === "no_payment_required";
}

function isFailedCheckoutSessionStatus(status: string) {
  return status === "unpaid";
}

export function CheckoutSuccessContent() {
  const t = useTranslations();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { clearCart } = useCart();

  const sessionId = searchParams.get("session_id");
  const orderNumber = searchParams.get("order");
  const paymentIntentId = searchParams.get("payment_intent");
  const paypalOrderId = searchParams.get("paypal_order_id") || searchParams.get("token");
  const paystackReference =
    searchParams.get("paystack_reference") ||
    searchParams.get("reference") ||
    searchParams.get("trxref");
  const needsPaymentVerification =
    !!sessionId || !!paypalOrderId || !!paymentIntentId || !!paystackReference;

  const [verificationState, setVerificationState] =
    useState<PaymentVerificationState>(
      needsPaymentVerification ? "verifying" : "confirmed",
    );
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [verifiedOrder, setVerifiedOrder] = useState<string | null>(
    orderNumber,
  );
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (verificationState === "confirmed") {
      posthog.capture("order_completed", {
        order_number: verifiedOrder,
      });
    }
  }, [verificationState, verifiedOrder]);

  useEffect(() => {
    if (verificationState !== "confirmed") return;

    const transactionId = orderId || verifiedOrder;
    if (!transactionId) return;

    let active = true;

    async function trackConfirmedPurchase() {
      const snapshot = readCheckoutAnalyticsSnapshot();

      if (orderId) {
        try {
          const res = await fetch(`/api/orders/${orderId}`);
          const json = await res.json().catch(() => null);
          if (active && res.ok && json?.success && json.data) {
            const order = json.data as Partial<IOrder>;
            trackPurchase({
              ...analyticsPayloadFromOrder(order),
              orderId: order.orderNumber || verifiedOrder || orderId,
              currency: snapshot?.currency,
            });
            clearCheckoutAnalyticsSnapshot();
            return;
          }
        } catch {
          // Fall through to the checkout snapshot below.
        }
      }

      if (!active) return;

      trackPurchase({
        ...(snapshot || { currency: "USD", value: 0, items: [] }),
        orderId: verifiedOrder || orderId || String(transactionId),
      });
      clearCheckoutAnalyticsSnapshot();
    }

    void trackConfirmedPurchase();

    return () => {
      active = false;
    };
  }, [orderId, verificationState, verifiedOrder]);

  useEffect(() => {
    async function verifyStripePayment() {
      if (!sessionId && !paymentIntentId) return;

      const isPaymentIntent = Boolean(paymentIntentId);
      const query = isPaymentIntent
        ? `payment_intent_id=${encodeURIComponent(paymentIntentId as string)}`
        : `session_id=${encodeURIComponent(sessionId as string)}`;

      try {
        for (let attempt = 0; attempt < PAYMENT_VERIFY_ATTEMPTS; attempt++) {
          if (cancelled) return;

          const res = await fetch(`/api/payments/verify?${query}`);
          const data = await res.json().catch(() => null);

          if (!res.ok || !data?.success) {
            throw new Error(
              data?.message || data?.error || "Payment verification failed",
            );
          }

          const details = (data.data || {}) as PaymentVerificationData;
          const status = String(details.status || "").toLowerCase();
          const isFinalPayment = isPaymentIntent
            ? isFinalPaymentIntentStatus(status)
            : isFinalCheckoutSessionStatus(status);
          const isPendingPayment = isPaymentIntent
            ? isPendingPaymentIntentStatus(status)
            : !isFailedCheckoutSessionStatus(status);
          const isFailedPayment = isPaymentIntent
            ? isFailedPaymentIntentStatus(status)
            : isFailedCheckoutSessionStatus(status);

          if (details.orderCreated && details.orderNumber) {
            setVerifiedOrder(details.orderNumber);
            if (details.orderId) setOrderId(details.orderId);
            await clearCart();
            if (!cancelled) {
              setVerificationMessage(null);
              setVerificationState("confirmed");
            }
            return;
          }

          if (isFailedPayment) {
            throw new Error("Payment was not completed");
          }

          if (attempt < PAYMENT_VERIFY_ATTEMPTS - 1) {
            await wait(PAYMENT_VERIFY_DELAY_MS);
            continue;
          }

          if (isFinalPayment || isPendingPayment) {
            setVerificationMessage(
              isFinalPayment
                ? "Stripe confirmed the payment, but the order is still being finalized. Refresh this page in a moment or check My Orders."
                : "Stripe is still processing the payment. We'll confirm the order once processing is complete.",
            );
            setVerificationState("pending");
            return;
          }
        }
      } catch (error) {
        console.error("Failed to verify Stripe payment:", error);
        if (!cancelled) {
          setVerificationMessage(
            error instanceof Error
              ? error.message
              : "Payment verification failed",
          );
          setVerificationState("failed");
        }
      }
    }

    let cancelled = false;
    verifyStripePayment();

    return () => {
      cancelled = true;
    };
  }, [sessionId, paymentIntentId, clearCart]);

  useEffect(() => {
    async function capturePayPal() {
      if (!paypalOrderId) return;

      try {
        const res = await fetch("/api/payments/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: paypalOrderId }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data.data?.orderNumber) {
          setVerifiedOrder(data.data.orderNumber);
          if (data.data.orderId) {
            setOrderId(data.data.orderId);
          }
          await clearCart();
          setVerificationMessage(null);
          setVerificationState("confirmed");
          return;
        }

        throw new Error(
          data?.message || data?.error || "PayPal payment capture failed",
        );
      } catch (error) {
        console.error("Failed to capture PayPal order:", error);
        setVerificationMessage(
          error instanceof Error ? error.message : "PayPal payment capture failed",
        );
        setVerificationState("failed");
      }
    }

    capturePayPal();
  }, [paypalOrderId, clearCart]);

  useEffect(() => {
    async function verifyPaystack() {
      if (!paystackReference) return;

      try {
        const res = await fetch("/api/payments/paystack/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: paystackReference }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data.data?.orderNumber) {
          setVerifiedOrder(data.data.orderNumber);
          if (data.data.orderId) {
            setOrderId(data.data.orderId);
          }
          await clearCart();
          setVerificationMessage(null);
          setVerificationState("confirmed");
          return;
        }

        throw new Error(
          data?.message || data?.error || "Paystack payment verification failed",
        );
      } catch (error) {
        console.error("Failed to verify Paystack transaction:", error);
        setVerificationMessage(
          error instanceof Error
            ? error.message
            : "Paystack payment verification failed",
        );
        setVerificationState("failed");
      }
    }

    verifyPaystack();
  }, [paystackReference, clearCart]);

  const handleDownloadInvoice = async () => {
    const invoiceId = orderId || verifiedOrder;
    if (!invoiceId) return;

    setIsDownloading(true);
    try {
      const res = await fetch(`/api/orders/${invoiceId}/invoice`);
      if (!res.ok) throw new Error("Failed to download invoice");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${verifiedOrder || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download invoice:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (verificationState === "verifying") {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="pt-8 pb-8">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <h1 className="text-xl font-bold mb-2">
              {t("checkout.verifyingPayment")}
            </h1>
            <p className="text-muted-foreground">
              {t("checkout.pleaseWait")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationState === "pending") {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="pt-8 pb-8">
            <Clock3 className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-xl font-bold mb-2">
              Payment confirmation pending
            </h1>
            <p className="text-muted-foreground mb-6">
              {verificationMessage ||
                "We're still confirming your order. Please check back shortly."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link href={`/${locale}/account/orders`}>
                  {t("orders.viewOrders")}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${locale}/products`}>
                  {t("cart.continueShopping")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationState === "failed") {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="pt-8 pb-8">
            <CircleAlert className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">
              Payment could not be confirmed
            </h1>
            <p className="text-muted-foreground mb-6">
              {verificationMessage ||
                "We could not confirm this payment. Please try again."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link href={`/${locale}/checkout`}>
                  {t("common.tryAgain")}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${locale}/products`}>
                  {t("cart.continueShopping")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="max-w-lg mx-auto text-center">
        <CardContent className="pt-8 pb-8">
          <div className="mb-6">
            <CheckCircle2 className="h-20 w-20 mx-auto text-green-500" />
          </div>

          <h1 className="text-2xl font-bold mb-2">
            {t("checkout.orderSuccess")}
          </h1>
          <p className="text-muted-foreground mb-6">
            {t("checkout.orderSuccessDescription")}
          </p>

          {verifiedOrder && (
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Package className="h-4 w-4" />
                <span>
                  {t("checkout.orderNumber")}
                  : <strong>{verifiedOrder}</strong>
                </span>
              </div>
            </div>
          )}

          {(orderId || verifiedOrder) && (
            <Button
              variant="outline"
              className="mb-4 w-full sm:w-auto"
              onClick={handleDownloadInvoice}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t("checkout.downloadInvoice")}
            </Button>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href={`/${locale}/account/orders`}>
                {t("orders.viewOrders")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/${locale}/products`}>
                {t("cart.continueShopping")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
