"use client";

import { memo } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { useCurrency } from "@/providers/currency-provider";
import { type Locale } from "@/config/i18n.config";
import { cn } from "@/lib/utils";

type ProductOptionValue = {
  _id: string;
  value: string;
  colorCode?: string;
};

type ProductOption = {
  name: string;
  values: ProductOptionValue[];
};

interface CompactProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  rating: number;
  reviewCount: number;
  options?: ProductOption[];
}

interface CompactProductCardProps {
  product: CompactProduct;
  locale: Locale;
}

const colorMap: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#a855f7",
  pink: "#ec4899",
  black: "#000000",
  white: "#ffffff",
  gray: "#6b7280",
  grey: "#6b7280",
  brown: "#92400e",
  navy: "#1e3a8a",
  beige: "#d4c4a8",
  cream: "#fffdd0",
  teal: "#14b8a6",
  cyan: "#06b6d4",
};

function getColorCode(value: string, colorCode?: string): string | null {
  if (colorCode) return colorCode;
  return colorMap[value.toLowerCase()] || null;
}

function getColorOption(options?: ProductOption[]) {
  const found = (options || []).find((opt) => {
    const name = opt.name.toLowerCase();
    return name.includes("color") || name.includes("colour");
  });
  return found;
}

// Memoized: carousels re-render on scroll state; cards with unchanged
// product props skip reconciliation.
export const CompactProductCard = memo(function CompactProductCard({
  product,
  locale,
}: CompactProductCardProps) {
  const { formatPrice } = useCurrency();
  const colorOption = getColorOption(product.options);
  const colorValues = (colorOption?.values || []).slice(0, 4);

  return (
    <Link
      href={`/${locale}/products/${product.slug}`}
      className="block min-w-[220px] max-w-[240px]"
    >
      <div className="space-y-3">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted/30">
          <AppImage
            src={product.images?.[0]}
            alt={product.name}
            fill
            className="object-cover"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-medium leading-snug line-clamp-2">
              {product.name}
            </h3>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {formatPrice(product.price)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-foreground">
                {product.rating.toFixed(1)}
              </span>
              <span>({product.reviewCount})</span>
            </div>

            {colorValues.length > 0 && (
              <div className="flex items-center gap-1">
                {colorValues.map((v) => {
                  const color = getColorCode(v.value, v.colorCode) || "#e5e7eb";
                  return (
                    <span
                      key={v._id}
                      className={cn(
                        "h-3.5 w-3.5 rounded-full border",
                        color === "#ffffff" || color === "#fffdd0"
                          ? "border-muted-foreground/30"
                          : "border-transparent",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

