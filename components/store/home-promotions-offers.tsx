import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale } from "@/config/i18n.config";

export interface PromotionOfferCard {
  imageSrc: string;
  href: string;
}

interface HomePromotionsOffersProps {
  locale: Locale;
  className?: string;
  cards?: PromotionOfferCard[];
}

const FALLBACK_CARDS: PromotionOfferCard[] = [
  { imageSrc: "", href: "/products" },
  { imageSrc: "", href: "/products" },
  { imageSrc: "", href: "/products" },
  { imageSrc: "", href: "/products" },
  { imageSrc: "", href: "/products" },
];

function resolveCard(
  card: PromotionOfferCard | undefined,
  fallback: PromotionOfferCard,
): PromotionOfferCard {
  if (!card) return fallback;
  return {
    imageSrc: card.imageSrc || fallback.imageSrc,
    href: card.href || fallback.href,
  };
}

function buildHref(locale: Locale, href: string): string {
  if (!href) return `/${locale}`;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) return href;
  return `/${locale}${href.startsWith("/") ? href : `/${href}`}`;
}

export function HomePromotionsOffers({
  locale,
  className,
  cards,
}: HomePromotionsOffersProps) {
  const tall1 = resolveCard(cards?.[0], FALLBACK_CARDS[0]);
  const tall2 = resolveCard(cards?.[1], FALLBACK_CARDS[1]);
  const square1 = resolveCard(cards?.[2], FALLBACK_CARDS[2]);
  const square2 = resolveCard(cards?.[3], FALLBACK_CARDS[3]);
  const wide = resolveCard(cards?.[4], FALLBACK_CARDS[4]);

  return (
    <section className={cn("py-5 lg:py-8", className)}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-4 md:grid-rows-2">
          <BentoCard
            card={tall1}
            locale={locale}
            className="col-span-1 row-span-2 aspect-317/565"
            sizes="(max-width: 768px) 50vw, 25vw"
          />

          <BentoCard
            card={tall2}
            locale={locale}
            className="col-span-1 row-span-2 aspect-317/565"
            sizes="(max-width: 768px) 50vw, 25vw"
          />

          <BentoCard
            card={square1}
            locale={locale}
            className="col-span-1 row-span-1 aspect-317/272"
            sizes="(max-width: 768px) 50vw, 25vw"
          />

          <BentoCard
            card={square2}
            locale={locale}
            className="col-span-1 row-span-1 aspect-317/272"
            sizes="(max-width: 768px) 50vw, 25vw"
          />

          <BentoCard
            card={wide}
            locale={locale}
            className="col-span-2 row-span-1 aspect-654/272"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  card,
  locale,
  className,
  sizes,
}: {
  card: PromotionOfferCard;
  locale: Locale;
  className?: string;
  sizes: string;
}) {
  return (
    <Link
      href={buildHref(locale, card.href)}
      className={cn(
        "group relative isolate overflow-hidden rounded-sm bg-muted sm:rounded-md",
        className,
      )}
    >
      {card.imageSrc ? (
        <AppImage
          src={card.imageSrc}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <ImageOff className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
    </Link>
  );
}
