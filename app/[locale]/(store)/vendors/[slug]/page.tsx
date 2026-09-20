import { Suspense } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/config/i18n.config";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductFiltersMobile } from "@/components/products/product-filters-mobile";
import { ProductSkeleton } from "@/components/products/product-skeleton";
import { ProductShareButtons } from "@/components/products/product-share-buttons";
import { Separator } from "@/components/ui/separator";
import { AppImage } from "@/components/ui/app-image";
import { getStorefrontProductFilters } from "@/lib/products/storefront-product-filters";
import { getStorefrontVendorBySlug } from "@/lib/storefront-vendors";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VendorStorefrontPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, slug } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const [t, vendor, filters] = await Promise.all([
    getTranslations({ locale }),
    getStorefrontVendorBySlug(String(slug)),
    getStorefrontProductFilters({ vendor: String(slug) }),
  ]);

  if (!vendor) notFound();

  const category =
    typeof search.category === "string" ? search.category : undefined;
  const collection =
    typeof search.collection === "string" ? search.collection : undefined;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const minPrice =
    typeof search.minPrice === "string" ? search.minPrice : undefined;
  const maxPrice =
    typeof search.maxPrice === "string" ? search.maxPrice : undefined;
  const sortBy = typeof search.sortBy === "string" ? search.sortBy : "popular";
  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;

  return (
    <div className="container mx-auto px-4 py-8">
      <section className="mb-8 overflow-hidden rounded-2xl border bg-card">
        {vendor.banner ? (
          <div className="relative h-40 w-full sm:h-52">
            <AppImage
              src={vendor.banner}
              alt={vendor.storeName}
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
            {vendor.logo ? (
              <AppImage
                src={vendor.logo}
                alt={vendor.storeName}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                {vendor.storeName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">
                {t("vendor.storefront.title", {
                  storeName: vendor.storeName,
                })}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {vendor.description ||
                  t("vendor.storefront.subtitle")}
              </p>
            </div>
            <ProductShareButtons
              productName={vendor.storeName}
              image={vendor.logo || vendor.banner}
              shareSettings={vendor.shareSettings}
              shareText={`Check out ${vendor.storeName}`}
              className="shrink-0 sm:justify-end"
            />
          </div>
        </div>
      </section>

      <Separator className="mb-8" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <ProductFilters
            locale={locale as Locale}
            categories={filters.categories}
            collections={filters.collections}
            currentCategory={category}
            currentCollection={collection}
            currentMinPrice={minPrice}
            currentMaxPrice={maxPrice}
            currentSort={sortBy}
          />
        </aside>

        <div>
          <ProductFiltersMobile
            locale={locale as Locale}
            categories={filters.categories}
            collections={filters.collections}
            currentCategory={category}
            currentCollection={collection}
            currentMinPrice={minPrice}
            currentMaxPrice={maxPrice}
            currentSort={sortBy}
          />

          <Suspense fallback={<ProductSkeleton count={9} />}>
            <ProductGrid
              locale={locale as Locale}
              vendor={vendor.slug}
              category={category}
              collection={collection}
              search={searchQuery}
              minPrice={minPrice}
              maxPrice={maxPrice}
              sortBy={sortBy}
              page={page}
              emptyMessage={t("vendor.storefront.noProducts")}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
