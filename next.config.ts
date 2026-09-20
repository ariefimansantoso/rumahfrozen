import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import {
  getEnvRemoteImageDomains,
  getRemotePatterns,
} from "./lib/remote-image-domains";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ['@exodus/bytes', 'html-encoding-sniffer'],
  serverExternalPackages: ['jsdom'],
  reactCompiler: true,
  skipTrailingSlashRedirect: true,
  outputFileTracingIncludes: {
    "/api/admin/ai-authoring/hero-banner": [
      "./node_modules/@fontsource/noto-sans/files/*.woff2",
      "./node_modules/@fontsource/noto-sans-bengali/files/*.woff2",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache",
          },
        ],
      },
      {
        // Local-storage uploads (default path prefix). Keys embed a
        // timestamp + random suffix so they never change → cache forever.
        // The CSP sandbox neutralizes scripts in user-supplied SVGs, which
        // would otherwise run same-origin when opened directly.
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          },
        ],
      },
    ];
  },
  images: {
    // Single source of truth shared with AppImage's trusted-host check
    // (lib/remote-image-domains.ts) so the optimizer whitelist and the
    // client-side "can the optimizer load this?" decision never drift apart.
    // Env-configured custom storage domains (STORAGE_PUBLIC_URL etc.) are
    // appended so self-hosted CDN setups get optimized images too.
    remotePatterns: getRemotePatterns(getEnvRemoteImageDomains()),
  },
};

export default withNextIntl(nextConfig);
