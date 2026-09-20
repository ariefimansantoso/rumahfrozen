import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { appConfig } from "@/config/app.config";
import {
  DEFAULT_CURRENCY,
  DEFAULT_FAVICON_URL,
  resolveFaviconUrl,
} from "@/config/branding.config";
import { locales, type Locale } from "@/config/i18n.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";

export interface StorefrontMetadataSettings {
  storeName: string;
  storeDescription?: string;
  defaultCurrency: string;
  faviconUrl: string;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
    ogImage?: string;
  };
  social: {
    twitterHandle?: string;
  };
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Extract a Twitter handle (without "@") from a profile URL or bare handle.
 * Returns undefined when no handle can be derived.
 */
function extractTwitterHandle(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  // Already a bare handle (e.g. "@storify" or "storify").
  const handleMatch = raw.match(/^@?([A-Za-z0-9_]{1,15})$/);
  if (handleMatch) return handleMatch[1];

  // URL form: capture the last non-empty path segment.
  try {
    const url = new URL(raw);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^@?[A-Za-z0-9_]{1,15}$/.test(last)) {
      return last.replace(/^@/, "");
    }
  } catch {
    // not a URL — fall through
  }
  return undefined;
}

export function normalizeMetadataText(value: unknown) {
  const text = normalizeOptionalText(value);
  if (!text) return "";

  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateMetadataText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export const getStorefrontMetadataSettings = unstable_cache(
  async (): Promise<StorefrontMetadataSettings> => {
    try {
      await connectDB();
      const settings = await getSettings();
      const general = settings.general;
      const seo = settings.seo;

      return {
        storeName: normalizeOptionalText(general?.storeName) || appConfig.name,
        storeDescription: normalizeOptionalText(general?.storeDescription),
        defaultCurrency: String(
          general?.defaultCurrency || DEFAULT_CURRENCY,
        ).toUpperCase(),
        faviconUrl: resolveFaviconUrl(general?.faviconUrl),
        seo: {
          metaTitle: normalizeOptionalText(seo?.metaTitle),
          metaDescription: normalizeOptionalText(seo?.metaDescription),
          metaKeywords: normalizeOptionalText(seo?.metaKeywords),
          ogImage: normalizeOptionalText(seo?.ogImage),
        },
        social: {
          twitterHandle: extractTwitterHandle(settings.social?.twitterUrl),
        },
      };
    } catch {
      return {
        storeName: appConfig.name,
        storeDescription: appConfig.description,
        defaultCurrency: DEFAULT_CURRENCY,
        faviconUrl: DEFAULT_FAVICON_URL,
        seo: {},
        social: {},
      };
    }
  },
  ["storefront-metadata-settings"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.settings],
  },
);

export function getStorefrontIcons(faviconUrl: string): Metadata["icons"] {
  return {
    icon: faviconUrl,
    shortcut: faviconUrl,
    apple: faviconUrl,
  };
}

export function getLocalizedAlternates({
  baseUrl,
  locale,
  page,
}: {
  baseUrl: string;
  locale: Locale | string;
  page: string;
}): NonNullable<Metadata["alternates"]> {
  const normalizedPage = page === "/" ? "" : page;
  const languages: Record<string, string> = {};

  for (const loc of locales) {
    languages[loc] = `${baseUrl}/${loc}${normalizedPage}`;
  }

  return {
    canonical: `${baseUrl}/${locale}${normalizedPage}`,
    languages,
  };
}
