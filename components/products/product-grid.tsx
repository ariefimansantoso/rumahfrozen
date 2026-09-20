import {
  ModernProductCardSkeleton,
  type ModernProduct,
} from "./modern-product-card";
import { ProductGridClient } from "./product-grid-client";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { type Locale } from "@/config/i18n.config";
import { getStorefrontProducts } from "@/lib/products/storefront-products";
import { getTranslations } from "next-intl/server";

interface ProductGridProps {
  locale: Locale;
  category?: string;
  collection?: string;
  brand?: string;
  vendor?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  preorder?: boolean;
  emptyMessage?: string;
}

async function fetchProducts(props: ProductGridProps) {
  try {
    return await getStorefrontProducts<ModernProduct>({
      category: props.category,
      collection: props.collection,
      brand: props.brand,
      vendor: props.vendor,
      search: props.search,
      minPrice: props.minPrice,
      maxPrice: props.maxPrice,
      sortBy: props.sortBy,
      sortOrder: props.sortOrder,
      page: props.page,
      preorder: props.preorder,
      cardFieldsOnly: true,
    });
  } catch {
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

export async function ProductGrid(props: ProductGridProps) {
  const t = await getTranslations({ locale: props.locale });
  const result = await fetchProducts(props);

  const products = Array.isArray(result.data) ? result.data : [];
  const pagination = result.pagination || {
    page: 1,
    totalPages: 1,
    total: 0,
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {props.emptyMessage ||
            t("productsPage.empty")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Grid with Quick View Modal */}
      <ProductGridClient products={products} locale={props.locale} />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            {pagination.page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={`?page=${pagination.page - 1}`} />
              </PaginationItem>
            )}

            {Array.from(
              { length: Math.min(5, pagination.totalPages) },
              (_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href={`?page=${pageNum}`}
                      isActive={pageNum === pagination.page}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              },
            )}

            {pagination.page < pagination.totalPages && (
              <PaginationItem>
                <PaginationNext href={`?page=${pagination.page + 1}`} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

export function ProductSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ModernProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
