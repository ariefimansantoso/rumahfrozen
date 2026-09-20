"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  ProductFilters,
  type ProductFiltersProps,
} from "@/components/products/product-filters";

const PRICE_MAX = 1000;

function countActiveFilters({
  currentCategory,
  currentCollection,
  currentMinPrice,
  currentMaxPrice,
}: ProductFiltersProps): number {
  let count = 0;
  if (currentCategory) count += currentCategory.split(",").length;
  if (currentCollection) count += currentCollection.split(",").length;

  const min = currentMinPrice ? parseInt(currentMinPrice) : 0;
  const max = currentMaxPrice ? parseInt(currentMaxPrice) : PRICE_MAX;
  if (min > 0 || max < PRICE_MAX) count += 1;

  return count;
}

/**
 * Mobile-only filter entry point. Renders a "Filters" button that opens a
 * slide-in Sheet wrapping the shared <ProductFilters> panel, so products stay
 * at the top of the page on small screens. Hidden on lg+ where the desktop
 * sidebar is shown instead.
 */
export function ProductFiltersMobile(props: ProductFiltersProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(props);

  return (
    <div className="mb-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full justify-center"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("common.filters")}
          {activeCount > 0 ? (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          ) : null}
        </Button>

        <SheetContent
          side="left"
          className="w-[88%] gap-0 p-0 sm:max-w-sm"
        >
          <SheetHeader className="border-b">
            <SheetTitle>
              {t("common.filters")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <ProductFilters {...props} />
          </div>

          <SheetFooter className="border-t">
            <SheetClose asChild>
              <Button className="w-full">
                {t("productsPage.filters.showResults")}
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
