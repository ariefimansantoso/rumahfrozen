"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShoppingCart, Heart, Star } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppImage } from "@/components/ui/app-image";
import { useCurrency } from "@/providers/currency-provider";
import { useCart } from "@/hooks/use-cart";
import { toast } from "@/components/ui/toast-notification";
import { type Locale } from "@/config/i18n.config";
import { useMultiVendorMode } from "@/providers/app-settings-provider";
import type { StorefrontProductCardData as Product } from "@/types/product-list";
import { trackAddToCart } from "@/lib/analytics/events";


interface ProductCardProps {
  product: Product;
  locale: Locale;
}

function getPreorderRemaining(product: Product) {
  const limit = Number(product.preorder?.limit || 0);
  if (!Number.isFinite(limit) || limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - Number(product.preorder?.reservedQuantity || 0));
}

function isPreorderOpen(product: Product) {
  if (!product.preorder?.enabled) return false;
  const releaseDate = product.preorder.releaseDate
    ? new Date(product.preorder.releaseDate)
    : null;
  if (
    product.preorder.autoConvert !== false &&
    releaseDate &&
    !Number.isNaN(releaseDate.getTime()) &&
    releaseDate.getTime() < Date.now()
  ) {
    return false;
  }
  return getPreorderRemaining(product) > 0;
}

function formatPreorderDate(value?: string | Date) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

// Memoized: grids re-render on cart/filter state changes; cards with
// unchanged product props skip reconciliation.
export const ProductCard = memo(function ProductCard({
  product,
  locale,
}: ProductCardProps) {
  const t = useTranslations();
  const { currency, formatPrice } = useCurrency();
  const { addItem } = useCart();
  const { isMultiVendor } = useMultiVendorMode();
  const tf = (key: string, fallback: string) =>
    t.has(key) ? t(key) : fallback;

  const discountPercentage =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round(
          ((product.comparePrice - product.price) / product.comparePrice) * 100,
        )
      : 0;
  const preorderOpen = isPreorderOpen(product);
  const preorderAvailable =
    preorderOpen &&
    (product.preorder?.preorderOnly || product.stock <= 0);
  const preorderDateLabel = formatPreorderDate(product.preorder?.releaseDate);

  const handleAddToCart = async () => {
    try {
      await addItem({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        quantity: 1,
      });
      trackAddToCart({
        currency: currency.code,
        value: product.price,
        items: [
          {
            item_id: String(product._id),
            item_name: product.name,
            price: product.price,
            quantity: 1,
          },
        ],
      });
      toast.success(t("cart.itemAdded"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      {/* Image */}
      <Link href={`/${locale}/products/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.images[0] ? (
            <AppImage
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No Image
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.featured && (
              <Badge className="bg-primary">{t("common.featured")}</Badge>
            )}
            {discountPercentage > 0 && (
              <Badge variant="destructive">-{discountPercentage}%</Badge>
            )}
            {preorderOpen ? (
              <Badge variant="secondary">
                {tf("product.preorder", "Pre-order")}
              </Badge>
            ) : product.stock === 0 ? (
              <Badge variant="secondary">{t("common.outOfStock")}</Badge>
            ) : null}
          </div>

          {/* Quick Actions */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" className="h-8 w-8">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Link>

      <CardContent className="p-4">
        {/* Vendor */}
        {isMultiVendor && product.vendorId && (
          <Link
            href={`/${locale}/vendors/${product.vendorId.slug}`}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {product.vendorId.storeName}
          </Link>
        )}

        {/* Title */}
        <Link href={`/${locale}/products/${product.slug}`}>
          <h3 className="font-medium line-clamp-2 mt-1 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1 mt-2">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium">
            {product.rating.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({product.reviewCount})
          </span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-bold">
            {formatPrice(product.price)}
          </span>
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.comparePrice)}
            </span>
          )}
        </div>
        {preorderOpen && preorderDateLabel ? (
          <p className="mt-1 text-xs font-medium text-blue-700">
            Ships {preorderDateLabel}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="p-4 pt-0">
          <Button
            className="w-full"
            onClick={handleAddToCart}
            disabled={product.stock === 0 && !preorderAvailable}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {preorderAvailable
              ? tf("product.preorderNow", "Pre-order now")
              : product.stock === 0
                ? t("common.outOfStock")
                : t("common.addToCart")}
          </Button>
      </CardFooter>
    </Card>
  );
});

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-square" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-20" />
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
