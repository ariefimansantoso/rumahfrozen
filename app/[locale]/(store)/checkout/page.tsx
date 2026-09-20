import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutContent } from "@/components/checkout/checkout-content";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto lg:grid lg:grid-cols-2">
        <div className="px-4 py-8 lg:px-10 lg:py-12 lg:pr-16">
          <div className="max-w-120 mx-auto lg:mx-0 lg:ml-auto space-y-6">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <div className="border-t bg-zinc-50 px-4 py-8 lg:border-l lg:border-t-0 lg:px-12 lg:py-12">
          <div className="max-w-110 mx-auto lg:mx-0">
            <Skeleton className="h-105 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
