import { Suspense, type ReactNode } from "react";
import { type Locale } from "@/config/i18n.config";
import { setRequestLocale } from "next-intl/server";
import { HomeTopVendors } from "@/components/store/home-top-vendors";
import { HomeNewArrivals } from "@/components/store/home-new-arrivals";
import { HomeFromInstagram } from "@/components/store/home-from-instagram";
import { HeroSlider, type HeroSlide } from "@/components/store/hero-slider";
import { HomeTopArticles } from "@/components/store/blog/home-top-articles";
import { HomeProductsSection } from "@/components/store/home-products-section";
import { HomePromotionsOffers } from "@/components/store/home-promotions-offers";
import { HomeFeaturedCategories } from "@/components/store/home-featured-categories";
import { HomeBecomeVendorSection } from "@/components/store/home-become-vendor-section";
import {
  getDefaultHomePageSettings,
  type HomeSectionId,
  type HomePageSettings,
} from "@/lib/home-page-config";
import { getStorefrontSettings } from "@/lib/storefront-settings";
import {
  FeaturedCategoriesSkeleton,
  NewArrivalsSkeleton,
  TopVendorsSkeleton,
  FeaturedProductsSkeleton,
  TopArticlesSkeleton,
} from "@/components/store/home-section-skeletons";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  let homePageConfig = getDefaultHomePageSettings();
  let isMultiVendorEnabled = false;

  try {
    const settings = await getStorefrontSettings();
    homePageConfig = settings.homePage;
    isMultiVendorEnabled = settings.isMultiVendorEnabled;
  } catch {
    homePageConfig = getDefaultHomePageSettings();
    isMultiVendorEnabled = false;
  }

  return (
    <HomePageContent
      locale={locale as Locale}
      homePageConfig={homePageConfig}
      isMultiVendorEnabled={isMultiVendorEnabled}
    />
  );
}

function HomePageContent({
  locale,
  homePageConfig,
  isMultiVendorEnabled,
}: {
  locale: Locale;
  homePageConfig: HomePageSettings;
  isMultiVendorEnabled: boolean;
}) {
  const heroSlides: HeroSlide[] = homePageConfig.sections.hero.slides.map(
    (slide) => ({
      imageSrc: slide.imageSrc,
      alt: slide.alt,
      href: slide.href || undefined,
    }),
  );

  const heroSection = (
    <section className="py-4 lg:py-6" key="hero">
      <div className="container mx-auto px-4">
        <HeroSlider slides={heroSlides} />
      </div>
    </section>
  );

  const sectionNodes: Record<HomeSectionId, ReactNode> = {
    hero: heroSection,
    featuredCategories: (
      <HomeFeaturedCategories
        key="featured-categories"
        locale={locale}
        title={homePageConfig.sections.featuredCategories.title}
        source={homePageConfig.sections.featuredCategories.source}
        limit={homePageConfig.sections.featuredCategories.limit}
        categoryIds={homePageConfig.sections.featuredCategories.categoryIds}
      />
    ),
    newArrivals: (
      <HomeNewArrivals
        key="new-arrivals"
        locale={locale}
        title={homePageConfig.sections.newArrivals.title}
        subtitle={homePageConfig.sections.newArrivals.subtitle}
        source={homePageConfig.sections.newArrivals.source}
        limit={homePageConfig.sections.newArrivals.limit}
        productIds={homePageConfig.sections.newArrivals.productIds}
      />
    ),
    promotionsOffers: (
      <HomePromotionsOffers
        key="promotions-offers"
        locale={locale}
        cards={homePageConfig.sections.promotionsOffers.cards}
      />
    ),
    topVendors: isMultiVendorEnabled ? (
      <HomeTopVendors
        key="top-vendors"
        locale={locale}
        title={homePageConfig.sections.topVendors.title}
        limit={homePageConfig.sections.topVendors.limit}
      />
    ) : null,
    featuredProducts: (
      <HomeProductsSection
        key="featured-products"
        locale={locale}
        title={homePageConfig.sections.featuredProducts.title || undefined}
        source={homePageConfig.sections.featuredProducts.source}
        limit={homePageConfig.sections.featuredProducts.limit}
        productIds={homePageConfig.sections.featuredProducts.productIds}
      />
    ),
    topArticles: (
      <HomeTopArticles
        key="top-articles"
        locale={locale}
        title={homePageConfig.sections.topArticles.title}
        limit={homePageConfig.sections.topArticles.limit}
      />
    ),
    becomeVendor: isMultiVendorEnabled ? (
      <HomeBecomeVendorSection
        key="become-vendor"
        locale={locale}
        title={homePageConfig.sections.becomeVendor.title}
        subtitle={homePageConfig.sections.becomeVendor.subtitle}
        buttonLabel={homePageConfig.sections.becomeVendor.buttonLabel}
        buttonHref={homePageConfig.sections.becomeVendor.buttonHref}
        imageSrc={homePageConfig.sections.becomeVendor.imageSrc}
      />
    ) : null,
    fromInstagram: (
      <HomeFromInstagram
        key="from-instagram"
        locale={locale}
        title={homePageConfig.sections.fromInstagram.title}
        items={homePageConfig.sections.fromInstagram.items}
      />
    ),
  };

  // Data-fetching sections get their own <Suspense> boundary so the shell and
  // hero can stream immediately and each section pops in independently instead
  // of the whole page blocking on the slowest query (e.g. on a cold cache or
  // right after an on-demand revalidation). Synchronous sections render inline.
  const sectionFallbacks: Partial<Record<HomeSectionId, ReactNode>> = {
    featuredCategories: <FeaturedCategoriesSkeleton />,
    newArrivals: <NewArrivalsSkeleton />,
    topVendors: <TopVendorsSkeleton />,
    featuredProducts: <FeaturedProductsSkeleton />,
    topArticles: <TopArticlesSkeleton />,
  };

  return (
    <div>
      {homePageConfig.sectionOrder.map((sectionId) => {
        if (!homePageConfig.sections[sectionId].visible) return null;

        const node = sectionNodes[sectionId];
        if (!node) return null;

        const fallback = sectionFallbacks[sectionId];
        if (!fallback) return node;

        return (
          <Suspense key={sectionId} fallback={fallback}>
            {node}
          </Suspense>
        );
      })}
    </div>
  );
}
