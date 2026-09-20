"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/config/i18n.config";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModernProductCard, type ModernProduct } from "@/components/products/modern-product-card";
import { useTranslations } from "next-intl";

// Loaded only when a shopper opens quick view, keeping the modal and its deps
// out of the initial section bundle.
const ProductQuickViewModal = dynamic(
  () =>
    import("@/components/products/product-quick-view-modal").then(
      (mod) => mod.ProductQuickViewModal,
    ),
  { ssr: false },
);

interface HomeNewArrivalsCarouselProps {
  products: ModernProduct[];
  locale: Locale;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function HomeNewArrivalsCarousel({
  products,
  locale,
  title = "New Arrivals.",
  subtitle = "",
  className,
}: HomeNewArrivalsCarouselProps) {
  const t = useTranslations("home");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<ModernProduct | null>(null);

  const handleQuickView = useCallback((product: ModernProduct) => {
    setQuickViewProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setQuickViewProduct(null);
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 1);
    setCanScrollRight(left < max - 1);
  }, []);

  const scrollByAmount = useCallback(
    (direction: -1 | 1) => {
      const el = scrollerRef.current;
      if (!el) return;
      const step = Math.max(320, Math.floor(el.clientWidth * 0.9));
      el.scrollBy({ left: direction * step, behavior: "smooth" });
    },
    []
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateScrollState();
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  if (!products.length) return null;

  return (
    <section className={cn("py-5 lg:py-8", className)}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-6">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl md:text-3xl">
            <span className="text-foreground">{title}</span>{" "}
            <span className="font-medium text-muted-foreground">{subtitle}</span>
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
              onClick={() => scrollByAmount(-1)}
              disabled={!canScrollLeft}
              aria-label={t("scrollLeft")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
              onClick={() => scrollByAmount(1)}
              disabled={!canScrollRight}
              aria-label={t("scrollRight")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="mt-4 flex gap-3 overflow-x-auto pb-2 scroll-smooth sm:mt-8 sm:gap-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <div
              key={product._id}
              className="shrink-0 basis-[46%] sm:basis-[48%] md:basis-[32%] lg:basis-[24%]"
            >
              <ModernProductCard product={product} locale={locale} onQuickView={handleQuickView} />
            </div>
          ))}
        </div>

        {quickViewProduct && (
          <ProductQuickViewModal
            product={quickViewProduct}
            locale={locale}
            open
            onClose={handleCloseModal}
          />
        )}
      </div>
    </section>
  );
}
