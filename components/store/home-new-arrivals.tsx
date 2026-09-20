import { type Locale } from "@/config/i18n.config";
import { HomeNewArrivalsCarousel } from "@/components/store/home-new-arrivals-carousel";
import { type ModernProduct } from "@/components/products/modern-product-card";
import {
  getStorefrontProductCards,
  type StorefrontProductCardQuery,
} from "@/lib/products/storefront-product-cards";
import {
  NEW_ARRIVALS_LIMIT_MAX,
  NEW_ARRIVALS_LIMIT_MIN,
  type NewArrivalsSource,
} from "@/lib/home-page-config";

async function fetchProducts(
  query: StorefrontProductCardQuery,
): Promise<ModernProduct[]> {
  return getStorefrontProductCards(query);
}

function buildSourceQuery(
  source: NewArrivalsSource,
  limit: number,
  productIds: string[],
): StorefrontProductCardQuery | null {
  if (source === "manual") {
    const ids = productIds.filter(Boolean);
    if (ids.length === 0) return null;
    return {
      ids,
      limit: Math.min(ids.length, NEW_ARRIVALS_LIMIT_MAX),
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

function buildLatestQuery(limit: number): StorefrontProductCardQuery {
  return {
    limit,
    sortBy: "createdAt",
    sortOrder: "desc",
  };
}

export async function HomeNewArrivals({
  locale,
  title,
  subtitle,
  source = "discounted",
  limit = 8,
  productIds = [],
}: {
  locale: Locale;
  title?: string;
  subtitle?: string;
  source?: NewArrivalsSource;
  limit?: number;
  productIds?: string[];
}) {
  const safeLimit = Math.min(
    NEW_ARRIVALS_LIMIT_MAX,
    Math.max(NEW_ARRIVALS_LIMIT_MIN, Math.floor(limit) || 8),
  );

  const sourceQuery = buildSourceQuery(source, safeLimit, productIds);
  let products = sourceQuery ? await fetchProducts(sourceQuery) : [];

  // Confirmed fallback: when the chosen logic yields nothing, show latest
  // products so the section is never empty.
  if (products.length === 0 && source !== "latest") {
    products = await fetchProducts(buildLatestQuery(safeLimit));
  }

  if (products.length === 0) return null;

  return (
    <HomeNewArrivalsCarousel
      locale={locale}
      products={products.slice(0, safeLimit)}
      title={title}
      subtitle={subtitle}
    />
  );
}
