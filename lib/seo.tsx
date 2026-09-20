import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { appConfig } from "@/config/app.config";
import { DEFAULT_FAVICON_URL } from "@/config/branding.config";
import { locales, localeConfig, type Locale } from "@/config/i18n.config";

interface GenerateMetadataOptions {
  locale: Locale;
  page: string;
  params?: Record<string, string>;
  images?: string[];
  noIndex?: boolean;
}

/**
 * Generate SEO-optimized metadata for a page
 */
export async function generatePageMetadata({
  locale,
  page,
  images = [],
  noIndex = false,
}: GenerateMetadataOptions): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "metadata" });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Get page-specific title and description
  const title = t("title");
  const description = t("description");

  // Build alternate links for hreflang
  const alternates: Record<string, string> = {};
  const languages: Record<string, string> = {};

  for (const loc of locales) {
    const url = `${baseUrl}/${loc}${page === "/" ? "" : page}`;
    alternates[loc] = url;
    languages[loc] = url;
  }

  // Default OG image
  const ogImages = images.length > 0 ? images : [`${baseUrl}/og-image.jpg`];

  return {
    title: {
      default: title,
      template: `%s | ${appConfig.name}`,
    },
    description,
    keywords: t("keywords"),
    authors: [{ name: appConfig.name }],
    creator: appConfig.name,
    publisher: appConfig.name,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/${locale}${page === "/" ? "" : page}`,
      languages,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}${page === "/" ? "" : page}`,
      siteName: appConfig.name,
      images: ogImages.map((img) => ({
        url: img,
        width: 1200,
        height: 630,
        alt: title,
      })),
      locale: locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    icons: {
      icon: DEFAULT_FAVICON_URL,
      shortcut: DEFAULT_FAVICON_URL,
      apple: "/apple-touch-icon.png",
    },
  };
}

/**
 * Generate JSON-LD structured data for organization
 */
export function generateOrganizationJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: appConfig.name,
    description: appConfig.description,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+880-1700-000000",
      contactType: "customer service",
      availableLanguage: locales.map((l) => localeConfig[l].name),
    },
    sameAs: [
      "https://facebook.com/minimart",
      "https://twitter.com/minimart",
      "https://instagram.com/minimart",
    ],
  };
}

/**
 * Strip HTML tags from a string for plain text SEO meta description
 * and JSON-LD structured data.
 */
function stripHtmlForSeo(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate text to a maximum length, adding an ellipsis when exceeded.
 * Used for SEO descriptions and JSON-LD text fields.
 */
function truncateForSeo(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

/**
 * Generate JSON-LD structured data for a product
 */
export function generateProductJsonLd(product: {
  name: string;
  description: string;
  // For multi-variant products, supply priceRange to emit AggregateOffer.
  // Single-variant products can leave it undefined.
  price?: number;
  priceRange?: { min: number; max: number };
  currency: string;
  // First image is required for backwards compatibility; pass additional
  // images to surface them all in Google Images search.
  image: string;
  images?: string[];
  sku?: string;
  // Brand (manufacturer) — preferred over vendorId for structured data.
  brand?: string;
  category?: { name: string; slug: string };
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  url: string;
  availability?: "instock" | "outofstock" | "preorder" | "discontinued";
}) {
  const availabilityMap = {
    instock: "https://schema.org/InStock",
    outofstock: "https://schema.org/OutOfStock",
    preorder: "https://schema.org/PreOrder",
    discontinued: "https://schema.org/Discontinued",
  } as const;
  const availabilityUrl =
    availabilityMap[
      product.availability ?? (product.inStock ? "instock" : "outofstock")
    ];

  const plainDescription = truncateForSeo(
    stripHtmlForSeo(product.description || ""),
    5000,
  );

  // Surface all product images (capped to 10) so Google Images can index them.
  const imageList = Array.from(
    new Set(
      [product.image, ...(product.images || [])]
        .filter(
          (img): img is string =>
            typeof img === "string" && img.trim().length > 0,
        )
        .map((img) => img.trim()),
    ),
  ).slice(0, 10);

  const hasPriceRange =
    product.priceRange &&
    typeof product.priceRange.min === "number" &&
    typeof product.priceRange.max === "number";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: plainDescription,
    image: imageList.length > 0 ? imageList : product.image,
    sku: product.sku,
    brand: product.brand
      ? {
          "@type": "Brand",
          name: product.brand,
        }
      : undefined,
    category: product.category?.name,
    offers: hasPriceRange
      ? {
          "@type": "AggregateOffer",
          priceCurrency: product.currency,
          lowPrice: product.priceRange!.min,
          highPrice: product.priceRange!.max,
          availability: availabilityUrl,
          url: product.url,
        }
      : {
          "@type": "Offer",
          price: product.price,
          priceCurrency: product.currency,
          availability: availabilityUrl,
          url: product.url,
        },
    aggregateRating:
      product.rating && product.rating > 0 && product.reviewCount
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          }
        : undefined,
  };
}

/**
 * Generate JSON-LD structured data for breadcrumbs
 */
export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate JSON-LD structured data for a website
 */
export function generateWebsiteJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: appConfig.name,
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/en/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * JsonLd Component for inserting structured data into pages
 */
export function JsonLd({ data, id }: { data: object; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
      suppressHydrationWarning
    />
  );
}
