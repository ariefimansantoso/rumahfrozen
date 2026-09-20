"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { type Locale } from "@/config/i18n.config";
import { useState, useCallback, useMemo } from "react";

export interface FilterItem {
  name: string;
  slug: string;
}

export interface ProductFiltersProps {
  locale: Locale;
  categories: FilterItem[];
  collections: FilterItem[];
  currentCategory?: string;
  currentCollection?: string;
  currentMinPrice?: string;
  currentMaxPrice?: string;
  currentSort?: string;
}

const PRICE_MAX = 1000;
const CATEGORY_VISIBLE_LIMIT = 10;

export function ProductFilters({
  locale,
  categories,
  collections,
  currentCategory,
  currentCollection,
  currentMinPrice,
  currentMaxPrice,
  currentSort = "popular",
}: ProductFiltersProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse comma-separated values from URL
  const selectedCategories = useMemo(
    () => (currentCategory ? currentCategory.split(",") : []),
    [currentCategory]
  );
  const selectedCollections = useMemo(
    () => (currentCollection ? currentCollection.split(",") : []),
    [currentCollection]
  );

  const [priceRange, setPriceRange] = useState<[number, number]>([
    currentMinPrice ? parseInt(currentMinPrice) : 0,
    currentMaxPrice ? parseInt(currentMaxPrice) : PRICE_MAX,
  ]);

  const visibleCategories = useMemo(
    () => categories.slice(0, CATEGORY_VISIBLE_LIMIT),
    [categories]
  );
  const hasMoreCategories = categories.length > CATEGORY_VISIBLE_LIMIT;

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      // Reset to page 1 when filters change
      params.delete("page");

      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // Toggle checkbox in a comma-separated list
  const toggleFilter = useCallback(
    (key: string, value: string, currentValues: string[]) => {
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];

      updateFilters({
        [key]: newValues.length > 0 ? newValues.join(",") : undefined,
      });
    },
    [updateFilters]
  );

  const handleSortChange = (value: string) => {
    updateFilters({ sortBy: value });
  };

  const handlePriceChange = (values: number[]) => {
    setPriceRange([values[0], values[1]]);
  };

  const handlePriceCommit = (values: number[]) => {
    setPriceRange([values[0], values[1]]);
    updateFilters({
      minPrice: values[0] > 0 ? values[0].toString() : undefined,
      maxPrice: values[1] < PRICE_MAX ? values[1].toString() : undefined,
    });
  };

  const handleMinPriceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    const clamped = Math.max(0, Math.min(val, priceRange[1]));
    setPriceRange([clamped, priceRange[1]]);
    updateFilters({
      minPrice: clamped > 0 ? clamped.toString() : undefined,
      maxPrice:
        priceRange[1] < PRICE_MAX ? priceRange[1].toString() : undefined,
    });
  };

  const handleMaxPriceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || PRICE_MAX;
    const clamped = Math.min(PRICE_MAX, Math.max(val, priceRange[0]));
    setPriceRange([priceRange[0], clamped]);
    updateFilters({
      minPrice: priceRange[0] > 0 ? priceRange[0].toString() : undefined,
      maxPrice: clamped < PRICE_MAX ? clamped.toString() : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Price */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold tracking-wide">
          {t("common.price")}
        </h3>

        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            {t("common.price")}
          </p>

          <Slider
            min={0}
            max={PRICE_MAX}
            step={10}
            value={priceRange}
            onValueChange={handlePriceChange}
            onValueCommit={handlePriceCommit}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("productsPage.filters.minPrice")}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  max={priceRange[1]}
                  value={priceRange[0]}
                  onChange={handleMinPriceInput}
                  className="pl-7 h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("productsPage.filters.maxPrice")}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  min={priceRange[0]}
                  max={PRICE_MAX}
                  value={priceRange[1]}
                  onChange={handleMaxPriceInput}
                  className="pl-7 h-9"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Categories */}
      {categories.length > 0 && (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-bold tracking-wide">
              {t("common.categories")}
            </h3>
            <div className="space-y-2.5">
              {visibleCategories.map((cat) => (
                <label
                  key={cat.slug}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat.slug)}
                    onCheckedChange={() =>
                      toggleFilter("category", cat.slug, selectedCategories)
                    }
                  />
                  <span className="text-sm">{cat.name}</span>
                </label>
              ))}
              {hasMoreCategories ? (
                <Link
                  href={`/${locale}/categories`}
                  className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  {t("common.viewAll")}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* Collections */}
      {collections.length > 0 && (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-bold tracking-wide">
              {t("nav.collections")}
            </h3>
            <div className="space-y-2.5">
              {collections.map((col) => (
                <label
                  key={col.slug}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCollections.includes(col.slug)}
                    onCheckedChange={() =>
                      toggleFilter("collection", col.slug, selectedCollections)
                    }
                  />
                  <span className="text-sm">{col.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* Sort By */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold tracking-wide">
          {t("product.sortBy")}
        </h3>
        <RadioGroup value={currentSort} onValueChange={handleSortChange}>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RadioGroupItem value="popular" />
            <span className="text-sm">
              {t("productsPage.filters.sortOptions.mostPopular")}
            </span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RadioGroupItem value="rating" />
            <span className="text-sm">
              {t("productsPage.filters.sortOptions.bestRating")}
            </span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RadioGroupItem value="createdAt" />
            <span className="text-sm">
              {t("productsPage.filters.sortOptions.newest")}
            </span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RadioGroupItem value="price-asc" />
            <span className="text-sm">
              {t("productsPage.filters.sortOptions.priceLowHigh")}
            </span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RadioGroupItem value="price-desc" />
            <span className="text-sm">
              {t("productsPage.filters.sortOptions.priceHighLow")}
            </span>
          </label>
        </RadioGroup>
      </div>
    </div>
  );
}
