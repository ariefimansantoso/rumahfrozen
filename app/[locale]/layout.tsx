import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { locales, localeConfig, type Locale } from "@/config/i18n.config";
import {
  getLocalizedAlternates,
  getStorefrontIcons,
  getStorefrontMetadataSettings,
} from "@/lib/storefront-metadata";

// Generate static params for all locales
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Generate metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const storeMetadata = await getStorefrontMetadataSettings();
  const title =
    storeMetadata.seo.metaTitle ||
    `${storeMetadata.storeName} | ${appConfig.tagline}`;
  const description =
    storeMetadata.seo.metaDescription ||
    storeMetadata.storeDescription ||
    appConfig.description;

  return {
    title: {
      // `absolute` so the home/default title isn't suffixed with the store
      // name again by a parent template (avoids "Storify | Storify").
      absolute: title,
      template: `%s | ${storeMetadata.storeName}`,
    },
    description,
    keywords: storeMetadata.seo.metaKeywords,
    authors: [{ name: storeMetadata.storeName }],
    creator: storeMetadata.storeName,
    publisher: storeMetadata.storeName,
    metadataBase: new URL(baseUrl),
    alternates: getLocalizedAlternates({ baseUrl, locale, page: "/" }),
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}`,
      siteName: storeMetadata.storeName,
      images: storeMetadata.seo.ogImage
        ? [{ url: storeMetadata.seo.ogImage, width: 1200, height: 630, alt: title }]
        : undefined,
      locale: locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: storeMetadata.seo.ogImage ? [storeMetadata.seo.ogImage] : undefined,
    },
    robots: { index: true, follow: true },
    icons: getStorefrontIcons(storeMetadata.faviconUrl),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the locale
  const messages = await getMessages();

  // Get locale direction (for RTL support)
  const direction = localeConfig[locale as Locale]?.direction || "ltr";

  return (
    <div lang={locale} dir={direction} className="min-h-screen">
      <NextIntlClientProvider messages={messages}>
        {children}
      </NextIntlClientProvider>
    </div>
  );
}
