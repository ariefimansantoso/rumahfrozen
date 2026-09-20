"use client";

import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/providers/currency-provider";
import { cn } from "@/lib/utils";

interface CurrencySelectProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Currency Select with Search
 * Full select component for settings pages
 */
export function CurrencySelect({
  className,
  showLabel = true,
}: CurrencySelectProps) {
  const t = useTranslations();
  const { currency, currencies, setCurrency } = useCurrency();

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <label className="text-sm font-medium">
          {t("settings.currency")}
        </label>
      )}
      <Select value={currency.code} onValueChange={setCurrency}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="font-mono">{currency.symbol}</span>
              <span>{currency.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {currencies.map((curr) => (
            <SelectItem key={curr.code} value={curr.code}>
              <span className="flex items-center gap-2">
                <span className="font-mono w-8">{curr.symbol}</span>
                <span>{curr.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({curr.code})
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Currency Badge
 * Compact currency indicator for footers
 */
export function CurrencyBadge({ className }: { className?: string }) {
  const { currency } = useCurrency();

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm text-muted-foreground",
        className
      )}
    >
      <Globe className="h-3 w-3" />
      <span>{currency.code}</span>
    </div>
  );
}

/**
 * Price Display Component
 * Smart price display with original and converted price
 */
interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  className?: string;
  showOriginal?: boolean;
}

export function PriceDisplay({
  price,
  originalPrice,
  className,
  showOriginal = false,
}: PriceDisplayProps) {
  const { formatPrice, currency } = useCurrency();

  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-lg font-bold">{formatPrice(price)}</span>
      {originalPrice && originalPrice > price && (
        <span className="text-sm text-muted-foreground line-through">
          {formatPrice(originalPrice)}
        </span>
      )}
      {showOriginal && (
        <span className="text-xs text-muted-foreground">
          ({currency.code})
        </span>
      )}
    </div>
  );
}
