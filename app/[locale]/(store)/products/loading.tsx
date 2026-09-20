import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ProductSkeleton } from "@/components/products/product-skeleton";

// Route-level fallback shown instantly on navigation while the server resolves
// filters + the product query. Mirrors the page layout (header, filter
// sidebar, product grid) so content swaps in with minimal layout shift.
export default function ProductsLoading() {
  return (
    <div className="container mx-auto px-4 py-8" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        Loading products...
      </p>

      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <Separator className="mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
        <aside className="hidden lg:block space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </aside>

        <ProductSkeleton count={9} />
      </div>
    </div>
  );
}
