"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Heart,
  X,
  Loader2,
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  Check,
  Zap,
} from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { ModelViewer } from "@/components/ui/model-viewer";
import { useCurrency } from "@/providers/currency-provider";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { useMultiVendorMode } from "@/providers/app-settings-provider";
import { toast } from "@/components/ui/toast-notification";
import { type Locale } from "@/config/i18n.config";
import { cn } from "@/lib/utils";
import type { ModernProduct } from "./modern-product-card";
import { trackAddToCart } from "@/lib/analytics/events";

// ============================================
// Types
// ============================================

type VariantOptionValue =
  | string
  | { optionId?: string; optionName?: string; valueId?: string; value: string };

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

interface ProductVariant {
  _id: string;
  sku?: string;
  price?: number;
  comparePrice?: number;
  stock?: number;
  preorder?: ProductPreorder;
  image?: string;
  mediaId?: string;
  optionValues?: VariantOptionValue[];
}

interface ProductMedia {
  _id: string;
  url: string;
  type?: "image" | "video" | "model" | string;
  alt?: string;
  position?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

type QuickViewMediaKind = "image" | "video" | "model";

type QuickViewMedia = {
  type: QuickViewMediaKind;
  url: string;
  alt?: string;
  thumbnailUrl?: string;
};

interface ProductOption {
  name: string;
  values: { _id: string; value: string; colorCode?: string; image?: string }[];
}

// ============================================
// Utility Functions
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

function isColorOption(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.includes("color") || lowerName.includes("colour");
}

function findVariant(
  variants: ProductVariant[] | undefined,
  selectedOptions: Record<string, string>
): ProductVariant | undefined {
  if (!variants?.length) return undefined;

  const selected = Object.entries(selectedOptions).filter(([, value]) => value);
  if (selected.length === 0) return undefined;

  return variants.find((v) => {
    const optionValues = v.optionValues;
    if (!Array.isArray(optionValues) || optionValues.length === 0) return false;

    return selected.every(([optionName, value]) =>
      optionValues.some((ov) => {
        const ovName = typeof ov === "string" ? "" : ov.optionName || "";
        const ovValue = typeof ov === "string" ? ov : ov.value || "";
        const nameMatches = ovName
          ? ovName.toLowerCase() === optionName.toLowerCase()
          : true;
        return nameMatches && ovValue.toLowerCase() === value.toLowerCase();
      })
    );
  });
}

function inferMediaType(media: {
  type?: string;
  mimeType?: string;
  url: string;
}): QuickViewMediaKind {
  const declaredType = media.type?.toLowerCase();
  if (declaredType === "model" || declaredType === "video") {
    return declaredType;
  }

  const mimeType = media.mimeType?.toLowerCase();
  if (mimeType?.startsWith("model/")) return "model";
  if (mimeType?.startsWith("video/")) return "video";

  const url = media.url.toLowerCase().split("?")[0] || "";
  if (
    url.endsWith(".glb") ||
    url.endsWith(".gltf") ||
    url.endsWith(".usdz")
  ) {
    return "model";
  }
  if (
    url.endsWith(".mp4") ||
    url.endsWith(".webm") ||
    url.endsWith(".mov") ||
    url.endsWith(".m4v")
  ) {
    return "video";
  }

  return "image";
}

function getCurrentMedia({
  currentVariant,
  media,
  images,
  productName,
}: {
  currentVariant?: ProductVariant;
  media?: ProductMedia[];
  images: string[];
  productName: string;
}): QuickViewMedia | null {
  if (currentVariant?.image) {
    return {
      type: "image",
      url: currentVariant.image,
      alt: productName,
    };
  }

  const variantMedia =
    currentVariant?.mediaId && Array.isArray(media)
      ? media.find((item) => item._id === currentVariant.mediaId)
      : undefined;

  const selectedMedia =
    variantMedia ||
    (Array.isArray(media)
      ? [...media]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .find((item) => item.url)
      : undefined);

  if (selectedMedia) {
    return {
      type: inferMediaType(selectedMedia),
      url: selectedMedia.url,
      alt: selectedMedia.alt || productName,
      thumbnailUrl: selectedMedia.thumbnailUrl,
    };
  }

  const image = images.find(Boolean);
  return image
    ? {
        type: "image",
        url: image,
        alt: productName,
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

function formatPreorderDate(value?: ProductPreorder["releaseDate"]) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function calculatePreorderDueNow(params: {
  unitPrice: number;
  quantity: number;
  settings?: ProductPreorder;
}) {
  const lineTotal = Math.max(0, params.unitPrice * params.quantity);
  const mode = params.settings?.paymentMode || "full";
  if (mode === "pay_later") return { dueNow: 0, dueLater: lineTotal };
  if (mode !== "deposit") return { dueNow: lineTotal, dueLater: 0 };

  const rawValue = Number(params.settings?.depositValue || 0);
  const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
  const dueNow =
    params.settings?.depositType === "fixed"
      ? Math.min(lineTotal, value * params.quantity)
      : Math.min(lineTotal, (lineTotal * Math.min(value, 100)) / 100);
  return { dueNow, dueLater: Math.max(0, lineTotal - dueNow) };
}

// ============================================
// Props
// ============================================

export interface ProductQuickViewModalProps {
  product: ModernProduct | null;
  locale: Locale;
  open: boolean;
  onClose: () => void;
}

// ============================================
// Component
// ============================================

export function ProductQuickViewModal({
  product,
  locale,
  open,
  onClose,
}: ProductQuickViewModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const { currency, formatPrice } = useCurrency();
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();
  const { isMultiVendor } = useMultiVendorMode();
  const tf = (key: string, fallback: string) =>
    t.has(key) ? t(key) : fallback;

  const modalRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isModelInteractive, setIsModelInteractive] = useState(false);
  const productId = product?._id;

  // Animation handling
  useEffect(() => {
    let frame: number | undefined;

    if (open) {
      frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      document.body.style.overflow = "hidden";
    } else {
      frame = requestAnimationFrame(() => {
        setIsVisible(false);
      });
      document.body.style.overflow = "";
    }

    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      document.body.style.overflow = "";
    };
  }, [open]);

  // Reset state when product changes
  useEffect(() => {
    if (!productId) return;

    const frame = requestAnimationFrame(() => {
      setQuantity(1);
      setSelectedOptions({});
      setIsModelInteractive(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [productId]);

  // Keyboard handler (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!open || !product) return null;

  const inWishlist = isInWishlist(product._id);
  const images = product.images || [];
  const options = (product.options || []) as ProductOption[];
  const variants = product.variants as ProductVariant[] | undefined;

  // Find current variant based on selections
  const currentVariant = findVariant(variants, selectedOptions);

  const media = (product as unknown as { media?: ProductMedia[] }).media;
  const currentMedia = getCurrentMedia({
    currentVariant,
    media,
    images,
    productName: product.name,
  });
  const currentImage =
    currentMedia?.type === "image"
      ? currentMedia.url
      : currentMedia?.thumbnailUrl || images[0];

  // Get current price and stock
  const currentPrice = currentVariant?.price ?? product.price;
  const currentComparePrice = currentVariant?.comparePrice ?? product.comparePrice;
  const currentStock = currentVariant?.stock ?? product.stock;
  const selectedPreorder = currentVariant?.preorder?.enabled
    ? currentVariant.preorder
    : product.preorder;
  const preorderAvailable =
    isPreorderOpen(selectedPreorder) &&
    (selectedPreorder?.preorderOnly || currentStock <= 0);
  const preorderRemaining = getPreorderRemaining(selectedPreorder);
  const maxPurchasableQuantity = preorderAvailable
    ? Math.min(
        100,
        Number.isFinite(preorderRemaining) ? preorderRemaining : 100,
      )
    : currentStock;
  const isUnavailable = currentStock === 0 && !preorderAvailable;
  const preorderDateLabel = formatPreorderDate(selectedPreorder?.releaseDate);
  const preorderLimit = Number(selectedPreorder?.limit || 0);
  const preorderReserved = Math.max(
    0,
    Number(selectedPreorder?.reservedQuantity || 0),
  );
  const preorderTerms = calculatePreorderDueNow({
    unitPrice: currentPrice,
    quantity,
    settings: selectedPreorder,
  });

  // Calculate discount percentage
  const discountPercentage =
    currentComparePrice && currentComparePrice > currentPrice
      ? Math.round(((currentComparePrice - currentPrice) / currentComparePrice) * 100)
      : 0;

  // Get category from product
  const category =
    isMultiVendor && product.vendorId?.storeName
      ? product.vendorId.storeName
      : t("product.category");

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const newValue = prev + delta;
      if (newValue < 1) return 1;
      if (newValue > maxPurchasableQuantity) return maxPurchasableQuantity;
      return newValue;
    });
  };

  const handleOptionSelect = (optionName: string, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: value,
    }));
  };

  const handleAddToCart = async () => {
    if (isUnavailable || isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      await addItem({
        productId: product._id,
        name: product.name,
        price: currentPrice,
        image: currentImage,
        quantity,
        variantId: currentVariant?._id,
      });
      trackAddToCart({
        currency: currency.code,
        value: currentPrice * quantity,
        items: [
          {
            item_id: String(product._id),
            item_name: product.name,
            item_variant: currentVariant?._id,
            sku: currentVariant?.sku,
            price: currentPrice,
            quantity,
          },
        ],
      });
      toast.success(t("cart.itemAdded"));
      onClose();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (isUnavailable || isBuyingNow) return;

    setIsBuyingNow(true);
    try {
      await addItem({
        productId: product._id,
        name: product.name,
        price: currentPrice,
        image: currentImage,
        quantity,
        variantId: currentVariant?._id,
      });
      trackAddToCart({
        currency: currency.code,
        value: currentPrice * quantity,
        items: [
          {
            item_id: String(product._id),
            item_name: product.name,
            item_variant: currentVariant?._id,
            sku: currentVariant?.sku,
            price: currentPrice,
            quantity,
          },
        ],
      });
      onClose();
      router.push(`/${locale}/checkout`);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsBuyingNow(false);
    }
  };

  const handleWishlistToggle = async () => {
    if (isTogglingWishlist) return;

    if (!isAuthenticated) {
      router.push(`/${locale}/login?callbackUrl=/${locale}/account/wishlist`);
      onClose();
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

  // Render color option with circular swatches
  const renderColorOption = (option: ProductOption) => {
    const selectedValue = selectedOptions[option.name];

    return (
      <div key={option.name} className="mb-2 sm:mb-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground sm:mb-3 sm:gap-2 sm:text-sm">
          <span>{option.name}:</span>
          {selectedValue && (
            <span className="font-normal text-muted-foreground">{selectedValue}</span>
          )}
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-2 sm:gap-2">
          {option.values.map((v) => {
            const isSelected = selectedValue === v.value;
            const colorCode = getColorCode(v.value, v.colorCode);
            const isLight = colorCode === "#ffffff" || colorCode === "#fffdd0" || colorCode === "#fef3c7";

            return (
              <button
                key={v._id}
                onClick={() => handleOptionSelect(option.name, v.value)}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full transition-all sm:h-9 sm:w-9",
                  isSelected
                    ? "ring-2 ring-foreground ring-offset-2"
                    : "hover:ring-2 hover:ring-muted-foreground/50 hover:ring-offset-1",
                  isLight && "border border-muted-foreground/20"
                )}
                style={{ backgroundColor: colorCode || "#e5e7eb" }}
                title={v.value}
                aria-label={v.value}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <Check
                    className={cn(
                      "h-3 w-3 sm:h-4 sm:w-4",
                      isLight || colorCode === "#fbbf24" || colorCode === "#eab308"
                        ? "text-foreground"
                        : "text-white"
                    )}
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render non-color option with pill buttons
  const renderPillOption = (option: ProductOption) => {
    const selectedValue = selectedOptions[option.name];

    return (
      <div key={option.name} className="mb-2 sm:mb-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground sm:mb-3 sm:gap-2 sm:text-sm">
          <span>{option.name}:</span>
          {selectedValue && (
            <span className="font-normal text-muted-foreground">{selectedValue}</span>
          )}
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-2 sm:gap-2">
          {option.values.map((v) => {
            const isSelected = selectedValue === v.value;

            return (
              <button
                key={v._id}
                onClick={() => handleOptionSelect(option.name, v.value)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-[11px] font-medium transition-all sm:h-9 sm:px-4 sm:text-sm",
                  isSelected
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-input hover:border-foreground/50"
                )}
                aria-pressed={isSelected}
              >
                {v.value}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-300 sm:p-4",
        isVisible ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
    >
      <div
        ref={modalRef}
        className={cn(
          "relative max-h-[82dvh] w-full max-w-[350px] overflow-y-auto rounded-xl bg-background shadow-2xl transition-all duration-300 sm:max-h-[calc(100dvh-1rem)] sm:max-w-md sm:rounded-2xl md:max-w-5xl md:overflow-hidden",
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground sm:right-4 sm:top-4 sm:h-8 sm:w-8"
          aria-label={t("common.close")}
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>

        <div className="grid md:grid-cols-2">
          {/* Left: Product Media - Full Width */}
          <div className="relative h-[10.25rem] min-h-0 bg-muted/10 sm:h-72 md:h-full md:min-h-[500px]">
            {currentMedia?.type === "model" ? (
              <div
                className="h-full w-full"
                onMouseEnter={() => setIsModelInteractive(true)}
                onMouseLeave={() => setIsModelInteractive(false)}
                onFocus={() => setIsModelInteractive(true)}
                onBlur={() => setIsModelInteractive(false)}
              >
                <ModelViewer
                  src={currentMedia.url}
                  alt={currentMedia.alt || product.name}
                  autoRotate={!isModelInteractive}
                  cameraControls={isModelInteractive}
                  loading="lazy"
                  preferProxy
                  poster={currentMedia.thumbnailUrl}
                />
              </div>
            ) : currentMedia?.type === "video" ? (
              <video
                src={currentMedia.url}
                poster={currentMedia.thumbnailUrl}
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            ) : currentMedia?.url ? (
              <AppImage
                src={currentMedia.url}
                alt={currentMedia.alt || product.name}
                fill
                className="object-contain p-3 sm:p-5 md:p-0 md:object-cover"
                sizes="(max-width: 640px) 350px, (max-width: 768px) 448px, 50vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {t("common.noImage")}
              </div>
            )}

            {/* Discount Badge - Top Left */}
            {discountPercentage > 0 && (
              <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
                <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium text-white sm:px-2.5 sm:py-1 sm:text-xs">
                  -{discountPercentage}%
                </span>
              </div>
            )}

            {/* Wishlist Button - Top Right on Image */}
            <button
              onClick={handleWishlistToggle}
              disabled={isTogglingWishlist}
              className={cn(
                "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all sm:right-4 sm:top-4 sm:h-10 sm:w-10",
                inWishlist
                  ? "bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-300"
                  : "bg-background/85 text-muted-foreground hover:bg-background hover:text-foreground backdrop-blur border border-border/60"
              )}
              aria-label={
                inWishlist
                  ? t("wishlist.removeFromWishlist")
                  : t("wishlist.addToWishlist")
              }
            >
              {isTogglingWishlist ? (
                <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
              ) : (
                <Heart
                  className={cn("h-4 w-4 sm:h-5 sm:w-5", inWishlist && "fill-red-500 text-red-500")}
                />
              )}
            </button>
          </div>

          {/* Right: Product Details */}
          <div className="flex max-h-none flex-col overflow-visible p-3 sm:p-6 md:max-h-none md:overflow-visible md:p-8">
            {/* Category */}
            <p className="mb-0.5 text-[11px] text-muted-foreground sm:mb-1 sm:text-sm">{category}</p>

            {/* Product Name */}
            <h2
              id="quick-view-title"
              className="mb-2 text-[13px] font-semibold leading-snug text-foreground sm:text-xl md:mb-4 md:text-2xl"
            >
              {product.name}
            </h2>

            {/* Price */}
            <div className="mb-3 flex items-baseline gap-2 sm:mb-6 sm:gap-3">
              {currentComparePrice && currentComparePrice > currentPrice && (
                <span className="text-sm text-muted-foreground line-through sm:text-base">
                  {formatPrice(currentComparePrice)}
                </span>
              )}
              <span className="text-base font-bold text-orange-500 sm:text-xl">
                {formatPrice(currentPrice)}
              </span>
            </div>

            {/* Product Options */}
            <div className="flex-1">
              {options.map((option) =>
                isColorOption(option.name)
                  ? renderColorOption(option)
                  : renderPillOption(option)
              )}
            </div>

            {/* Quantity and Actions */}
            <div className="mt-2 space-y-2 border-t pt-2.5 sm:mt-4 sm:space-y-3 sm:pt-4">
              {/* First Row: Quantity + Add to Cart */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Quantity Selector */}
                <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setQuantity(
                        Math.min(Math.max(1, val), maxPurchasableQuantity),
                      );
                    }}
                    className="h-8 w-9 border-none bg-transparent text-center text-[11px] font-medium focus:outline-none [appearance:textfield] sm:h-11 sm:w-12 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    min={1}
                    max={maxPurchasableQuantity}
                    aria-label={t("common.quantity")}
                  />
                  <div className="flex flex-col border-l">
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= maxPurchasableQuantity}
                      className="flex h-4 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:h-[22px] sm:w-8"
                      aria-label="Increase quantity"
                    >
                      <ChevronUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="flex h-4 w-6 items-center justify-center border-t text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:h-[22px] sm:w-8"
                      aria-label="Decrease quantity"
                    >
                      <ChevronDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isUnavailable || isAddingToCart}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition-all sm:h-11 sm:gap-2 sm:px-6 sm:text-sm",
                    isUnavailable
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  )}
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-3 w-3 animate-spin sm:h-4 sm:w-4" />
                  ) : (
                    <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                  {preorderAvailable
                    ? tf("product.preorderNow", "Pre-order now")
                    : isUnavailable
                    ? t("common.outOfStock")
                    : t("common.addToCart")}
                </button>
              </div>

              {/* Second Row: Buy Now Button */}
              <button
                onClick={handleBuyNow}
                disabled={isUnavailable || isBuyingNow}
                className={cn(
                  "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition-all sm:h-11 sm:gap-2 sm:px-6 sm:text-sm",
                  isUnavailable
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {isBuyingNow ? (
                  <Loader2 className="h-3 w-3 animate-spin sm:h-4 sm:w-4" />
                ) : (
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
                {preorderAvailable
                  ? tf("product.preorderCheckout", "Pre-order checkout")
                  : t("common.buyNow")}
              </button>

              {/* Stock Info - reserved height to keep layout stable */}
              <div className="min-h-3">
                {preorderAvailable && (
                  <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-2.5 text-[11px] text-blue-800 sm:p-3 sm:text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {preorderDateLabel
                          ? `Ships ${preorderDateLabel}`
                          : tf("product.preorder", "Pre-order")}
                      </span>
                      {Number.isFinite(preorderRemaining) ? (
                        <span>{Math.max(0, preorderRemaining)} left</span>
                      ) : null}
                    </div>
                    {preorderLimit > 0 ? (
                      <p>
                        {preorderReserved} of {preorderLimit} reservations claimed
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2 rounded bg-white/70 p-2">
                      <span>Due today {formatPrice(preorderTerms.dueNow)}</span>
                      <span>Later {formatPrice(preorderTerms.dueLater)}</span>
                    </div>
                  </div>
                )}
                {!preorderAvailable && currentStock > 0 && currentStock <= 10 && (
                  <p className="text-[11px] text-orange-500 sm:text-xs">
                    {t("product.lowStock", {
                      count: currentStock,
                      defaultMessage: `Only ${currentStock} left in stock`,
                    })}
                  </p>
                )}
              </div>

              {/* View Full Details Link */}
              <Link
                href={`/${locale}/products/${product.slug}`}
                onClick={onClose}
                className="block pt-0.5 text-center text-[11px] text-primary hover:underline sm:pt-1 sm:text-sm"
              >
                {t("product.viewFullDetails")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
