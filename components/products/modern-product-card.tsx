"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart, Star, ShoppingBag, Maximize2, Loader2 } from "lucide-react";
import { memo, useState, useCallback } from "react";
import { ProductQuickViewModal } from "./product-quick-view-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { AppImage } from "@/components/ui/app-image";
import { ModelViewer } from "@/components/ui/model-viewer";
import { useCurrency } from "@/providers/currency-provider";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/toast-notification";
import { type Locale } from "@/config/i18n.config";
import { cn } from "@/lib/utils";
import {
  formatProductCompareAtPrice,
  formatProductPrice,
  getProductDiscountPercentage,
  getProductPriceRange,
  productRequiresVariantSelection,
  type MoneyRangeLike,
} from "@/lib/products/price-display";
import {
  findColorOption,
  getSwatchColor,
} from "@/lib/products/color-swatch";
import { trackAddToCart } from "@/lib/analytics/events";

// ============================================
// Types
// ============================================

type ProductOptionValue = {
  _id: string;
  value: string;
  colorCode?: string;
};

type ProductOption = {
  name: string;
  values: ProductOptionValue[];
};

type ProductVariant = {
  _id: string;
  name: string;
  price?: number;
  comparePrice?: number;
  images?: string[];
  options?: Record<string, string>;
  stock?: number;
  preorder?: ProductPreorder;
};

type ProductMediaKind = "image" | "video" | "model";

type ProductMedia = {
  _id: string;
  type?: ProductMediaKind;
  url: string;
  alt?: string;
  position?: number;
  mimeType?: string;
  thumbnailUrl?: string;
};

type ProductPreorder = {
  enabled?: boolean;
  releaseDate?: string | Date | null;
  message?: string | null;
  limit?: number | null;
  reservedQuantity?: number | null;
  preorderOnly?: boolean;
  autoConvert?: boolean;
  paymentMode?: "full" | "deposit" | "pay_later";
  depositType?: "percentage" | "fixed";
  depositValue?: number | null;
  batchName?: string | null;
};

export interface ModernProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  priceRange?: MoneyRangeLike;
  compareAtPriceRange?: MoneyRangeLike;
  images: string[];
  media?: ProductMedia[];
  rating: number;
  reviewCount: number;
  stock: number;
  preorder?: ProductPreorder;
  featured?: boolean;
  status?: string;
  options?: ProductOption[];
  variants?: ProductVariant[];
  createdAt?: string | Date;
  vendorId?: {
    storeName: string;
    slug: string;
  };
}

export interface ModernProductCardProps {
  product: ModernProduct;
  locale: Locale;
  variant?: "default" | "compact";
  showQuickView?: boolean;
  showAddToCart?: boolean;
  showWishlist?: boolean;
  showColorSwatches?: boolean;
  showRating?: boolean;
  showBadges?: boolean;
  onQuickView?: (product: ModernProduct) => void;
  className?: string;
}

function inferMediaType(media: {
  type?: ProductMediaKind;
  url: string;
  mimeType?: string;
}): ProductMediaKind {
  if (media.type) return media.type;
  const mimeType = media.mimeType?.toLowerCase() || "";
  const url = media.url.toLowerCase();

  if (mimeType.startsWith("video/")) return "video";
  if (
    mimeType.includes("gltf") ||
    mimeType === "application/octet-stream" ||
    url.endsWith(".glb") ||
    url.endsWith(".gltf")
  ) {
    return "model";
  }

  return "image";
}

function getPrimaryProductMedia(product: ModernProduct): ProductMedia | null {
  if (Array.isArray(product.media) && product.media.length > 0) {
    const media = [...product.media]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .find((item) => item.url);

    if (media) {
      return {
        ...media,
        type: inferMediaType(media),
        alt: media.alt || product.name,
      };
    }
  }

  const image = product.images?.find(Boolean);
  return image
    ? {
        _id: "primary-image",
        type: "image",
        url: image,
        alt: product.name,
      }
    : null;
}

function getPreorderRemaining(preorder?: ProductPreorder) {
  const limit = Number(preorder?.limit || 0);
  if (!Number.isFinite(limit) || limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - Number(preorder?.reservedQuantity || 0));
}

function isPreorderOpen(preorder?: ProductPreorder) {
  if (!preorder?.enabled) return false;
  const releaseDate = preorder.releaseDate
    ? new Date(preorder.releaseDate)
    : null;

  if (
    preorder.autoConvert !== false &&
    releaseDate &&
    !Number.isNaN(releaseDate.getTime()) &&
    releaseDate.getTime() < Date.now()
  ) {
    return false;
  }

  return getPreorderRemaining(preorder) > 0;
}

function hasActivePreorder(product: ModernProduct) {
  if (isPreorderOpen(product.preorder)) return true;
  return (product.variants || []).some((variant) =>
    isPreorderOpen(variant.preorder),
  );
}

function getPrimaryPreorder(product: ModernProduct) {
  if (isPreorderOpen(product.preorder)) return product.preorder;
  return (product.variants || []).find((variant) =>
    isPreorderOpen(variant.preorder),
  )?.preorder;
}

function formatPreorderDate(value?: ProductPreorder["releaseDate"]) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getPreorderReserveLabel(preorder?: ProductPreorder) {
  const limit = Number(preorder?.limit || 0);
  if (!Number.isFinite(limit) || limit <= 0) return "";
  const reserved = Math.max(0, Number(preorder?.reservedQuantity || 0));
  const remaining = Math.max(0, limit - reserved);
  return `${remaining} left`;
}

function ProductCardMedia({
  media,
  productName,
}: {
  media: ProductMedia | null;
  productName: string;
}) {
  const [isModelInteractive, setIsModelInteractive] = useState(false);

  if (!media) {
    return null;
  }

  const alt = media.alt || productName;

  if (media.type === "model") {
    return (
      <div
        className="h-full w-full"
        onMouseEnter={() => setIsModelInteractive(true)}
        onMouseLeave={() => setIsModelInteractive(false)}
        onFocus={() => setIsModelInteractive(true)}
        onBlur={() => setIsModelInteractive(false)}
      >
        <ModelViewer
          src={media.url}
          alt={alt}
          autoRotate={!isModelInteractive}
          cameraControls={isModelInteractive}
          loading="lazy"
          preferProxy
          poster={media.thumbnailUrl}
        />
      </div>
    );
  }

  if (media.type === "video") {
    return (
      <video
        src={media.url}
        poster={media.thumbnailUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <AppImage
      src={media.url}
      alt={alt}
      fill
      sizes="(max-width: 640px) 46vw, (max-width: 1024px) 32vw, 25vw"
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

// ============================================
// Main Component
// ============================================

// Memoized: grids re-render on cart/filter state changes; cards with
// unchanged product props skip reconciliation.
export const ModernProductCard = memo(function ModernProductCard({
  product,
  locale,
  showQuickView = true,
  showAddToCart = true,
  showWishlist = true,
  showColorSwatches = true,
  showRating = true,
  showBadges = true,
  onQuickView,
  className,
}: ModernProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { currency, formatPrice } = useCurrency();
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);

  const inWishlist = isInWishlist(product._id);
  const isOutOfStock = product.stock === 0;
  const primaryPreorder = getPrimaryPreorder(product);
  const preorderAvailable = hasActivePreorder(product);
  const isUnavailable = isOutOfStock && !preorderAvailable;
  const priceLabel = formatProductPrice(product, formatPrice);
  const compareAtLabel = formatProductCompareAtPrice(product, formatPrice);
  const priceRange = getProductPriceRange(product);
  const needsVariantSelection = productRequiresVariantSelection(product);
  const primaryMedia = getPrimaryProductMedia(product);
  const cartImage =
    primaryMedia?.type === "image"
      ? primaryMedia.url
      : primaryMedia?.thumbnailUrl || product.images[0];
  const onlyVariant =
    Array.isArray(product.variants) && product.variants.length === 1
      ? product.variants[0]
      : null;
  const clickPreorderSettings = onlyVariant?.preorder?.enabled
    ? onlyVariant.preorder
    : product.preorder;
  const clickStock = onlyVariant?.stock ?? product.stock;
  const preorderPurchaseAvailable =
    isPreorderOpen(clickPreorderSettings) &&
    (clickPreorderSettings?.preorderOnly || clickStock <= 0);
  const preorderDateLabel = formatPreorderDate(primaryPreorder?.releaseDate);
  const preorderReserveLabel = getPreorderReserveLabel(primaryPreorder);
  const discountPercentage = getProductDiscountPercentage(product);
  const chooseOptionsLabel = t.has("product.chooseOptions")
    ? t("product.chooseOptions")
    : "Choose options";
  const preorderLabel = t.has("product.preorder")
    ? t("product.preorder")
    : "Pre-order";
  const preorderNowLabel = t.has("product.preorderNow")
    ? t("product.preorderNow")
    : "Pre-order now";

  // Get color options for swatches
  const colorOption = findColorOption(product.options);
  const colorValues = showColorSwatches
    ? (colorOption?.values || []).slice(0, 5)
    : [];

  // Get the first selected color name (for display under product name)
  const selectedColorName = colorValues[0]?.value;

  const handleAddToCart = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isUnavailable || isAddingToCart) return;

      if (needsVariantSelection) {
        if (onQuickView) {
          onQuickView(product);
        } else {
          router.push(`/${locale}/products/${product.slug}`);
        }
        return;
      }

      setIsAddingToCart(true);
      try {
        await addItem({
          productId: product._id,
          variantId: onlyVariant?._id,
          name: onlyVariant ? `${product.name} - ${onlyVariant.name}` : product.name,
          price: onlyVariant?.price ?? priceRange.min,
          image: cartImage,
          quantity: 1,
        });
        trackAddToCart({
          currency: currency.code,
          value: onlyVariant?.price ?? priceRange.min,
          items: [
            {
              item_id: String(product._id),
              item_name: product.name,
              item_variant: onlyVariant?._id,
              price: onlyVariant?.price ?? priceRange.min,
              quantity: 1,
            },
          ],
        });
        toast.success(t("cart.itemAdded"));
      } catch {
        toast.error(t("common.error"));
      } finally {
        setIsAddingToCart(false);
      }
    },
    [
      addItem,
      cartImage,
      currency.code,
      isAddingToCart,
      isUnavailable,
      locale,
      needsVariantSelection,
      onQuickView,
      onlyVariant,
      priceRange.min,
      product,
      router,
      t,
    ],
  );

  const handleWishlistToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isTogglingWishlist) return;

      // Redirect to login if not authenticated
      if (!isAuthenticated) {
        router.push(`/${locale}/login?callbackUrl=/${locale}/account/wishlist`);
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
    },
    [
      product._id,
      inWishlist,
      isAuthenticated,
      addToWishlist,
      removeFromWishlist,
      t,
      isTogglingWishlist,
      router,
      locale,
    ],
  );

  const handleQuickView = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onQuickView?.(product);
    },
    [product, onQuickView],
  );

  return (
    <div className={cn("group", className)}>
      <Link
        href={`/${locale}/products/${product.slug}`}
        className="block space-y-3"
      >
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden rounded-md bg-[#f3f4f6] ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10">
          {primaryMedia ? (
            <ProductCardMedia media={primaryMedia} productName={product.name} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {t("common.noImage")}
            </div>
          )}

          {/* Top Left Badges */}
          {showBadges && (
            <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
              {discountPercentage > 0 && (
                <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-destructive shadow-sm ring-1 ring-black/5 dark:bg-muted dark:font-bold dark:text-red-400 dark:ring-white/10">
                  -{discountPercentage}%
                </span>
              )}
              {preorderAvailable ? (
                <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                  {preorderLabel}
                </span>
              ) : null}
              {(product.featured || isUnavailable) && (
                <div className="flex flex-col items-start gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                  {product.featured && (
                    <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                      {t("common.featured")}
                    </span>
                  )}
                  {isUnavailable && (
                    <span className="inline-flex items-center rounded-full bg-black/80 px-2.5 py-1 text-xs font-medium text-white">
                      {t("common.outOfStock")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Wishlist Button - Top Right */}
          {showWishlist && (
            <button
              onClick={handleWishlistToggle}
              disabled={isTogglingWishlist}
              className={cn(
                "pointer-events-none absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full opacity-0 shadow-sm transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                inWishlist
                  ? "bg-red-50 text-red-500 dark:bg-red-500/20 dark:text-red-300"
                  : "bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground backdrop-blur border border-border/60",
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
                  className={cn(
                    "h-5 w-5 transition-all",
                    inWishlist && "fill-red-500 text-red-500",
                  )}
                />
              )}
            </button>
          )}

          {/* Hover Actions - Bottom */}
          {(showAddToCart || showQuickView) && !isUnavailable && (
            <div
              className={cn(
                "absolute inset-x-2 bottom-2 grid gap-1.5 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 sm:inset-x-3 sm:bottom-3 sm:gap-2",
                showAddToCart && showQuickView && onQuickView
                  ? "grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {showAddToCart && (
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full bg-foreground px-2 text-[11px] font-semibold leading-none text-background shadow-lg transition-colors hover:bg-foreground/90 sm:h-10 sm:px-3 sm:text-xs"
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin sm:h-4 sm:w-4" />
                  ) : (
                    <ShoppingBag className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  )}
                  <span className="min-w-0 truncate whitespace-nowrap">
                    {needsVariantSelection
                      ? chooseOptionsLabel
                      : preorderPurchaseAvailable
                        ? preorderNowLabel
                        : t("common.addToCart")}
                  </span>
                </button>
              )}
              {showQuickView && onQuickView && (
                <button
                  onClick={handleQuickView}
                  className="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background/95 px-2 text-[11px] font-semibold leading-none text-foreground shadow-lg transition-colors hover:bg-background sm:h-10 sm:px-3 sm:text-xs"
                >
                  <Maximize2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="min-w-0 truncate whitespace-nowrap">
                    {t("product.quickView")}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-1.5 px-0.5">
          {/* Color Swatches */}
          {colorValues.length > 0 && (
            <div className="flex items-center gap-1">
              {colorValues.map((v) => {
                const color = getSwatchColor(v.value, v.colorCode) || "#e5e7eb";
                const isLight =
                  color === "#ffffff" ||
                  color === "#fffdd0" ||
                  color === "#fef3c7";
                return (
                  <span
                    key={v._id}
                    className={cn(
                      "h-4 w-4 rounded-full transition-transform hover:scale-110",
                      isLight ? "border border-border" : "border-0",
                    )}
                    style={{ backgroundColor: color }}
                    title={v.value}
                  />
                );
              })}
            </div>
          )}

          {/* Product Name */}
          <h3 className="line-clamp-1 text-[13px] font-semibold leading-tight text-foreground transition-colors group-hover:text-primary group-focus-within:text-primary sm:text-sm">
            {product.name}
          </h3>

          {/* Color/Variant Name */}
          {selectedColorName && (
            <p className="text-xs leading-snug text-muted-foreground capitalize sm:text-[13px]">
              {selectedColorName}
            </p>
          )}

          {/* Price & Rating Row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Price */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-[6px] border-2 border-emerald-500 px-2 py-0.5 text-[13px] font-semibold leading-snug text-emerald-600 dark:border-emerald-500 dark:text-emerald-400 sm:px-2.5 sm:text-sm">
                {priceLabel}
              </span>
              {compareAtLabel && discountPercentage > 0 && (
                <span className="text-xs text-muted-foreground line-through sm:text-sm">
                  {compareAtLabel}
                </span>
              )}
            </div>

            {/* Rating */}
            {showRating && product.reviewCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">
                  {product.rating.toFixed(1)}
                </span>
                <span className="hidden sm:inline">
                  ({product.reviewCount}{" "}
                  {t("common.reviews").toLowerCase()}
                  )
                </span>
              </div>
            )}
          </div>

          {preorderAvailable && (preorderDateLabel || preorderReserveLabel) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 sm:text-xs">
              {preorderDateLabel ? <span>Ships {preorderDateLabel}</span> : null}
              {preorderDateLabel && preorderReserveLabel ? (
                <span className="text-muted-foreground">/</span>
              ) : null}
              {preorderReserveLabel ? <span>{preorderReserveLabel}</span> : null}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
});

// ============================================
// Skeleton Loader
// ============================================

export function ModernProductCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <Skeleton className="aspect-square rounded-2xl" />
      <div className="space-y-1.5 px-0.5">
        <div className="flex gap-1">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Grid Component for Easy Usage
// ============================================

export interface ModernProductGridProps {
  products: ModernProduct[];
  locale: Locale;
  columns?: 2 | 3 | 4 | 5;
  showQuickView?: boolean;
  onQuickView?: (product: ModernProduct) => void;
  className?: string;
}

export function ModernProductGrid({
  products,
  locale,
  columns = 4,
  showQuickView = true,
  onQuickView,
  className,
}: ModernProductGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  };

  return (
    <div className={cn("grid gap-5", gridCols[columns], className)}>
      {products.map((product) => (
        <ModernProductCard
          key={product._id}
          product={product}
          locale={locale}
          showQuickView={showQuickView}
          onQuickView={onQuickView}
        />
      ))}
    </div>
  );
}

// ============================================
// Horizontal Scroll Component
// ============================================

export interface ModernProductScrollProps {
  products: ModernProduct[];
  locale: Locale;
  title?: string;
  subtitle?: string;
  showQuickView?: boolean;
  onQuickView?: (product: ModernProduct) => void;
  className?: string;
}

export function ModernProductScroll({
  products,
  locale,
  title,
  subtitle,
  showQuickView = true,
  onQuickView,
  className,
}: ModernProductScrollProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {(title || subtitle) && (
        <div>
          {title && (
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          )}
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      )}
      <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
        {products.map((product) => (
          <div
            key={product._id}
            className="min-w-55 max-w-70 shrink-0 snap-start"
          >
            <ModernProductCard
              product={product}
              locale={locale}
              showQuickView={showQuickView}
              onQuickView={onQuickView}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Card with Built-in Quick View Modal
// ============================================

export type ModernProductCardWithModalProps = Omit<
  ModernProductCardProps,
  "onQuickView"
>;

export function ModernProductCardWithModal(
  props: ModernProductCardWithModalProps,
) {
  const [quickViewProduct, setQuickViewProduct] =
    useState<ModernProduct | null>(null);

  const handleQuickView = useCallback((product: ModernProduct) => {
    setQuickViewProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setQuickViewProduct(null);
  }, []);

  return (
    <>
      <ModernProductCard {...props} onQuickView={handleQuickView} />
      <ProductQuickViewModal
        product={quickViewProduct}
        locale={props.locale}
        open={!!quickViewProduct}
        onClose={handleCloseModal}
      />
    </>
  );
}

// ============================================
// Grid with Built-in Quick View Modal
// ============================================

export type ModernProductGridWithModalProps = Omit<
  ModernProductGridProps,
  "onQuickView"
>;

export function ModernProductGridWithModal({
  products,
  locale,
  columns = 4,
  showQuickView = true,
  className,
}: ModernProductGridWithModalProps) {
  const [quickViewProduct, setQuickViewProduct] =
    useState<ModernProduct | null>(null);

  const handleQuickView = useCallback((product: ModernProduct) => {
    setQuickViewProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setQuickViewProduct(null);
  }, []);

  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  };

  return (
    <>
      <div className={cn("grid gap-5", gridCols[columns], className)}>
        {products.map((product) => (
          <ModernProductCard
            key={product._id}
            product={product}
            locale={locale}
            showQuickView={showQuickView}
            onQuickView={handleQuickView}
          />
        ))}
      </div>
      <ProductQuickViewModal
        product={quickViewProduct}
        locale={locale}
        open={!!quickViewProduct}
        onClose={handleCloseModal}
      />
    </>
  );
}
