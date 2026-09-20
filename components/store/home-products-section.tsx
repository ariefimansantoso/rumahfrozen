import { type Locale } from "@/config/i18n.config";
import { type ModernProduct } from "@/components/products/modern-product-card";
import { HomeProductsSectionClient } from "./home-products-section-client";
import { HomeProductsSectionInfinite } from "./home-products-section-infinite";
import {
  getStorefrontProductCards,
  type StorefrontProductCardQuery,
} from "@/lib/products/storefront-product-cards";
import { getStorefrontProducts } from "@/lib/products/storefront-products";
import { getStorefrontCategories } from "@/lib/storefront-categories";
import {
  FEATURED_PRODUCTS_LIMIT_MAX,
  FEATURED_PRODUCTS_LIMIT_MIN,
  type FeaturedProductsSource,
} from "@/lib/home-page-config";

// Page size for the "all" (infinite scroll) source.
const INFINITE_PAGE_SIZE = 12;

type ProductCategory =
  | string
  | {
      _id?: string;
      name?: string;
      slug?: string;
    };

type HomeProduct = ModernProduct & {
  category?: ProductCategory;
};

function buildSourceQuery(
  source: Exclude<FeaturedProductsSource, "all">,
  limit: number,
  productIds: string[],
): StorefrontProductCardQuery | null {
  if (source === "manual") {
    const ids = productIds.filter(Boolean);
    if (ids.length === 0) return null;
    return {
      ids,
      limit: Math.min(ids.length, FEATURED_PRODUCTS_LIMIT_MAX),
    };
  }

  const query: StorefrontProductCardQuery = {
    limit,
    sortBy: "createdAt",
    sortOrder: "desc",
  };

  if (source === "discounted") query.onSale = true;
  if (source === "featured") query.featured = true;
  return query;
}

export async function HomeProductsSection({
  locale,
  title,
  source = "all",
  limit = 8,
  productIds = [],
}: {
  locale: Locale;
  title?: string;
  source?: FeaturedProductsSource;
  limit?: number;
  productIds?: string[];
}) {
  if (source === "all") {
    const [result, categoryResult] = await Promise.all([
      getStorefrontProducts<HomeProduct>({
        page: 1,
        limit: INFINITE_PAGE_SIZE,
        sortBy: "createdAt",
        sortOrder: "desc",
        cardFieldsOnly: true,
      }),
      getStorefrontCategories({ flat: true, limit: 50 }),
    ]);

    if (!result.data.length) return null;

    const categories = categoryResult.categories.map((category) => ({
      name: category.name,
      slug: category.slug,
    }));

    return (
      <HomeProductsSectionInfinite
        locale={locale}
        title={title}
        categories={categories}
        initialProducts={result.data}
        initialHasNext={result.pagination.hasNext}
        pageSize={INFINITE_PAGE_SIZE}
      />
    );
  }

  const safeLimit = Math.min(
    FEATURED_PRODUCTS_LIMIT_MAX,
    Math.max(FEATURED_PRODUCTS_LIMIT_MIN, Math.floor(limit) || 8),
  );

  const sourceQuery = buildSourceQuery(source, safeLimit, productIds);
  let products: HomeProduct[] = sourceQuery
    ? await getStorefrontProductCards(sourceQuery)
    : [];

  // Confirmed fallback: when the chosen logic yields nothing, show the latest
  // products so the section is never empty.
  if (products.length === 0 && source !== "latest") {
    products = await getStorefrontProductCards({
      limit: safeLimit,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  }

  if (!products.length) return null;

  return (
    <HomeProductsSectionClient
      locale={locale}
      products={products.slice(0, safeLimit)}
      title={title}
    />
  );
}
