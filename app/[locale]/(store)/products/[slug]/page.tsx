import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { type Locale } from "@/config/i18n.config";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ProductDetails } from "@/components/products/product-details";
import { RelatedProducts } from "@/components/products/related-products";
import { RelatedProductsSkeleton } from "@/components/products/product-details-skeleton";
import {
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  JsonLd,
} from "@/lib/seo";
import {
  getLocalizedAlternates,
  getStorefrontIcons,
  getStorefrontMetadataSettings,
  normalizeMetadataText,
  truncateMetadataText,
} from "@/lib/storefront-metadata";
import { getStorefrontProductBySlug } from "@/lib/products/storefront-product-detail";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

async function getProduct(slug: string) {
  return getStorefrontProductBySlug(slug);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const [product, storeMetadata] = await Promise.all([
    getProduct(slug),
    getStorefrontMetadataSettings(),
  ]);

  if (!product) return {};

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const page = `/products/${slug}`;
  // Title priority: admin-set SEO pageTitle → product.title → product.name → store name.
  const title =
    normalizeMetadataText(
      product.seo?.pageTitle || product.title || product.name,
    ) || storeMetadata.storeName;
  // Description priority: admin metaDescription → product.shortDescription
  // → product.description → store metaDescription → store description → app default.
  const description =
    truncateMetadataText(
      normalizeMetadataText(
        product.seo?.metaDescription ||
          product.shortDescription ||
          product.description ||
          storeMetadata.seo.metaDescription ||
          storeMetadata.storeDescription ||
          appConfig.description,
      ),
      160,
    ) || appConfig.description;
  const productImages: string[] = Array.isArray(product.images)
    ? product.images.filter(
        (image: unknown): image is string =>
          typeof image === "string" && image.trim().length > 0,
      )
    : [];
  const images: string[] =
    productImages.length > 0
      ? productImages
      : storeMetadata.seo.ogImage
        ? [storeMetadata.seo.ogImage]
        : [`${baseUrl}/og-image.jpg`];
  const productTags: string[] = Array.isArray(product.tags)
    ? product.tags.filter(
        (tag: unknown): tag is string =>
          typeof tag === "string" && tag.trim().length > 0,
      )
    : [];
  // Keywords priority: product tags → store meta keywords.
  const keywords =
    productTags.length > 0 ? productTags : storeMetadata.seo.metaKeywords;
  // OG image alt should describe the product, not echo the SEO title.
  const imageAlt = normalizeMetadataText(product.name) || title;

  // Twitter handle is parsed from settings.social.twitterUrl (admin-configured).
  const twitterHandle = storeMetadata.social?.twitterHandle;
  const twitterSite = twitterHandle ? `@${twitterHandle}` : undefined;

  // `product.priceRange` is set by the model pre-validate hook for both
  // multi-variant and single-variant products. Multi-variant products expose
  // min ≠ max, which downstream OG/JSON-LD use to emit AggregateOffer.
  const hasPriceRange =
    product.priceRange &&
    typeof product.priceRange.min === "number" &&
    typeof product.priceRange.max === "number";
  const productPrice = hasPriceRange
    ? product.priceRange.min
    : typeof product.price === "number"
      ? product.price
      : undefined;
  const productPriceMax = hasPriceRange ? product.priceRange.max : undefined;
  const productAvailability = product.stock > 0 ? "instock" : "oos";

  // Brand for OG/social: populated product.brand first, then vendor storeName.
  const productBrand =
    normalizeMetadataText(
      (product.brand as { name?: string } | undefined)?.name,
    ) || normalizeMetadataText(product.vendorId?.storeName);

  return {
    title,
    description,
    keywords,
    authors: [{ name: storeMetadata.storeName }],
    creator: storeMetadata.storeName,
    publisher: storeMetadata.storeName,
    metadataBase: new URL(baseUrl),
    alternates: getLocalizedAlternates({ baseUrl, locale, page }),
    // Next.js 15 only accepts a fixed set of OG types at runtime
    // (website/article/book/profile/music.*/video.*). `og:type: product`
    // throws `Invalid OpenGraph type: product`, so we keep `website` here
    // and surface product-specific tags via the `other` field below.
    // Google reads JSON-LD for product rich results; Facebook/Messenger
    // pick up `product:*` tags from `other` for richer link previews.
    openGraph: {
      type: "website",
      title,
      description,
      url: `${baseUrl}/${locale}${page}`,
      siteName: storeMetadata.storeName,
      images: images.map((url) => ({
        url,
        alt: imageAlt,
      })),
      locale,
    },
    other: {
      // Note: Next.js renders `other` entries as `<meta name="...">` (not
      // `<meta property="...">`), so we cannot emit a true `og:type: product`
      // here without a custom meta-tag injection. The product-specific tags
      // below are still picked up by Facebook/Messenger when the product
      // object extension is enabled, and JSON-LD remains the authoritative
      // source for Google product rich results.
      ...(productPrice !== undefined
        ? { "product:price:amount": String(productPrice) }
        : {}),
      "product:price:currency": storeMetadata.defaultCurrency,
      ...(productPriceMax && productPriceMax !== productPrice
        ? { "product:price:amount:max": String(productPriceMax) }
        : {}),
      "product:availability":
        productAvailability === "instock" ? "instock" : "oos",
      "product:retailer_item_id": product.sku || product.slug,
      ...(productBrand ? { "product:brand": productBrand } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
      ...(twitterSite ? { site: twitterSite, creator: twitterSite } : {}),
    },
    robots: { index: true, follow: true },
    icons: getStorefrontIcons(storeMetadata.faviconUrl),
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const [product, storeMetadata] = await Promise.all([
    getProduct(slug),
    getStorefrontMetadataSettings(),
  ]);
  const defaultCurrency = storeMetadata.defaultCurrency;

  if (!product) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const breadcrumbItems = [
    { name: t("common.home"), url: `${baseUrl}/${locale}` },
    { name: t("common.products"), url: `${baseUrl}/${locale}/products` },
    { name: product.name, url: `${baseUrl}/${locale}/products/${slug}` },
  ];

  return (
    <div className="container mx-auto px-4 py-8 lg:py-10">
      {/* JSON-LD — Google's authoritative source for product rich results.
          Mirrors the admin-defined SEO fields and product data so what
          merchants set in /admin/products/[id] reflects on the storefront. */}
      <JsonLd
        data={generateProductJsonLd({
          name: product.name,
          description: product.description,
          price: product.price,
          priceRange:
            product.priceRange &&
            typeof product.priceRange.min === "number" &&
            typeof product.priceRange.max === "number"
              ? {
                  min: product.priceRange.min,
                  max: product.priceRange.max,
                }
              : undefined,
          currency: defaultCurrency,
          image: product.images?.[0] || "",
          images: product.images,
          url: `${baseUrl}/${locale}/products/${slug}`,
          sku: product.sku,
          inStock: product.stock > 0,
          rating: product.rating,
          reviewCount: product.reviewCount,
          // Brand (manufacturer) takes precedence over vendor storeName.
          brand:
            normalizeMetadataText(
              (product.brand as { name?: string } | undefined)?.name,
            ) || normalizeMetadataText(product.vendorId?.storeName),
          category:
            product.category &&
            typeof (product.category as { name?: string }).name === "string"
              ? {
                  name: (product.category as { name: string; slug: string })
                    .name,
                  slug: (product.category as { name: string; slug: string })
                    .slug,
                }
              : undefined,
        })}
      />
      <JsonLd data={generateBreadcrumbJsonLd(breadcrumbItems)} />

      {/* Product Details — receives already-resolved data; the route-level
          loading.tsx covers the navigation fallback. */}
      <ProductDetails product={product} locale={locale as Locale} />

      {/* Reviews Section — client component with its own internal loading state. */}
      <section id="reviews" className="mt-12">
        <ReviewsList productId={product._id} locale={locale} />
      </section>

      {/* Related Products - "Customers also purchased" */}
      <section
        id="customers-also-purchased"
        className="mt-12 border-t border-border/70 py-12"
      >
        <Suspense fallback={<RelatedProductsSkeleton />}>
          <RelatedProducts
            productId={product._id}
            categoryId={product.category?._id || product.category}
            locale={locale as Locale}
            title={t("product.youMayAlsoLike")}
          />
        </Suspense>
      </section>
    </div>
  );
}
