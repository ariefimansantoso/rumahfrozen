import { unstable_cache } from "next/cache";
import { appConfig } from "@/config/app.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { normalizeContentPagesSettings } from "@/lib/content-pages-config";
import { connectDB } from "@/lib/db";
import { normalizeFooterSettings } from "@/lib/footer-config";
import { normalizeHeaderSettings } from "@/lib/header-config";
import { normalizeHomePageSettings } from "@/lib/home-page-config";
import { resolveAnalyticsConfig } from "@/lib/credentials";
import { getSettings } from "@/models/settings.model";

export const getStorefrontSettings = unstable_cache(
  async () => {
    await connectDB();
    const settings = await getSettings();
    const analytics = settings.analytics;
    const resolvedAnalytics = resolveAnalyticsConfig(analytics);
    const general = settings.general;
    const social = settings.social;

    return {
      analytics: {
        googleAnalyticsId: resolvedAnalytics.googleAnalyticsId,
        googleTagManagerId: resolvedAnalytics.googleTagManagerId,
        facebookPixelId: resolvedAnalytics.facebookPixelId,
        tiktokPixelId: resolvedAnalytics.tiktokPixelId,
        plausibleBaseUrl: analytics?.plausibleBaseUrl || undefined,
        plausibleDomain: analytics?.plausibleDomain || undefined,
        plausibleSelfHosted: Boolean(analytics?.plausibleSelfHosted),
      },
      contentPages: normalizeContentPagesSettings(settings.contentPages),
      footerSettings: normalizeFooterSettings(settings.footer),
      headerSettings: normalizeHeaderSettings(settings.header),
      homePage: normalizeHomePageSettings(settings.homePage),
      isMultiVendorEnabled: Boolean(settings.multiVendorMode?.enabled),
      storeName: general?.storeName?.trim() || appConfig.name,
      storeEmail: general?.storeEmail?.trim() || "",
      storePhone: general?.storePhone?.trim() || "",
      storeAddress: general?.storeAddress?.trim() || "",
      social: {
        facebookUrl: social?.facebookUrl,
        twitterUrl: social?.twitterUrl,
        instagramUrl: social?.instagramUrl,
        youtubeUrl: social?.youtubeUrl,
        linkedinUrl: social?.linkedinUrl,
      },
    };
  },
  ["storefront-settings"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.settings],
  },
);
