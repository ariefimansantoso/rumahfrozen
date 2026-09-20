import { Suspense } from "react";
import { type Locale } from "@/config/i18n.config";
import { Separator } from "@/components/ui/separator";
import { ProductGrid } from "@/components/products/product-grid";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductFiltersMobile } from "@/components/products/product-filters-mobile";
import { ProductSkeleton } from "@/components/products/product-skeleton";
import { getStorefrontProductFilters } from "@/lib/products/storefront-product-filters";
import { SearchAnalytics } from "@/components/analytics/search-analytics";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const { categories, collections } = await getStorefrontProductFilters();

  // Extract search params
  const category =
    typeof search.category === "string" ? search.category : undefined;
  const brand = typeof search.brand === "string" ? search.brand : undefined;
  const collection =
    typeof search.collection === "string" ? search.collection : undefined;
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const minPrice =
    typeof search.minPrice === "string" ? search.minPrice : undefined;
  const maxPrice =
    typeof search.maxPrice === "string" ? search.maxPrice : undefined;
  const sortBy = typeof search.sortBy === "string" ? search.sortBy : "popular";
  const page = typeof search.page === "string" ? parseInt(search.page) : 1;

  return (
    <div className="container mx-auto px-4 py-8">
      <SearchAnalytics query={searchQuery} />
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {t("nav.allProducts")}
        </h1>
        <p className="text-muted-foreground">
          {searchQuery
            ? `${t("common.search")}: "${searchQuery}"`
            : t("productsPage.subtitle")}
        </p>
      </div>

      <Separator className="mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
        {/* Filters Sidebar (desktop) */}
        <aside className="hidden lg:block">
          <ProductFilters
            locale={locale as Locale}
            categories={categories}
            collections={collections}
            currentCategory={category}
            currentCollection={collection}
            currentMinPrice={minPrice}
            currentMaxPrice={maxPrice}
            currentSort={sortBy}
          />
        </aside>

        {/* Products Grid */}
        <div>
          {/* Filters trigger (mobile) */}
          <ProductFiltersMobile
            locale={locale as Locale}
            categories={categories}
            collections={collections}
            currentCategory={category}
            currentCollection={collection}
            currentMinPrice={minPrice}
            currentMaxPrice={maxPrice}
            currentSort={sortBy}
          />

          <Suspense fallback={<ProductSkeleton count={9} />}>
            <ProductGrid
              locale={locale as Locale}
              category={category}
              collection={collection}
              brand={brand}
              search={searchQuery}
              minPrice={minPrice}
              maxPrice={maxPrice}
              sortBy={sortBy}
              page={page}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
