import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ImageOff, PackageSearch } from "lucide-react";
import { appConfig } from "@/config/app.config";
import { type Locale } from "@/config/i18n.config";
import { AppImage } from "@/components/ui/app-image";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ProductGrid, ProductSkeleton } from "@/components/products/product-grid";
import {
  getLocalizedAlternates,
  getStorefrontIcons,
  getStorefrontMetadataSettings,
  normalizeMetadataText,
  truncateMetadataText,
} from "@/lib/storefront-metadata";
import { getStorefrontCategoryBySlug } from "@/lib/storefront-categories";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getCategory(slug: string) {
  return getStorefrontCategoryBySlug(slug);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const [category, storeMetadata] = await Promise.all([
    getCategory(slug),
    getStorefrontMetadataSettings(),
  ]);

  if (!category) return {};

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const page = `/categories/${slug}`;
  const title =
    normalizeMetadataText(category.seo?.pageTitle || category.name) ||
    storeMetadata.storeName;
  const description =
    truncateMetadataText(
      normalizeMetadataText(
        category.seo?.metaDescription ||
          category.description ||
          storeMetadata.seo.metaDescription ||
          storeMetadata.storeDescription ||
          appConfig.description,
      ),
      160,
    ) || appConfig.description;
  const keywords =
    Array.isArray(category.seo?.tags) && category.seo.tags.length > 0
      ? category.seo.tags
      : storeMetadata.seo.metaKeywords;
  const images = category.image
    ? [category.image]
    : category.icon
      ? [category.icon]
      : storeMetadata.seo.ogImage
        ? [storeMetadata.seo.ogImage]
        : [`${baseUrl}/og-image.jpg`];

  return {
    title,
    description,
    keywords,
    authors: [{ name: storeMetadata.storeName }],
    creator: storeMetadata.storeName,
    publisher: storeMetadata.storeName,
    metadataBase: new URL(baseUrl),
    alternates: getLocalizedAlternates({ baseUrl, locale, page }),
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}${page}`,
      siteName: storeMetadata.storeName,
      images: images.map((url) => ({
        url,
        width: 1200,
        height: 630,
        alt: title,
      })),
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
    robots: { index: true, follow: true },
    icons: getStorefrontIcons(storeMetadata.faviconUrl),
  };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, slug } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const category = await getCategory(slug);

  if (!category) {
    notFound();
  }

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const sortBy =
    typeof search.sortBy === "string" ? search.sortBy : "popular";

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${locale}`}>
              {t("common.home")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${locale}/categories`}>
              {t("common.categories")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="mb-8 grid gap-6 rounded-md border bg-background p-5 sm:grid-cols-[180px_1fr] sm:p-6">
        <div className="relative aspect-square overflow-hidden rounded-md bg-muted/50">
          {category.image || category.icon ? (
            <AppImage
              src={(category.image || category.icon) as string}
              alt={category.name}
              fill
              sizes="180px"
              className="object-contain p-6"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground/55">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {category.name}
          </h1>
          {category.description ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              {category.description}
            </p>
          ) : null}
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <PackageSearch className="h-4 w-4" />
            {t("storeCategoryDetailPage.productsCount", {
              count: category.productCount,
            })}
          </p>
        </div>
      </section>

      <Suspense fallback={<ProductSkeleton count={12} />}>
        <ProductGrid
          locale={locale as Locale}
          category={category.slug}
          sortBy={sortBy}
          page={Number.isNaN(page) ? 1 : page}
          emptyMessage={t("storeCategoryDetailPage.empty")}
        />
      </Suspense>
    </div>
  );
}
