"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ModernProductCardWithModal,
  type ModernProduct,
} from "@/components/products/modern-product-card";
import { type Locale } from "@/config/i18n.config";
import { useTranslations } from "next-intl";

interface RelatedProductsCarouselProps {
  products: ModernProduct[];
  locale: Locale;
  title: string;
}

// Show controls as soon as there is another related product to reveal.
const SCROLL_THRESHOLD = 1;

export function RelatedProductsCarousel({
  products,
  locale,
  title,
}: RelatedProductsCarouselProps) {
  const t = useTranslations();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const showArrows = products.length > SCROLL_THRESHOLD;

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 1);
    setCanScrollRight(left < max - 1);
  }, []);

  const scrollByAmount = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const firstItem = el.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(window.getComputedStyle(el).columnGap || "0");
    const step = firstItem
      ? firstItem.getBoundingClientRect().width + gap
      : Math.floor(el.clientWidth * 0.7);
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

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
    <div>
      <div className="mb-4 flex items-center justify-between gap-6 sm:mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {showArrows && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
              onClick={() => scrollByAmount(-1)}
              disabled={!canScrollLeft}
              aria-label={t("home.scrollLeft")}
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
              aria-label={t("home.scrollRight")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="flex max-w-full gap-4 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth snap-x snap-mandatory sm:gap-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div
            key={product._id}
            className="min-w-0 shrink-0 snap-start basis-[64%] sm:basis-[calc((100%_-_1.25rem)_/_2)] md:basis-[calc((100%_-_2.5rem)_/_3)] lg:basis-[calc((100%_-_3.75rem)_/_4)]"
          >
            <ModernProductCardWithModal
              product={product}
              locale={locale}
              showQuickView
            />
          </div>
        ))}
      </div>
    </div>
  );
}
