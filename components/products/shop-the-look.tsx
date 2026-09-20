"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppImage } from "@/components/ui/app-image";
import { type Locale } from "@/config/i18n.config";
import { cn } from "@/lib/utils";

interface ShopTheLookImage {
  id: string;
  url: string;
  alt?: string;
  linkedProductSlug?: string;
}

interface ShopTheLookProps {
  images: ShopTheLookImage[];
  locale: Locale;
}

export function ShopTheLook({ images, locale }: ShopTheLookProps) {
  const t = useTranslations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  if (!images || images.length === 0) return null;

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-12 border-t">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold">
          {t("product.shopTheLook")}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {images.map((image) => (
          <div key={image.id} className="flex-shrink-0 snap-start">
            {image.linkedProductSlug ? (
              <Link href={`/${locale}/products/${image.linkedProductSlug}`}>
                <div className="relative aspect-[3/4] w-80 rounded-lg overflow-hidden bg-muted group">
                  <AppImage
                    src={image.url}
                    alt={image.alt || "Shop the look"}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </Link>
            ) : (
              <div className="relative aspect-[3/4] w-80 rounded-lg overflow-hidden bg-muted">
                <AppImage
                  src={image.url}
                  alt={image.alt || "Shop the look"}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
