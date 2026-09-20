import { Separator } from "@/components/ui/separator";
import { type Locale } from "@/config/i18n.config";
import { setRequestLocale } from "next-intl/server";
import { CategoriesPageClient } from "@/components/store/categories-page-client";
import { getStorefrontCategories } from "@/lib/storefront-categories";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const PAGE_SIZE = 20;

export default async function CategoriesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { categories, pagination } = await getStorefrontCategories({
    flat: true,
    page: 1,
    limit: PAGE_SIZE,
  });

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Browse every product category in one place.
        </p>
      </div>

      <Separator className="mb-8" />

      <CategoriesPageClient
        locale={locale as Locale}
        initialCategories={categories}
        initialPagination={pagination}
      />
    </div>
  );
}
