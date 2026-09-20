"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import {
  Banknote,
  ChevronLeft,
  CreditCard,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";
import type { POSSettings } from "@/lib/pos/build-pos-settings";
import type {
  POSCartItem,
  POSView,
} from "@/components/pos/pos-types";

interface POSPaymentViewProps {
  cart: POSCartItem[];
  cashTendered: string;
  setCashTendered: Dispatch<SetStateAction<string>>;
  paymentReference: string;
  setPaymentReference: Dispatch<SetStateAction<string>>;
  paymentNote: string;
  setPaymentNote: Dispatch<SetStateAction<string>>;
  isProcessing: boolean;
  settings: POSSettings;
  subtotal: number;
  tax: number;
  total: number;
  setView: Dispatch<SetStateAction<POSView>>;
  processPayment: (paymentMethod: string) => void | Promise<void | boolean>;
  fp: (amount: number) => string;
}

export function POSPaymentView({
  cart,
  cashTendered,
  setCashTendered,
  paymentReference,
  setPaymentReference,
  paymentNote,
  setPaymentNote,
  isProcessing,
  settings,
  subtotal,
  tax,
  total,
  setView,
  processPayment,
  fp,
}: POSPaymentViewProps) {
  const t = useTranslations();

  const change = cashTendered ? parseFloat(cashTendered) - total : 0;

  return (
    <div className="flex h-[calc(100dvh-4rem)] bg-background">
      {/* Left side - Order summary */}
      <div className="w-105 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("terminal")}
            className="rounded-lg -ml-2"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t("common.back")}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-1">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {item.image && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted ring-1 ring-border/50">
                      <AppImage
                        src={item.image}
                        alt={item.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.name}
                    </p>
                    {item.variantName && (
                      <p className="text-xs text-muted-foreground">
                        {item.variantName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {fp(item.price)} x {item.quantity}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-sm tabular-nums">
                  {fp(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-5 border-t bg-background space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("pos.subtotal")}</span>
            <span className="tabular-nums">{fp(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("pos.tax")}</span>
              <span className="tabular-nums">{fp(tax)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-xl font-bold">
            <span>{t("pos.total")}</span>
            <span className="tabular-nums">{fp(total)}</span>
          </div>
        </div>
      </div>

      {/* Right side - Payment methods */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-linear-to-br from-background via-background to-muted/30">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {t("pos.selectPaymentMethod")}
            </h2>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold">
              {t("pos.totalDue")}: {fp(total)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {settings.paymentMethods.includes("cash") && (
              <div className="space-y-3">
                <button
                  onClick={() => processPayment("cash")}
                  disabled={isProcessing}
                  className={cn(
                    "w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200",
                    "hover:border-green-500/50 hover:bg-green-50/50 dark:hover:bg-green-950/20 hover:shadow-lg hover:shadow-green-500/5",
                    "active:scale-[0.99]",
                    isProcessing && "opacity-60 pointer-events-none"
                  )}
                >
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                    {isProcessing ? (
                      <Loader2 className="w-6 h-6 text-green-600 dark:text-green-400 animate-spin" />
                    ) : (
                      <Banknote className="w-6 h-6 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-base">
                      {t("pos.cash")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("pos.cashPayment")}
                    </p>
                  </div>
                </button>

                {/* Quick cash amounts */}
                <div className="flex gap-2 pl-1">
                  {[
                    Math.ceil(total),
                    Math.ceil(total / 5) * 5,
                    Math.ceil(total / 10) * 10,
                    Math.ceil(total / 20) * 20,
                    Math.ceil(total / 50) * 50,
                    Math.ceil(total / 100) * 100,
                  ]
                    .filter((v, i, a) => a.indexOf(v) === i && v >= total)
                    .slice(0, 4)
                    .map((amount) => (
                      <Button
                        key={amount}
                        variant="secondary"
                        size="sm"
                        className="flex-1 rounded-lg font-mono"
                        onClick={() => setCashTendered(String(amount))}
                      >
                        {fp(amount)}
                      </Button>
                    ))}
                </div>

                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Cash tendered"
                  value={cashTendered}
                  onChange={(event) => setCashTendered(event.target.value)}
                />

                {cashTendered && (
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("pos.cashTendered")}
                      </span>
                      <span className="font-mono font-semibold">
                        {fp(parseFloat(cashTendered))}
                      </span>
                    </div>
                    {change >= 0 && (
                      <div className="flex justify-between text-sm font-bold text-green-600 dark:text-green-400">
                        <span>{t("pos.change")}</span>
                        <span className="font-mono">{fp(change)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(settings.paymentMethods.includes("card") ||
              settings.paymentMethods.includes("manual")) && (
              <div className="grid gap-2 rounded-xl border bg-card p-3">
                <Input
                  placeholder="Payment reference (optional)"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
                <Input
                  placeholder="Payment note (optional)"
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                />
              </div>
            )}

            {settings.paymentMethods.includes("card") && (
              <button
                onClick={() => processPayment("card")}
                disabled={isProcessing}
                className={cn(
                  "w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200",
                  "hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:shadow-lg hover:shadow-blue-500/5",
                  "active:scale-[0.99]",
                  isProcessing && "opacity-60 pointer-events-none"
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : (
                    <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-base">{t("pos.card")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("pos.cardPayment")}
                  </p>
                </div>
              </button>
            )}

            {settings.paymentMethods.includes("manual") && (
              <button
                onClick={() => processPayment("manual")}
                disabled={isProcessing}
                className={cn(
                  "w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200",
                  "hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/5",
                  "active:scale-[0.99]",
                  isProcessing && "opacity-60 pointer-events-none"
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : (
                    <FileText className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-base">
                    {t("pos.manual")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("pos.manualPayment")}
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

}
