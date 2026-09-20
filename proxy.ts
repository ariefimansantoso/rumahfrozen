import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { connectDB } from "@/lib/db";
import { defaultLocale, locales } from "@/config/i18n.config";
import {
  buildMaintenanceHtml,
  isAllowedMaintenanceIp,
  normalizeMaintenanceSettings,
} from "@/lib/maintenance";
import { getSettings } from "@/models/settings.model";

const intlProxy = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

const STATIC_FILE_PATTERN = /\.[^/]+$/;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PAGE_BYPASS_PREFIXES = ["/admin", "/login", "/role-redirect", "/forbidden"];
const API_BYPASS_PREFIXES = [
  "/api/admin",
  "/api/vendor",
  "/api/auth",
  "/api/payments/webhook",
  "/api/payments/paypal/capture",
  "/api/payments/verify",
  "/api/payments/razorpay/verify",
  "/api/payments/razorpay/webhook",
  "/api/payments/paystack/verify",
  "/api/payments/paystack/webhook",
  "/api/settings/public",
];
const PROTECTED_API_PREFIXES = [
  "/api/cart",
  "/api/wishlist",
  "/api/orders",
  "/api/returns",
  "/api/payments/checkout",
  "/api/payments/stripe/intent",
  "/api/vendor/apply",
  "/api/reviews",
  "/api/blog-comments",
  "/api/user",
];
const MAINTENANCE_SETTINGS_TTL_MS = 15_000;

type MaintenanceSnapshot = {
  maintenance: ReturnType<typeof normalizeMaintenanceSettings>;
  storeName?: string;
  storeEmail?: string;
  logoUrl?: string;
  faviconUrl?: string;
};

let maintenanceSnapshotCache:
  | {
      expiresAt: number;
      value: MaintenanceSnapshot;
    }
  | undefined;

function stripLocalePrefix(pathname: string) {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];

  if (maybeLocale && locales.includes(maybeLocale as (typeof locales)[number])) {
    const stripped = `/${segments.slice(2).join("/")}`;
    return stripped === "/" ? "/" : stripped.replace(/\/+$/, "") || "/";
  }

  return pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
}

function getLocaleFromPathname(pathname: string) {
  const candidate = pathname.split("/")[1];
  return candidate && locales.includes(candidate as (typeof locales)[number])
    ? candidate
    : defaultLocale;
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAdminPath(pathname: string) {
  const normalizedPath = stripLocalePrefix(pathname);
  return normalizedPath === "/admin" || normalizedPath.startsWith("/admin/");
}

function isAdminLoginPath(request: NextRequest) {
  const normalizedPath = stripLocalePrefix(request.nextUrl.pathname);
  if (normalizedPath !== "/login") return false;

  const target =
    request.nextUrl.searchParams.get("redirect") ||
    request.nextUrl.searchParams.get("callbackUrl") ||
    "";

  return isAdminPath(target);
}

function shouldBypassMaintenanceApi(pathname: string, method: string) {
  return (
    !MUTATION_METHODS.has(method) ||
    matchesPrefix(pathname, API_BYPASS_PREFIXES) ||
    !matchesPrefix(pathname, PROTECTED_API_PREFIXES)
  );
}

function createMaintenanceHeaders(retryAfter?: number) {
  const headers = new Headers({
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Robots-Tag": "noindex, nofollow",
    Vary: "x-forwarded-for, x-real-ip, cf-connecting-ip",
  });

  if (retryAfter) {
    headers.set("Retry-After", String(retryAfter));
  }

  return headers;
}

async function getMaintenanceSnapshot() {
  const now = Date.now();
  if (maintenanceSnapshotCache && maintenanceSnapshotCache.expiresAt > now) {
    return maintenanceSnapshotCache.value;
  }

  await connectDB();
  const settings = await getSettings();
  const snapshot: MaintenanceSnapshot = {
    maintenance: normalizeMaintenanceSettings(
      settings.maintenance,
      settings.general?.storeName,
    ),
    storeName: settings.general?.storeName,
    storeEmail: settings.general?.storeEmail,
    logoUrl: settings.general?.logoUrl,
    faviconUrl: settings.general?.faviconUrl,
  };

  maintenanceSnapshotCache = {
    expiresAt: now + MAINTENANCE_SETTINGS_TTL_MS,
    value: snapshot,
  };

  return snapshot;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel/") ||
    pathname.startsWith("/ingest/") ||
    STATIC_FILE_PATTERN.test(pathname) ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg"
  ) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/") &&
    shouldBypassMaintenanceApi(pathname, request.method)
  ) {
    return NextResponse.next();
  }

  try {
    const snapshot = await getMaintenanceSnapshot();
    const maintenance = snapshot.maintenance;

    if (!maintenance.enabled) {
      return pathname.startsWith("/api/")
        ? NextResponse.next()
        : intlProxy(request);
    }

    if (isAllowedMaintenanceIp(getClientIp(request), maintenance.allowedIPs)) {
      return pathname.startsWith("/api/")
        ? NextResponse.next()
        : intlProxy(request);
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          code: "STORE_MAINTENANCE",
          message: maintenance.message,
          data: {
            title: maintenance.title,
            message: maintenance.message,
            backgroundImageUrl: maintenance.backgroundImageUrl,
            countdownEnabled: maintenance.countdownEnabled,
            countdownEndsAt: maintenance.countdownEndsAt,
          },
        },
        {
          status: 503,
          headers: createMaintenanceHeaders(maintenance.retryAfterSeconds),
        },
      );
    }

    const normalizedPath = stripLocalePrefix(pathname);
    if (
      matchesPrefix(normalizedPath, PAGE_BYPASS_PREFIXES) ||
      isAdminLoginPath(request)
    ) {
      return intlProxy(request);
    }

    const html = buildMaintenanceHtml({
      lang: getLocaleFromPathname(pathname),
      storeName: snapshot.storeName,
      storeEmail: snapshot.storeEmail,
      logoUrl: snapshot.logoUrl,
      faviconUrl: snapshot.faviconUrl,
      backgroundImageUrl: maintenance.backgroundImageUrl,
      title: maintenance.title,
      message: maintenance.message,
      countdownEndsAt: maintenance.countdownEnabled
        ? maintenance.countdownEndsAt
        : undefined,
    });

    const headers = createMaintenanceHeaders(maintenance.retryAfterSeconds);
    headers.set("Content-Type", "text/html; charset=utf-8");

    return new NextResponse(html, {
      status: 503,
      headers,
    });
  } catch {
    return pathname.startsWith("/api/")
      ? NextResponse.next()
      : intlProxy(request);
  }
}

export const config = {
  // /api/upload is excluded: the proxy does nothing for it (uploads bypass the
  // maintenance check), but requests matched here get their body capped at
  // Next's proxyClientMaxBodySize default of 10MB — which truncated larger
  // uploads and surfaced as "Failed to parse body as FormData".
  matcher: ["/((?!_next|_vercel|ingest|api/upload|.*\\..*).*)", "/"],
};
