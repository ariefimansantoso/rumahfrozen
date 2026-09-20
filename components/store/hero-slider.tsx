"use client";

import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

export interface HeroSlide {
  imageSrc: string;
  alt?: string;
  href?: string;
}

interface HeroSliderProps {
  slides: HeroSlide[];
  className?: string;
}

export function HeroSlider({ slides, className }: HeroSliderProps) {
  const validSlides = slides.filter(
    (s) => s.imageSrc && s.imageSrc.trim() !== "",
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  const activeIndex = selectedIndex ?? emblaApi?.selectedScrollSnap() ?? 0;

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (!validSlides.length) {
    return (
      <div
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40",
          "aspect-[1360/314]",
          className,
        )}
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(15,23,42,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <ImageOff className="h-10 w-10 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "aspect-[1360/314]",
        className,
      )}
    >
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {validSlides.map((slide, index) => {
            const inner = (
              <AppImage
                src={slide.imageSrc}
                alt={slide.alt || ""}
                fill
                sizes="100vw"
                priority={index === 0}
                className="object-cover object-center"
              />
            );

            return (
              <div
                key={index}
                className="relative h-full min-w-0 flex-[0_0_100%]"
              >
                {slide.href ? (
                  <Link href={slide.href} className="block h-full w-full">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
            );
          })}
        </div>
      </div>

      {validSlides.length > 1 && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1.5 sm:bottom-4 sm:right-4">
          {validSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={activeIndex === index}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                activeIndex === index
                  ? "w-6 bg-foreground"
                  : "w-1.5 bg-foreground/30 hover:bg-foreground/50",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
