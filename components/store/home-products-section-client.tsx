"use client";

import dynamic from "next/dynamic";
import {
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Palette,
  Ruler,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ModernProductCard,
  type ModernProduct,
} from "@/components/products/modern-product-card";
import { type Locale } from "@/config/i18n.config";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getProductPriceRange,
  productMatchesPriceFilter,
} from "@/lib/products/price-display";

// Loaded only when a shopper opens quick view, keeping the modal and its deps
// out of the initial section bundle.
const ProductQuickViewModal = dynamic(
  () =>
    import("@/components/products/product-quick-view-modal").then(
      (mod) => mod.ProductQuickViewModal,
    ),
  { ssr: false },
);

type ProductCategory =
  | string
  | {
      _id?: string;
      name?: string;
      slug?: string;
    };

type ProductOptionValue = {
  _id: string;
  value: string;
  colorCode?: string;
};

type ProductOption = {
  name: string;
  values?: ProductOptionValue[];
};

type HomeProduct = ModernProduct & {
  category?: ProductCategory;
  options?: ProductOption[];
};

type SortValue = "newest" | "popular" | "rating" | "price_asc" | "price_desc";

interface HomeProductsSectionClientProps {
  products: HomeProduct[];
  locale: Locale;
  title?: string;
}

const sortOptions: Array<{ label: string; value: SortValue }> = [
  { label: "Newest", value: "newest" },
  { label: "Most Popular", value: "popular" },
  { label: "Best Rating", value: "rating" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

function getCategoryName(product: HomeProduct): string {
  if (!product.category) return "Other";
  if (typeof product.category === "string") return "Other";
  return product.category.name || "Other";
}

function getOptionValuesByName(product: HomeProduct, type: "color" | "size") {
  const options = Array.isArray(product.options) ? product.options : [];
  const keywords =
    type === "color"
      ? ["color", "colour", "colors", "colours"]
      : ["size", "sizes", "sizing"];

  return options
    .filter((option) =>
      keywords.some((keyword) =>
        String(option.name || "")
          .toLowerCase()
          .includes(keyword),
      ),
    )
    .flatMap((option) => option.values || [])
    .map((value) => value.value)
    .filter(Boolean);
}

export function HomeProductsSectionClient({
  products,
  locale,
  title,
}: HomeProductsSectionClientProps) {
  const t = useTranslations();

  const allCategories = useMemo(() => {
    const countMap = new Map<string, number>();

    for (const product of products) {
      const name = getCategoryName(product);
      countMap.set(name, (countMap.get(name) || 0) + 1);
    }

    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [products]);

  const allColors = useMemo(() => {
    const colors = new Set<string>();
    for (const product of products) {
      for (const color of getOptionValuesByName(product, "color")) {
        colors.add(color);
      }
    }
    return Array.from(colors).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const allSizes = useMemo(() => {
    const sizes = new Set<string>();
    for (const product of products) {
      for (const size of getOptionValuesByName(product, "size")) {
        sizes.add(size);
      }
    }
    return Array.from(sizes).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const [minPriceBound, maxPriceBound] = useMemo(() => {
    const prices = products.flatMap((product) => {
      const range = getProductPriceRange(product);
      return [range.min, range.max];
    });

    if (!prices.length) return [0, 1000] as const;

    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return [min, Math.max(min + 1, max)] as const;
  }, [products]);

  const tabItems = useMemo(
    () => ["All Items", ...allCategories.slice(0, 4)],
    [allCategories],
  );

  const [activeTab, setActiveTab] = useState(tabItems[0] || "All Items");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<ModernProduct | null>(
    null,
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortValue>("newest");
  const [priceRange, setPriceRange] = useState<[number, number]>(() => [
    minPriceBound,
    maxPriceBound,
  ]);

  const toggleFilterValue = (
    current: string[],
    nextValue: string,
    setter: (next: string[]) => void,
  ) => {
    if (current.includes(nextValue)) {
      setter(current.filter((value) => value !== nextValue));
      return;
    }
    setter([...current, nextValue]);
  };

  const hasPriceFilter =
    priceRange[0] > minPriceBound || priceRange[1] < maxPriceBound;
  const currentSortLabel =
    sortOptions.find((option) => option.value === sortBy)?.label || "Newest";
  const hasAnyFilterApplied =
    selectedCategories.length > 0 ||
    selectedColors.length > 0 ||
    selectedSizes.length > 0 ||
    hasPriceFilter;

  const filteredProducts = useMemo(() => {
    const inTab =
      activeTab === "All Items"
        ? products
        : products.filter((product) => getCategoryName(product) === activeTab);

    const withFilters = inTab.filter((product) => {
      const categoryName = getCategoryName(product);
      const colors = getOptionValuesByName(product, "color");
      const sizes = getOptionValuesByName(product, "size");

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(categoryName);
      const matchesColor =
        selectedColors.length === 0 ||
        selectedColors.some((selected) => colors.includes(selected));
      const matchesSize =
        selectedSizes.length === 0 ||
        selectedSizes.some((selected) => sizes.includes(selected));
      const matchesPrice =
        productMatchesPriceFilter(product, priceRange[0], priceRange[1]);

      return matchesCategory && matchesColor && matchesSize && matchesPrice;
    });

    const sorted = [...withFilters];

    sorted.sort((a, b) => {
      if (sortBy === "price_asc") {
        return getProductPriceRange(a).min - getProductPriceRange(b).min;
      }
      if (sortBy === "price_desc") {
        return getProductPriceRange(b).max - getProductPriceRange(a).max;
      }
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "popular")
        return (b.reviewCount || 0) - (a.reviewCount || 0);

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return sorted;
  }, [
    activeTab,
    priceRange,
    products,
    selectedCategories,
    selectedColors,
    selectedSizes,
    sortBy,
  ]);

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setPriceRange([minPriceBound, maxPriceBound]);
    setSortBy("newest");
  };

  return (
    <section className="py-6 lg:py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
          {title ||
            (t.has("home.findFavoriteProducts")
              ? t("home.findFavoriteProducts")
              : "Find your favorite products.")}
        </h2>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:mt-8 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {tabItems.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:px-5 sm:py-2 sm:text-sm",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className="h-9 rounded-full bg-foreground px-4 text-xs font-semibold text-background hover:bg-foreground/90 sm:h-10 sm:px-5 sm:text-sm"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
            {t.has("common.filter") ? t("common.filter") : "Filter"}
            {isFilterOpen ? (
              <ChevronUp className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </Button>
        </div>

        {isFilterOpen && (
          <div className="mt-4">
            <Separator />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                        selectedCategories.length > 0
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Tags className="h-4 w-4" />
                      Categories
                      <ChevronDown className="h-4 w-4" />
                      {selectedCategories.length > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-xs font-semibold text-background">
                          {selectedCategories.length}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 rounded-md p-4">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Categories</p>
                      {allCategories.slice(0, 8).map((category) => {
                        const checked = selectedCategories.includes(category);
                        return (
                          <Label
                            key={category}
                            className="flex items-center gap-3 text-sm font-normal"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggleFilterValue(
                                  selectedCategories,
                                  category,
                                  setSelectedCategories,
                                )
                              }
                            />
                            {category}
                          </Label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                        selectedColors.length > 0
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Palette className="h-4 w-4" />
                      Colors
                      <ChevronDown className="h-4 w-4" />
                      {selectedColors.length > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-xs font-semibold text-background">
                          {selectedColors.length}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 rounded-md p-4">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Colors</p>
                      {allColors.slice(0, 10).map((color) => {
                        const checked = selectedColors.includes(color);
                        return (
                          <Label
                            key={color}
                            className="flex items-center gap-3 text-sm font-normal"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggleFilterValue(
                                  selectedColors,
                                  color,
                                  setSelectedColors,
                                )
                              }
                            />
                            {color}
                          </Label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                        selectedSizes.length > 0
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Ruler className="h-4 w-4" />
                      Sizes
                      <ChevronDown className="h-4 w-4" />
                      {selectedSizes.length > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-xs font-semibold text-background">
                          {selectedSizes.length}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 rounded-md p-4">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Sizes</p>
                      {allSizes.slice(0, 10).map((size) => {
                        const checked = selectedSizes.includes(size);
                        return (
                          <Label
                            key={size}
                            className="flex items-center gap-3 text-sm font-normal"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggleFilterValue(
                                  selectedSizes,
                                  size,
                                  setSelectedSizes,
                                )
                              }
                            />
                            {size}
                          </Label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                        hasPriceFilter
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <DollarSign className="h-4 w-4" />
                      Price
                      <ChevronDown className="h-4 w-4" />
                      {hasPriceFilter && (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-xs font-semibold text-background">
                          1
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 rounded-md p-4">
                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Price</p>
                      <Slider
                        min={minPriceBound}
                        max={maxPriceBound}
                        step={1}
                        value={priceRange}
                        onValueChange={(value) => {
                          if (value.length === 2) {
                            setPriceRange([value[0], value[1]]);
                          }
                        }}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 text-xs text-muted-foreground">
                          Min
                          <input
                            type="number"
                            min={minPriceBound}
                            max={priceRange[1]}
                            value={priceRange[0]}
                            onChange={(event) => {
                              const next = Number(
                                event.target.value || minPriceBound,
                              );
                              setPriceRange([
                                Math.max(
                                  minPriceBound,
                                  Math.min(next, priceRange[1]),
                                ),
                                priceRange[1],
                              ]);
                            }}
                            className="h-8 w-full rounded-md border border-input bg-background px-3 text-base text-foreground"
                          />
                        </label>
                        <label className="space-y-1 text-xs text-muted-foreground">
                          Max
                          <input
                            type="number"
                            min={priceRange[0]}
                            max={maxPriceBound}
                            value={priceRange[1]}
                            onChange={(event) => {
                              const next = Number(
                                event.target.value || maxPriceBound,
                              );
                              setPriceRange([
                                priceRange[0],
                                Math.min(
                                  maxPriceBound,
                                  Math.max(next, priceRange[0]),
                                ),
                              ]);
                            }}
                            className="h-8 w-full rounded-md border border-input bg-background px-3 text-base text-foreground"
                          />
                        </label>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2">
                {hasAnyFilterApplied && (
                  <button
                    type="button"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={clearAllFilters}
                  >
                    Clear
                  </button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {currentSortLabel}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 rounded-md p-2">
                    <div className="space-y-1">
                      {sortOptions.map((option) => {
                        const isSelected = option.value === sortBy;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSortBy(option.value)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                              isSelected
                                ? "bg-muted font-semibold text-foreground"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            )}
                          >
                            {option.label}
                            {isSelected && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-8 sm:gap-x-5 sm:gap-y-11 md:mt-8 md:grid-cols-3 md:gap-y-11 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ModernProductCard
              key={product._id}
              product={product}
              locale={locale}
              showQuickView
              onQuickView={setQuickViewProduct}
            />
          ))}
        </div>

        {quickViewProduct && (
          <ProductQuickViewModal
            product={quickViewProduct}
            locale={locale}
            open
            onClose={() => setQuickViewProduct(null)}
          />
        )}
      </div>
    </section>
  );
}
