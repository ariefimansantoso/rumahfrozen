import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app.config";
import { DEFAULT_FAVICON_URL } from "@/config/branding.config";
import { getStorefrontMetadataSettings } from "@/lib/storefront-metadata";

// Read store settings per request so the installed-app name and icon
// (the "Open in app" / Add-to-Home-Screen icon) reflect the configured
// favicon instead of the bundled defaults.
export const dynamic = "force-dynamic";

// Best-effort MIME type from the favicon URL extension (query string stripped).
function faviconType(url: string): string | undefined {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".ico")) return "image/x-icon";
  return undefined;
}

// Bundled fallback icons, used when no custom favicon is configured
// (the default "/favicon.svg" placeholder isn't shipped as a file).
const FALLBACK_ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  { src: "/pwa/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: "/pwa/maskable-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
];

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { storeName, storeDescription, faviconUrl } =
    await getStorefrontMetadataSettings();

  const hasCustomFavicon = faviconUrl !== DEFAULT_FAVICON_URL;

  // When a real favicon is set, use it as the single "any"-purpose icon so the
  // browser/desktop install picks it. We intentionally omit a maskable entry:
  // a favicon isn't designed with a maskable safe zone, so Android letterboxes
  // it on `background_color` instead of cropping the logo.
  const icons: MetadataRoute.Manifest["icons"] = hasCustomFavicon
    ? [{ src: faviconUrl, sizes: "any", type: faviconType(faviconUrl), purpose: "any" }]
    : FALLBACK_ICONS;

  return {
    id: "/",
    name: storeName,
    short_name: storeName,
    description: storeDescription || appConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#ffffff",
    theme_color: "#111111",
    orientation: "any",
    categories: ["shopping", "business", "productivity"],
    icons,
    shortcuts: [
      {
        name: "Orders",
        short_name: "Orders",
        url: "/admin/orders",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "POS",
        short_name: "POS",
        url: "/admin/pos",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
