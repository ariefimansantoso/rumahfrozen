import { locales, defaultLocale } from "@/config/i18n.config";
import { MetadataRoute } from "next";

/**
 * Generate sitemap for SEO
 * Includes all locales for each page
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Static pages that should be in sitemap
  const staticPages = ["", "/products", "/categories", "/login", "/register"];

  const sitemap: MetadataRoute.Sitemap = [];

  // Add static pages for each locale
  for (const page of staticPages) {
    for (const locale of locales) {
      sitemap.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === "" ? "daily" : "weekly",
        priority: page === "" ? 1.0 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${baseUrl}/${l}${page}`])
          ),
        },
      });
    }
  }

  return sitemap;
}
