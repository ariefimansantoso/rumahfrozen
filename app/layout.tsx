import "./globals.css";
import type { Metadata, Viewport } from "next";
import { unstable_cache } from "next/cache";
import { appConfig } from "@/config/app.config";
import { Geist_Mono, Inter } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import type { InitialAppSettings } from "@/providers/app-settings-provider";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import { resolveShareSettings } from "@/lib/share-config";
import {
  DEFAULT_CURRENCY,
  DEFAULT_FAVICON_URL,
  DEFAULT_STORE_NAME,
  resolveFaviconUrl,
} from "@/config/branding.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.description,
  manifest: "/manifest.webmanifest",
  applicationName: appConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appConfig.name,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  colorScheme: "light dark",
};

const getInitialAppSettings = unstable_cache(
  async (): Promise<InitialAppSettings> => {
    try {
      await connectDB();
      const settings = await getSettings();
      const general = settings.general;
      const appearance = settings.appearance;

      return {
        isMultiVendor: Boolean(settings.multiVendorMode?.enabled),
        isLoading: false,
        posEnabled: Boolean(settings.pos?.enabled),
        storeName:
          typeof general?.storeName === "string" && general.storeName.trim()
            ? general.storeName.trim()
            : DEFAULT_STORE_NAME,
        storeDescription: general?.storeDescription || undefined,
        storeEmail: general?.storeEmail || undefined,
        storePhone: general?.storePhone || undefined,
        storeAddress: general?.storeAddress || undefined,
        defaultCurrency: general?.defaultCurrency || DEFAULT_CURRENCY,
        defaultLanguage: general?.defaultLanguage || undefined,
        logoUrl: general?.logoUrl || undefined,
        darkModeLogoUrl: general?.darkModeLogoUrl || undefined,
        faviconUrl: resolveFaviconUrl(general?.faviconUrl),
        socialLinks: {
          facebookUrl: settings.social?.facebookUrl || undefined,
          twitterUrl: settings.social?.twitterUrl || undefined,
          instagramUrl: settings.social?.instagramUrl || undefined,
          youtubeUrl: settings.social?.youtubeUrl || undefined,
          linkedinUrl: settings.social?.linkedinUrl || undefined,
          tiktokUrl: settings.social?.tiktokUrl || undefined,
        },
        shareSettings: resolveShareSettings(settings.social?.share),
        appearance: {
          themeMode: appearance?.theme || "system",
          contrast: Boolean(appearance?.contrast),
          rtl: Boolean(appearance?.rtl),
          collapsedSidebar: Boolean(appearance?.collapsedSidebar),
          navLayout: appearance?.navLayout || "mini",
          navColor: appearance?.navColor || "integrate",
          presetColor: appearance?.presetColor || "default",
        },
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to preload app settings:", error);
      }

      return {
        isLoading: false,
        storeName: DEFAULT_STORE_NAME,
        defaultCurrency: DEFAULT_CURRENCY,
        faviconUrl: DEFAULT_FAVICON_URL,
      };
    }
  },
  ["initial-app-settings"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.settings],
  },
);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSettings = await getInitialAppSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inter.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders initialSettings={initialSettings}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
