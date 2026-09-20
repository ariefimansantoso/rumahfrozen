import { Suspense } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/config/i18n.config";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Layers } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import {
  ModernProductCardSkeleton,
  type ModernProduct,
} from "@/components/products/modern-product-card";
import { CollectionProductsGrid } from "@/components/products/collection-products-grid";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStorefrontCollectionDetail } from "@/lib/storefront-collections";
import type { CollectionSortOrder } from "@/types";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface CollectionData {
  collection: {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    descriptionHtml?: string;
    image?: { url: string; alt?: string };
    seo?: { pageTitle?: string; metaDescription?: string };
    productCount: number;
  };
  products: Array<{
    _id: string;
    name: string;
    title?: string;
    slug: string;
    price: number;
    comparePrice?: number;
    images: string[];
    rating: number;
    reviewCount: number;
    stock: number;
    featured: boolean;
    vendorId?: { storeName: string; slug: string };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function getCollectionData(
  slug: string,
  page: number = 1,
  sort?: string
): Promise<CollectionData | null> {
  return getStorefrontCollectionDetail({
    slug,
    page,
    limit: 24,
    sort: sort as CollectionSortOrder | undefined,
  }) as Promise<CollectionData | null>;
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, slug } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  const page = typeof search.page === "string" ? parseInt(search.page) : 1;
  const sort = typeof search.sort === "string" ? search.sort : undefined;

  const data = await getCollectionData(slug, page, sort);

  if (!data) {
    notFound();
  }

  const { collection, products, pagination } = data;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${locale}`}>
              {t("common.home")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${locale}/collections`}>
              {t("store.collections", { defaultValue: "Collections" })}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{collection.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Collection Header */}
      <div className="mb-8">
        {collection.image?.url && (
          <div className="relative mb-6 h-40 overflow-hidden rounded-lg bg-muted sm:h-52">
            <AppImage
              src={collection.image.url}
              alt={collection.image.alt || collection.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h1 className="text-4xl font-bold mb-2">{collection.title}</h1>
              {collection.description && (
                <p className="text-lg opacity-90 max-w-2xl">
                  {collection.description}
                </p>
              )}
            </div>
          </div>
        )}

        {!collection.image?.url && (
          <>
            <h1 className="text-3xl font-bold mb-2">{collection.title}</h1>
            {collection.description && (
              <p className="text-muted-foreground max-w-2xl mb-4">
                {collection.description}
              </p>
            )}
          </>
        )}

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {t("storeCollectionDetailPage.productsCount", {
              count: pagination.total,
            })}
          </p>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("storeCollectionDetailPage.sortByLabel")}
            </span>
            <SortSelect
              currentSort={sort}
              slug={slug}
              locale={locale}
              labels={{
                placeholder: t("storeCollectionDetailPage.sortPlaceholder"),
                featured: t("storeCollectionDetailPage.sortOptions.featured"),
                bestSelling: t(
                  "storeCollectionDetailPage.sortOptions.bestSelling",
                ),
                aToZ: t("storeCollectionDetailPage.sortOptions.aToZ"),
                zToA: t("storeCollectionDetailPage.sortOptions.zToA"),
                priceLowHigh: t(
                  "storeCollectionDetailPage.sortOptions.priceLowHigh",
                ),
                priceHighLow: t(
                  "storeCollectionDetailPage.sortOptions.priceHighLow",
                ),
                newest: t("storeCollectionDetailPage.sortOptions.newest"),
              }}
            />
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <Suspense fallback={<ProductsGridSkeleton />}>
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {t("storeCollectionDetailPage.emptyProductsTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("storeCollectionDetailPage.emptyProductsDescription")}
            </p>
          </div>
        ) : (
          <CollectionProductsGrid
            products={products as ModernProduct[]}
            locale={locale as Locale}
          />
        )}
      </Suspense>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-8">
          <CollectionPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            slug={slug}
            sort={sort}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}

function SortSelect({
  currentSort,
  slug,
  locale,
  labels,
}: {
  currentSort?: string;
  slug: string;
  locale: string;
  labels: {
    placeholder: string;
    featured: string;
    bestSelling: string;
    aToZ: string;
    zToA: string;
    priceLowHigh: string;
    priceHighLow: string;
    newest: string;
  };
}) {
  return (
    <Select defaultValue={currentSort || "manual"}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={labels.placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="manual">
          <a href={`/${locale}/collections/${slug}`}>{labels.featured}</a>
        </SelectItem>
        <SelectItem value="best-selling">
          <a href={`/${locale}/collections/${slug}?sort=best-selling`}>
            {labels.bestSelling}
          </a>
        </SelectItem>
        <SelectItem value="title-asc">
          <a href={`/${locale}/collections/${slug}?sort=title-asc`}>
            {labels.aToZ}
          </a>
        </SelectItem>
        <SelectItem value="title-desc">
          <a href={`/${locale}/collections/${slug}?sort=title-desc`}>
            {labels.zToA}
          </a>
        </SelectItem>
        <SelectItem value="price-asc">
          <a href={`/${locale}/collections/${slug}?sort=price-asc`}>
            {labels.priceLowHigh}
          </a>
        </SelectItem>
        <SelectItem value="price-desc">
          <a href={`/${locale}/collections/${slug}?sort=price-desc`}>
            {labels.priceHighLow}
          </a>
        </SelectItem>
        <SelectItem value="created-desc">
          <a href={`/${locale}/collections/${slug}?sort=created-desc`}>
            {labels.newest}
          </a>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

async function CollectionPagination({
  currentPage,
  totalPages,
  slug,
  sort,
  locale,
}: {
  currentPage: number;
  totalPages: number;
  slug: string;
  sort?: string;
  locale: string;
}) {
  const t = await getTranslations({ locale });

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    if (sort) params.set("sort", sort);
    return `?${params.toString()}`;
  };

  return (
    <div className="flex justify-center gap-2">
      {currentPage > 1 && (
        <a
          href={buildUrl(currentPage - 1)}
          className="px-4 py-2 border rounded-md hover:bg-muted"
        >
          {t("storeCollectionDetailPage.pagination.previous")}
        </a>
      )}

      <span className="px-4 py-2">
        {t("storeCollectionDetailPage.pagination.pageOf", {
          current: currentPage,
          total: totalPages,
        })}
      </span>

      {currentPage < totalPages && (
        <a
          href={buildUrl(currentPage + 1)}
          className="px-4 py-2 border rounded-md hover:bg-muted"
        >
          {t("storeCollectionDetailPage.pagination.next")}
        </a>
      )}
    </div>
  );
}

function ProductsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <ModernProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
