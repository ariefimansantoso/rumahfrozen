"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Heart,
  Star,
  ShoppingBag,
  Minus,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppImage } from "@/components/ui/app-image";
import { useCurrency } from "@/providers/currency-provider";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/toast-notification";
import { type Locale } from "@/config/i18n.config";
import { cn } from "@/lib/utils";
import type { ModernProduct } from "./modern-product-card";
import { trackAddToCart } from "@/lib/analytics/events";

// ============================================
// Color Utilities (same as modern-product-card)
// ============================================

const colorMap: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#a855f7",
  pink: "#ec4899",
  black: "#171717",
  white: "#ffffff",
  gray: "#6b7280",
  grey: "#6b7280",
  brown: "#92400e",
  navy: "#1e3a8a",
  beige: "#d4c4a8",
  cream: "#fffdd0",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  "light blue": "#93c5fd",
  coral: "#f87171",
  maroon: "#7f1d1d",
  olive: "#84cc16",
  mint: "#a7f3d0",
  lavender: "#c4b5fd",
  gold: "#fbbf24",
  silver: "#9ca3af",
  rose: "#fb7185",
};

function getColorCode(value: string, colorCode?: string): string | null {
  if (colorCode) return colorCode;
  return colorMap[value.toLowerCase().trim()] || null;
}

type ProductOption = {
  name: string;
  values: { _id: string; value: string; colorCode?: string }[];
};

function getColorOption(options?: ProductOption[]) {
  return (options || []).find((opt) => {
    const name = opt.name.toLowerCase();
    return name.includes("color") || name.includes("colour");
  });
}

function getSizeOption(options?: ProductOption[]) {
  return (options || []).find((opt) => {
    const name = opt.name.toLowerCase();
    return name.includes("size");
  });
}

// ============================================
// Props
// ============================================

export interface ProductQuickViewProps {
  product: ModernProduct | null;
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================
// Component
// ============================================

export function ProductQuickView({
  product,
  locale,
  open,
  onOpenChange,
}: ProductQuickViewProps) {
  const t = useTranslations();
  const { currency, formatPrice } = useCurrency();
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);

  // Reset state when product changes
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setQuantity(1);
        setCurrentImageIndex(0);
        setSelectedColor(null);
        setSelectedSize(null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange],
  );

  if (!product) return null;

  const inWishlist = isInWishlist(product._id);
  const isOutOfStock = product.stock === 0;
  const images = product.images || [];
  const colorOption = getColorOption(product.options);
  const sizeOption = getSizeOption(product.options);

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleAddToCart = async () => {
    if (isOutOfStock || isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      await addItem({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: images[0],
        quantity,
        variantId:
          selectedColor || selectedSize
            ? `${selectedColor || ""}-${selectedSize || ""}`
            : undefined,
      });
      trackAddToCart({
        currency: currency.code,
        value: product.price * quantity,
        items: [
          {
            item_id: String(product._id),
            item_name: product.name,
            item_variant:
              selectedColor || selectedSize
                ? `${selectedColor || ""}-${selectedSize || ""}`
                : undefined,
            price: product.price,
            quantity,
          },
        ],
      });
      toast.success(t("cart.itemAdded"));
      handleOpenChange(false);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWishlistToggle = async () => {
    if (isTogglingWishlist) return;

    if (!isAuthenticated) {
      toast.error(t("auth.loginRequired"));
      return;
    }

    setIsTogglingWishlist(true);
    try {
      if (inWishlist) {
        const success = await removeFromWishlist(product._id);
        if (success) {
          toast.success(t("wishlist.removed"));
        }
      } else {
        const success = await addToWishlist(product._id);
        if (success) {
          toast.success(t("wishlist.added"));
        }
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsTogglingWishlist(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("product.quickViewDescription")}
        </DialogDescription>

        <div className="grid md:grid-cols-2">
          {/* Image Gallery */}
          <div className="relative aspect-square bg-muted/30">
            {images[currentImageIndex] ? (
              <AppImage
                src={images[currentImageIndex]}
                alt={product.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {t("common.noImage")}
              </div>
            )}

            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground shadow-md hover:bg-background transition-colors backdrop-blur border border-border/60"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground shadow-md hover:bg-background transition-colors backdrop-blur border border-border/60"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                {/* Image Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={cn(
                        "h-2 w-2 rounded-full transition-colors",
                        idx === currentImageIndex
                          ? "bg-foreground"
                          : "bg-foreground/30 hover:bg-foreground/50",
                      )}
                      aria-label={`View image ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Product Details */}
          <div className="p-6 flex flex-col">
            {/* Header */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">{product.name}</h2>

              {/* Rating */}
              {product.reviewCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium">
                      {product.rating.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({product.reviewCount}{" "}
                    {t("common.reviews")})
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {formatPrice(product.price)}
                </span>
                {product.comparePrice &&
                  product.comparePrice > product.price && (
                    <span className="text-lg text-muted-foreground line-through">
                      {formatPrice(product.comparePrice)}
                    </span>
                  )}
              </div>
            </div>

            <div className="my-6 h-px bg-border" />

            {/* Options */}
            <div className="space-y-5 flex-1">
              {/* Color Options */}
              {colorOption && colorOption.values.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    {t("product.color")}
                    {selectedColor && (
                      <span className="ml-2 font-normal text-muted-foreground capitalize">
                        {selectedColor}
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOption.values.map((v) => {
                      const color =
                        getColorCode(v.value, v.colorCode) || "#e5e7eb";
                      const isLight =
                        color === "#ffffff" || color === "#fffdd0";
                      const isSelected = selectedColor === v.value;
                      return (
                        <button
                          key={v._id}
                          onClick={() => setSelectedColor(v.value)}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition-all",
                            isSelected
                              ? "ring-2 ring-offset-2 ring-primary"
                              : "hover:scale-110",
                            isLight
                              ? "border-muted-foreground/30"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: color }}
                          title={v.value}
                          aria-label={v.value}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Options */}
              {sizeOption && sizeOption.values.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    {t("product.size")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sizeOption.values.map((v) => {
                      const isSelected = selectedSize === v.value;
                      return (
                        <button
                          key={v._id}
                          onClick={() => setSelectedSize(v.value)}
                          className={cn(
                            "min-w-[40px] h-10 px-3 rounded-lg border text-sm font-medium transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          {v.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  {t("common.quantity")}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-lg border">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center font-medium">
                      {quantity}
                    </span>
                    <button
                      onClick={() =>
                        setQuantity((q) => Math.min(product.stock, q + 1))
                      }
                      disabled={quantity >= product.stock}
                      className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {product.stock > 0
                      ? t("product.inStockCount", {
                          count: product.stock,
                          defaultMessage: `${product.stock} in stock`,
                        })
                      : t("common.outOfStock")}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              <div className="flex gap-3">
                <Button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || isAddingToCart}
                  className="flex-1 h-12 gap-2"
                  size="lg"
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-5 w-5" />
                  )}
                  {isOutOfStock
                    ? t("common.outOfStock")
                    : t("common.addToCart")}
                </Button>
                <Button
                  onClick={handleWishlistToggle}
                  disabled={isTogglingWishlist}
                  variant="outline"
                  size="lg"
                  className={cn(
                    "h-12 w-12 shrink-0",
                    inWishlist && "text-red-500 border-red-200 bg-red-50",
                  )}
                  aria-label={
                    inWishlist
                      ? t("wishlist.removeFromWishlist")
                      : t("wishlist.addToWishlist")
                  }
                >
                  {isTogglingWishlist ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Heart
                      className={cn("h-5 w-5", inWishlist && "fill-current")}
                    />
                  )}
                </Button>
              </div>

              <Link
                href={`/${locale}/products/${product.slug}`}
                className="block text-center text-sm text-primary hover:underline"
                onClick={() => handleOpenChange(false)}
              >
                {t("product.viewFullDetails")}
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
