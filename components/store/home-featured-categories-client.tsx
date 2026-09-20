"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/config/i18n.config";
import { AppImage } from "@/components/ui/app-image";
import { useTranslations } from "next-intl";
import { ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface FeaturedCategory {
  id: string;
  name: string;
  slug: string;
  image?: string;
}

interface HomeFeaturedCategoriesClientProps {
  locale: Locale;
  title: string;
  categories: FeaturedCategory[];
}

// Above this count the grid would wrap onto a second row, so we switch to a
// single-row horizontal slider with arrow controls instead.
const CAROUSEL_THRESHOLD = 8;

function CategoryCard({
  locale,
  category,
  className,
}: {
  locale: Locale;
  category: FeaturedCategory;
  className?: string;
}) {
  return (
    <Link
      href={`/${locale}/products?category=${category.slug}`}
      className={cn(
        "group flex flex-col items-center gap-1.5 sm:gap-3",
        className,
      )}
    >
      <div className="relative flex h-16 w-full items-center justify-center sm:h-25">
        {category.image ? (
          <AppImage
            src={category.image}
            alt={category.name}
            width={140}
            height={140}
            className="h-full w-auto max-w-[70%] object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <ImageOff className="h-8 w-8 text-muted-foreground/40 sm:h-10 sm:w-10" />
        )}
      </div>
      <span className="line-clamp-1 text-center text-[11px] font-semibold text-foreground sm:text-sm sm:font-bold">
        {category.name}
      </span>
    </Link>
  );
}

export function HomeFeaturedCategoriesClient({
  locale,
  title,
  categories,
}: HomeFeaturedCategoriesClientProps) {
  const t = useTranslations("home");
  const isCarousel = categories.length > CAROUSEL_THRESHOLD;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
    const step = Math.max(280, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isCarousel) return;
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
  }, [isCarousel, updateScrollState]);

  return (
    <section className="py-5 lg:py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-6">
          <h2 className="text-lg font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>

          {isCarousel && (
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
          )}
        </div>

        {isCarousel ? (
          <div
            ref={scrollerRef}
            className="mt-4 flex gap-2 overflow-x-auto pb-2 scroll-smooth sm:mt-6 sm:gap-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                locale={locale}
                category={category}
                className="shrink-0 basis-[22%] sm:basis-[22%] md:basis-[15.5%] lg:basis-[11.5%]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-6 md:grid-cols-6 lg:grid-cols-8">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                locale={locale}
                category={category}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
