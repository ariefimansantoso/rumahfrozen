import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale } from "@/config/i18n.config";
import { type HomeFromInstagramItem } from "@/lib/home-page-config";

interface HomeFromInstagramProps {
  locale: Locale;
  className?: string;
  title?: string;
  items?: HomeFromInstagramItem[];
}

function buildHref(locale: Locale, href: string): string {
  if (!href) return `/${locale}`;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) return href;
  return `/${locale}${href.startsWith("/") ? href : `/${href}`}`;
}

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function HomeFromInstagram({
  locale,
  className,
  title,
  items,
}: HomeFromInstagramProps) {
  const sourceItems = items && items.length > 0 ? items : Array.from({ length: 5 }, () => ({ imageSrc: "", href: "" }));

  return (
    <section className={cn("py-5 lg:py-8", className)}>
      <div className="container mx-auto px-4">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl md:text-3xl">
          {title || "From Instagram"}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-5">
          {sourceItems.map((item, index) => {
            const href = buildHref(locale, item.href);
            const external = isExternalHref(item.href);

            return (
              <Link
                key={index}
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="group relative isolate aspect-square overflow-hidden rounded-sm border border-dashed border-border bg-muted/40 sm:rounded-md"
              >
                {item.imageSrc ? (
                  <AppImage
                    src={item.imageSrc}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
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
          })}
        </div>
      </div>
    </section>
  );
}
