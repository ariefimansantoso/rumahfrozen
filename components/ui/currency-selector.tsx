"use client";

import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrency } from "@/providers/currency-provider";

/**
 * Currency Selector
 * Allows users to switch between supported currencies
 */
export function CurrencySelector() {
  const { currency, currencies, setCurrency } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 px-2">
          <span className="font-medium">{currency.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {currencies.map((curr) => (
          <DropdownMenuItem
            key={curr.code}
            onClick={() => setCurrency(curr.code)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="font-mono">{curr.symbol}</span>
              <span>{curr.name}</span>
            </span>
            {currency.code === curr.code && (
              <span className="text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Currency Selector with label
 */
export function CurrencySelectorWithLabel() {
  const { currency, currencies, setCurrency } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <DollarSign className="h-4 w-4" />
          <span>{currency.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {currencies.map((curr) => (
          <DropdownMenuItem
            key={curr.code}
            onClick={() => setCurrency(curr.code)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="font-mono w-6">{curr.symbol}</span>
              <span>{curr.name}</span>
              <span className="text-xs text-muted-foreground">
                ({curr.code})
              </span>
            </span>
            {currency.code === curr.code && (
              <span className="text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Formatted Price Component
 * Displays price in the selected currency
 */
interface FormattedPriceProps {
  price: number;
  className?: string;
}

export function FormattedPrice({ price, className }: FormattedPriceProps) {
  const { formatPrice } = useCurrency();

  return <span className={className}>{formatPrice(price)}</span>;
}
