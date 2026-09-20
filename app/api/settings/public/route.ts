import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import {
  resolveAnalyticsConfig,
  resolveOAuthCredentials,
  resolvePayPalCredentials,
  resolvePaystackCredentials,
  resolveRazorpayCredentials,
  resolveStripeCredentials,
} from "@/lib/credentials";
import {
  getDefaultHomePageSettings,
  normalizeHomePageSettings,
} from "@/lib/home-page-config";
import { normalizeHeaderSettings } from "@/lib/header-config";
import { normalizeFooterSettings } from "@/lib/footer-config";
import { normalizeContentPagesSettings } from "@/lib/content-pages-config";
import { resolveShareSettings } from "@/lib/share-config";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  DEFAULT_PRESET_COLOR,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  DEFAULT_STORE_NAME,
  DEFAULT_TIMEZONE,
  resolveFaviconUrl,
} from "@/config/branding.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_ORDER_SHIPPING_COST,
  DEFAULT_ORDER_TAX_RATE,
} from "@/lib/order-settings";
import { isCurrentSmtpConfigurationVerified } from "@/lib/smtp-verification";

const getPublicSettingsPayload = unstable_cache(
  async () => {
    await connectDB();

    const settings = await getSettings();
    const header = normalizeHeaderSettings(settings.header);
    const footer = normalizeFooterSettings(settings.footer);

    // Resolve credentials from two sources (DB wins, .env is the fallback).
    const oauth = resolveOAuthCredentials(settings.security);
    const stripeCreds = resolveStripeCredentials(settings.payment?.stripe);
    const paypalCreds = resolvePayPalCredentials(settings.payment?.paypal);
    const razorpayCreds = resolveRazorpayCredentials(settings.payment?.razorpay);
    const paystackCreds = resolvePaystackCredentials(settings.payment?.paystack);
    const analytics = resolveAnalyticsConfig(settings.analytics);

    const googleOAuthConfigured = Boolean(
      oauth.google.clientId && oauth.google.clientSecret,
    );
    const facebookOAuthConfigured = Boolean(
      oauth.facebook.appId && oauth.facebook.appSecret,
    );
    // Enable when credentials resolve AND either the admin toggled it on, or
    // the credentials come purely from .env (matches lib/auth.ts).
    const googleFromEnvOnly = Boolean(
      !settings.security?.googleClientId &&
        !settings.security?.googleClientSecret,
    );
    const facebookFromEnvOnly = Boolean(
      !settings.security?.facebookAppId && !settings.security?.facebookAppSecret,
    );

    // Return only public settings (no secrets, credentials)
    return {
      success: true,
      data: {
        storeName: settings.general?.storeName?.trim() || DEFAULT_STORE_NAME,
        storeDescription: settings.general?.storeDescription,
        storeEmail: settings.general?.storeEmail,
        storePhone: settings.general?.storePhone,
        storeAddress: settings.general?.storeAddress,
        defaultLanguage: settings.general?.defaultLanguage || DEFAULT_LANGUAGE,
        defaultCurrency: settings.general?.defaultCurrency || DEFAULT_CURRENCY,
        multiVendorMode: {
          enabled: Boolean(settings.multiVendorMode?.enabled),
          canManageProducts: Boolean(settings.multiVendorMode?.canManageProducts),
          canViewOrders: Boolean(settings.multiVendorMode?.canViewOrders),
          canManageOrders: Boolean(settings.multiVendorMode?.canManageOrders),
          canManageStoreSettings: Boolean(
            settings.multiVendorMode?.canManageStoreSettings,
          ),
          canViewAnalytics: Boolean(settings.multiVendorMode?.canViewAnalytics),
          canManagePayouts: Boolean(settings.multiVendorMode?.canManagePayouts),
          canAccessPOS: Boolean(settings.multiVendorMode?.canAccessPOS),
        },
        logoUrl: settings.general?.logoUrl,
        darkModeLogoUrl: settings.general?.darkModeLogoUrl,
        faviconUrl: resolveFaviconUrl(settings.general?.faviconUrl),
        timezone: settings.general?.timezone || DEFAULT_TIMEZONE,

        // Appearance
        appearance: {
          primaryColor:
            settings.appearance?.primaryColor || DEFAULT_PRIMARY_COLOR,
          secondaryColor:
            settings.appearance?.secondaryColor || DEFAULT_SECONDARY_COLOR,
          accentColor: settings.appearance?.accentColor || DEFAULT_ACCENT_COLOR,
          theme: settings.appearance?.theme || "system",
          contrast: settings.appearance?.contrast || false,
          rtl: settings.appearance?.rtl || false,
          collapsedSidebar: settings.appearance?.collapsedSidebar || false,
          navLayout: settings.appearance?.navLayout || "mini",
          navColor: settings.appearance?.navColor || "integrate",
          presetColor: settings.appearance?.presetColor || DEFAULT_PRESET_COLOR,
          fontFamily: settings.appearance?.fontFamily,
          borderRadius: settings.appearance?.borderRadius,
        },

        // Payment (only enabled status, no keys)
        payment: {
          stripeEnabled: settings.payment?.stripe?.enabled || false,
          paypalEnabled: settings.payment?.paypal?.enabled || false,
          razorpayEnabled: settings.payment?.razorpay?.enabled || false,
          paystackEnabled: settings.payment?.paystack?.enabled || false,
          codEnabled: settings.payment?.cod?.enabled ?? true,
          stripePublishableKey: stripeCreds.publishableKey,
          paypalClientId: paypalCreds.clientId,
          paypalMode: paypalCreds.mode,
          razorpayKeyId: razorpayCreds.keyId,
          paystackPublicKey: paystackCreds.publicKey,
          codInstructions: settings.payment?.cod?.instructions,
          codMinOrderAmount: settings.payment?.cod?.minOrderAmount,
          codMaxOrderAmount: settings.payment?.cod?.maxOrderAmount,
          stripeConfigured:
            (settings.payment?.stripe?.enabled || false) &&
            Boolean(stripeCreds.secretKey),
          paypalConfigured:
            (settings.payment?.paypal?.enabled || false) &&
            Boolean(paypalCreds.clientId && paypalCreds.clientSecret),
          razorpayConfigured:
            (settings.payment?.razorpay?.enabled || false) &&
            Boolean(razorpayCreds.keyId && razorpayCreds.keySecret),
          paystackConfigured:
            (settings.payment?.paystack?.enabled || false) &&
            Boolean(paystackCreds.secretKey),
        },

        // POS
        pos: {
          enabled: settings.pos?.enabled || false,
          language: settings.pos?.language || "en",
          defaultPosLocationId: settings.pos?.defaultPosLocationId,
          printedReceiptsEnabled:
            settings.pos?.customize?.printedReceiptsEnabled || false,
          offlinePaymentsEnabled:
            settings.pos?.checkout?.offlinePaymentsEnabled || false,
          allowAdminSales: settings.pos?.allowAdminSales ?? true,
          allowVendorSales: settings.pos?.allowVendorSales ?? true,
          allowSellerSales: settings.pos?.allowSellerSales ?? true,
        },

        // Orders
        orders: {
          taxRate: settings.orders?.taxRate ?? DEFAULT_ORDER_TAX_RATE,
          freeShippingThreshold:
            settings.orders?.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD,
          defaultShippingCost:
            settings.orders?.defaultShippingCost ?? DEFAULT_ORDER_SHIPPING_COST,
        },

        shipping: {
          enabled: settings.shipping?.enabled ?? false,
          weightUnit: settings.shipping?.weightUnit ?? "kg",
          delivery: {
            processingDaysMin: settings.shipping?.delivery?.processingDaysMin ?? 0,
            processingDaysMax: settings.shipping?.delivery?.processingDaysMax ?? 0,
            showEstimatedDelivery: settings.shipping?.delivery?.showEstimatedDelivery ?? true,
          },
          zones: settings.shipping?.zones ?? [],
          fallbackRate: settings.shipping?.fallbackRate,
          localPickup: settings.shipping?.localPickup,
          customs: settings.shipping?.customs,
          vendorShipping: settings.shipping?.vendorShipping,
          origin: settings.shipping?.origin
            ? { country: settings.shipping.origin.country }
            : undefined,
        },

        // Security (only public flags)
        security: {
          emailVerificationRequired:
            Boolean(settings.security?.emailVerificationRequired) &&
            isCurrentSmtpConfigurationVerified(settings),
          googleOAuthEnabled:
            ((settings.security?.googleOAuthEnabled || false) ||
              googleFromEnvOnly) &&
            googleOAuthConfigured,
          facebookOAuthEnabled:
            ((settings.security?.facebookOAuthEnabled || false) ||
              facebookFromEnvOnly) &&
            facebookOAuthConfigured,
          twoFactorEnabled: settings.security?.twoFactorEnabled || false,
        },

        // SEO
        seo: {
          metaTitle: settings.seo?.metaTitle,
          metaDescription: settings.seo?.metaDescription,
          ogImage: settings.seo?.ogImage,
        },

        // Social
        social: {
          facebookUrl: settings.social?.facebookUrl,
          twitterUrl: settings.social?.twitterUrl,
          instagramUrl: settings.social?.instagramUrl,
          youtubeUrl: settings.social?.youtubeUrl,
          linkedinUrl: settings.social?.linkedinUrl,
          tiktokUrl: settings.social?.tiktokUrl,
        },

        // Share buttons (storefront product sharing)
        share: resolveShareSettings(settings.social?.share),

        // Analytics (for frontend tracking - no API keys exposed)
        analytics: {
          googleAnalyticsId: analytics.googleAnalyticsId,
          googleTagManagerId: analytics.googleTagManagerId,
          facebookPixelId: analytics.facebookPixelId,
          tiktokPixelId: analytics.tiktokPixelId,
          plausibleDomain: settings.analytics?.plausibleDomain,
          plausibleSelfHosted: settings.analytics?.plausibleSelfHosted ?? false,
          plausibleBaseUrl: settings.analytics?.plausibleBaseUrl,
        },

        // Maintenance
        maintenance: {
          enabled: settings.maintenance?.enabled || false,
          title: settings.maintenance?.title,
          message: settings.maintenance?.message,
          backgroundImageUrl: settings.maintenance?.backgroundImageUrl,
          countdownEnabled: settings.maintenance?.countdownEnabled || false,
          countdownEndsAt: settings.maintenance?.countdownEndsAt,
        },

        // Home page editor configuration
        header,
        footer,
        homePage: normalizeHomePageSettings(
          settings.homePage ?? getDefaultHomePageSettings(),
        ),
        contentPages: normalizeContentPagesSettings(settings.contentPages),
      },
    };
  },
  ["public-settings"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.settings],
  },
);

/**
 * GET /api/settings/public
 * Public endpoint to get non-sensitive app settings
 * Used by frontend to determine multi-vendor mode, POS status, etc.
 */
export async function GET() {
  try {
    return NextResponse.json(await getPublicSettingsPayload());
  } catch (error) {
    console.error("Failed to get public settings:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load settings" },
      { status: 500 },
    );
  }
}
