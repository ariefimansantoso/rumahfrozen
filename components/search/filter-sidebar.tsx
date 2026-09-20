"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/providers/currency-provider";

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface FilterSidebarProps {
  categories?: Category[];
  className?: string;
  onClose?: () => void;
}

export function FilterSidebar({
  categories = [],
  className,
  onClose,
}: FilterSidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params.locale as string) || "en";
  const { formatPrice } = useCurrency();

  // Get current filter values from URL
  const currentCategory = searchParams.get("category") || "";
  const currentMinPrice = parseFloat(searchParams.get("minPrice") || "0");
  const currentMaxPrice = parseFloat(searchParams.get("maxPrice") || "1000");
  const currentMinRating = parseFloat(searchParams.get("minRating") || "0");
  const currentInStock = searchParams.get("inStock") === "true";

  const [priceRange, setPriceRange] = useState([
    currentMinPrice,
    currentMaxPrice,
  ]);
  const [minRating, setMinRating] = useState(currentMinRating);
  const [inStock, setInStock] = useState(currentInStock);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory);

  // Sync with URL changes
  useEffect(() => {
    setPriceRange([currentMinPrice, currentMaxPrice]);
    setMinRating(currentMinRating);
    setInStock(currentInStock);
    setSelectedCategory(currentCategory);
  }, [
    currentMinPrice,
    currentMaxPrice,
    currentMinRating,
    currentInStock,
    currentCategory,
  ]);

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    // Category
    if (selectedCategory) {
      params.set("category", selectedCategory);
    } else {
      params.delete("category");
    }

    // Price range
    if (priceRange[0] > 0) {
      params.set("minPrice", String(priceRange[0]));
    } else {
      params.delete("minPrice");
    }
    if (priceRange[1] < 1000) {
      params.set("maxPrice", String(priceRange[1]));
    } else {
      params.delete("maxPrice");
    }

    // Rating
    if (minRating > 0) {
      params.set("minRating", String(minRating));
    } else {
      params.delete("minRating");
    }

    // In stock
    if (inStock) {
      params.set("inStock", "true");
    } else {
      params.delete("inStock");
    }

    router.push(`/${locale}/products?${params.toString()}`);
    onClose?.();
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    const search = searchParams.get("search");
    if (search) params.set("search", search);

    router.push(`/${locale}/products?${params.toString()}`);

    setPriceRange([0, 1000]);
    setMinRating(0);
    setInStock(false);
    setSelectedCategory("");
    onClose?.();
  };

  const hasActiveFilters =
    selectedCategory ||
    priceRange[0] > 0 ||
    priceRange[1] < 1000 ||
    minRating > 0 ||
    inStock;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {t("filters.title")}
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Accordion
        type="multiple"
        defaultValue={["category", "price", "rating"]}
        className="w-full"
      >
        {/* Categories */}
        {categories.length > 0 && (
          <AccordionItem value="category">
            <AccordionTrigger>
              {t("filters.category")}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="all-categories"
                    checked={!selectedCategory}
                    onCheckedChange={() => setSelectedCategory("")}
                  />
                  <Label htmlFor="all-categories" className="cursor-pointer">
                    {t("filters.allCategories")}
                  </Label>
                </div>
                {categories.map((cat) => (
                  <div key={cat._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={cat._id}
                      checked={selectedCategory === cat._id}
                      onCheckedChange={(checked) =>
                        setSelectedCategory(checked ? cat._id : "")
                      }
                    />
                    <Label htmlFor={cat._id} className="cursor-pointer">
                      {cat.name}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Price Range */}
        <AccordionItem value="price">
          <AccordionTrigger>
            {t("filters.priceRange")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 px-1">
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                min={0}
                max={1000}
                step={10}
              />
              <div className="flex justify-between text-sm">
                <span>{formatPrice(priceRange[0])}</span>
                <span>{formatPrice(priceRange[1])}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Rating */}
        <AccordionItem value="rating">
          <AccordionTrigger>
            {t("filters.rating")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {[4, 3, 2, 1, 0].map((rating) => (
                <div key={rating} className="flex items-center space-x-2">
                  <Checkbox
                    id={`rating-${rating}`}
                    checked={minRating === rating}
                    onCheckedChange={(checked) =>
                      setMinRating(checked ? rating : 0)
                    }
                  />
                  <Label
                    htmlFor={`rating-${rating}`}
                    className="flex items-center gap-1 cursor-pointer"
                  >
                    {rating === 0 ? (
                      t("filters.anyRating")
                    ) : (
                      <>
                        {rating}
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {t("filters.andUp")}
                      </>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Availability */}
        <AccordionItem value="availability">
          <AccordionTrigger>
            {t("filters.availability")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="in-stock"
                checked={inStock}
                onCheckedChange={(checked) => setInStock(!!checked)}
              />
              <Label htmlFor="in-stock" className="cursor-pointer">
                {t("filters.inStockOnly")}
              </Label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator />

      <div className="flex flex-col gap-2">
        <Button onClick={applyFilters} className="w-full">
          {t("filters.apply")}
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" onClick={clearFilters} className="w-full">
            {t("filters.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
