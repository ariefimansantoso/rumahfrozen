import {
  HeroSkeleton,
  FeaturedCategoriesSkeleton,
  NewArrivalsSkeleton,
  PromotionsOffersSkeleton,
  TopVendorsSkeleton,
  FeaturedProductsSkeleton,
  TopArticlesSkeleton,
  BecomeVendorSkeleton,
} from "@/components/store/home-section-skeletons";

// Route-level fallback shown while the page shell resolves. It mirrors the
// default section order; each section also has its own <Suspense> boundary on
// the page, so once the shell streams in these placeholders are replaced per
// section as their data arrives. Skeleton dimensions are shared with the real
// sections via home-section-skeletons to keep layout shift minimal.
export default function StoreLoading() {
  return (
    <div className="animate-in fade-in duration-200" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        Loading store...
      </p>

      <HeroSkeleton />
      <FeaturedCategoriesSkeleton />
      <NewArrivalsSkeleton />
      <PromotionsOffersSkeleton />
      <TopVendorsSkeleton />
      <FeaturedProductsSkeleton />
      <TopArticlesSkeleton />
      <BecomeVendorSkeleton />
    </div>
  );
}
