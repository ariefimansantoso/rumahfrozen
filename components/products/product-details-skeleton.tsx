import { Skeleton } from "@/components/ui/skeleton";

// Skeletons for the product detail route. Dimensions mirror the real
// components (product-details.tsx, product-image-gallery.tsx, reviews-list.tsx,
// modern-product-card.tsx) so the route-level loading.tsx swaps to real content
// with minimal layout shift.

export function ProductDetailsSkeleton() {
  return (
    <div className="space-y-14" aria-hidden="true">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Gallery — sticky on lg, matches ProductImageGallery */}
        <div className="lg:sticky lg:top-43 lg:self-start">
          <div className="space-y-3">
            <Skeleton className="h-[45vh] w-full rounded-2xl md:h-[50vh] lg:h-[calc(100vh-18rem)]" />
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-14 shrink-0 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Buy box */}
        <div>
          <div className="space-y-8">
            <div className="space-y-4">
              {/* brand */}
              <Skeleton className="h-4 w-24" />
              {/* title */}
              <Skeleton className="h-8 w-3/4 lg:h-9" />
              {/* rating row */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-4 rounded-sm" />
                ))}
                <Skeleton className="ml-1 h-4 w-24" />
              </div>
              {/* price + stock badge */}
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-7 w-24 rounded-md" />
              </div>
              {/* short description */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-4/5 max-w-2xl" />
              </div>
            </div>

            {/* options: color swatches + size pills */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <div className="flex flex-wrap gap-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded-full" />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-14 rounded-sm" />
                  ))}
                </div>
              </div>
            </div>

            {/* quantity stepper + actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-12 w-40 rounded-[10px]" />
              <div className="flex min-w-65 flex-1 items-center gap-3">
                <Skeleton className="h-12 flex-1 rounded-sm" />
                <Skeleton className="h-12 flex-1 rounded-sm" />
              </div>
            </div>

            {/* share row */}
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-9 rounded-full" />
              ))}
            </div>

            <div className="h-px w-full bg-border/80" />

            {/* collapsible sections */}
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border/60 py-4"
                >
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-5 rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + description */}
      <section className="py-8">
        <div className="mb-8 flex items-center gap-2 border-b border-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-sm" />
          ))}
        </div>
        <div className="max-w-4xl space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>
    </div>
  );
}

// Approximates ReviewsListSkeleton in reviews-list.tsx for the route fallback.
export function ReviewsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Skeleton className="h-52 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Matches the 4-up related-products grid (modern-product-card layout).
export function RelatedProductsSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-card">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-18 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
