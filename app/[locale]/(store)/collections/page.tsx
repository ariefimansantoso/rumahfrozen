import Link from "next/link";
import { Suspense } from "react";
import { Layers } from "lucide-react";
import { type Locale } from "@/config/i18n.config";
import { Skeleton } from "@/components/ui/skeleton";
import { AppImage } from "@/components/ui/app-image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { ModernProduct } from "@/components/products/modern-product-card";
import { CollectionProductsGrid } from "@/components/products/collection-products-grid";
import { getStorefrontCollections } from "@/lib/storefront-collections";
import { getStorefrontProducts } from "@/lib/products/storefront-products";

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface Collection {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  image?: { url: string; alt?: string };
  productCount: number;
}

async function getCollections(): Promise<Collection[]> {
  const result = await getStorefrontCollections({ limit: 50 });
  return Array.isArray(result.data) ? (result.data as Collection[]) : [];
}

async function getProducts(): Promise<ModernProduct[]> {
  const result = await getStorefrontProducts<ModernProduct>({
    limit: 24,
    cardFieldsOnly: true,
  });
  return Array.isArray(result.data) ? result.data : [];
}

export default async function CollectionsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {t("store.collections", { defaultValue: "Collections" })}
          {", "}
          <span className="text-muted-foreground font-medium">
            {t("storeCollectionsPage.headerSubtitle")}
          </span>
        </h1>
      </div>

      {/* Collections Grid */}
      <Suspense fallback={<CollectionsGridSkeleton />}>
        <CollectionsGrid locale={locale as Locale} />
      </Suspense>

      {/* All Products */}
      <Suspense fallback={<ProductsGridSkeleton />}>
        <AllProducts locale={locale as Locale} />
      </Suspense>
    </div>
  );
}

async function CollectionsGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale });
  const collections = await getCollections();

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-sm bg-muted">
          <Layers className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-5 text-lg font-semibold">
          {t("storeCollectionsPage.emptyCollectionsTitle")}
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {t("storeCollectionsPage.emptyCollectionsDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-6">
      {collections.map((collection) => (
        <Link
          key={collection._id}
          href={`/${locale}/collections/${collection.slug}`}
          className="group"
        >
          <div className="overflow-hidden rounded-sm border bg-background transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            {/* Cover image */}
            <div className="relative aspect-2/1 w-full overflow-hidden bg-muted">
              {collection.image?.url ? (
                <AppImage
                  src={collection.image.url}
                  alt={collection.image.alt || collection.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Layers className="h-12 w-12 text-muted-foreground/50 sm:h-16 sm:w-16" />
                </div>
              )}

              {/* Product count badge */}
              <span className="absolute right-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm sm:text-xs">
                {t("storeCollectionsPage.productCount", {
                  count: collection.productCount,
                })}
              </span>
            </div>

            {/* Collection name */}
            <div className="px-4 py-3 sm:py-4">
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">
                {collection.title}
              </h2>
              {collection.description && (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {collection.description}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function AllProducts({ locale }: { locale: Locale }) {
  const products = await getProducts();

  if (products.length === 0) return null;

  return (
    <div className="mt-12">
      <CollectionProductsGrid products={products} locale={locale} />
    </div>
  );
}

function CollectionsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-sm border bg-background"
        >
          <Skeleton className="aspect-2/1 w-full" />
          <div className="px-4 py-3 sm:py-4">
            <Skeleton className="h-4 w-3/4 sm:h-5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductsGridSkeleton() {
  return (
    <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-square rounded-sm" />
          <div className="space-y-1.5 px-0.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
