"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/config/i18n.config";
import {
  BlogArticleCard,
  type BlogArticleCardData,
} from "@/components/store/blog/blog-article-card";

export type TopArticle = BlogArticleCardData;

interface Props {
  articles: TopArticle[];
  locale: Locale;
  title: string;
}

export function TopArticlesCarousel({ articles, locale, title }: Props) {
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
    const step = Math.max(320, Math.floor(el.clientWidth * 0.9));
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-7 sm:gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl md:text-[28px]">
          {title}
        </h2>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href={`/${locale}/blog`}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-foreground transition-colors hover:text-primary sm:gap-3 sm:text-sm"
          >
            All Articles
            <MoveRight className="h-4 w-5 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-8" strokeWidth={1.5} />
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-border/70 bg-background text-muted-foreground shadow-none hover:text-foreground"
              onClick={() => scrollByAmount(-1)}
              disabled={!canScrollLeft}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-border/70 bg-background text-muted-foreground shadow-none hover:text-foreground"
              onClick={() => scrollByAmount(1)}
              disabled={!canScrollRight}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth sm:gap-4 [-ms-overflow-style:none] [scrollbar-width:none] lg:gap-5 [&::-webkit-scrollbar]:hidden"
      >
        {articles.map((a) => (
          <div
            key={a._id}
            className="shrink-0 basis-[78%] sm:basis-[48%] lg:basis-[32%]"
          >
            <BlogArticleCard article={a} locale={locale} />
          </div>
        ))}
      </div>
    </div>
  );
}
