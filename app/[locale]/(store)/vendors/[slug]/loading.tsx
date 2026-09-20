import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ProductSkeleton } from "@/components/products/product-skeleton";

// Route-level fallback shown instantly on navigation while the server resolves
// the vendor + product query. Mirrors the page layout (store banner card,
// filter sidebar, product grid) so content swaps in with minimal layout shift.
export default function VendorStorefrontLoading() {
  return (
    <div className="container mx-auto px-4 py-8" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        Loading store...
      </p>

      <section className="mb-8 overflow-hidden rounded-2xl border bg-card">
        <Skeleton className="h-40 w-full rounded-none sm:h-52" />
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        </div>
      </section>

      <Separator className="mb-8" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr]">
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
