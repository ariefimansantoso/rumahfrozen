/**
 * Rate Limiting Middleware Helpers
 * Simplified helpers for applying rate limits in API routes
 */

import { NextRequest } from "next/server";
import { checkRateLimit, rateLimitPresets } from "@/lib/rate-limit";
import { RateLimitError } from "./errors";
import { resolveRateLimitPresetForIdentifier } from "@/lib/api/rate-limit-config";
import { USER_ROLES, type UserRole } from "@/config/app.config";

export type RateLimitPreset = keyof typeof rateLimitPresets;

function shouldBypassRateLimiting(role?: UserRole | string | null): boolean {
  return typeof role === "string" && role !== USER_ROLES.CUSTOMER;
}

/**
 * Extract client IP address from request headers
 * Handles various proxy configurations
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers set by proxies/load balancers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  return "unknown";
}

/**
 * Apply rate limiting with the given identifier and preset
 * @throws RateLimitError if rate limit exceeded
 */
export function applyRateLimit(
  request: NextRequest,
  identifier: string,
  preset: RateLimitPreset = "lenient"
): void {
  const resolved = resolveRateLimitPresetForIdentifier(identifier, preset);
  if (!resolved) return;
  const config = rateLimitPresets[resolved];
  const result = checkRateLimit(identifier, config);

  if (!result.allowed) {
    throw new RateLimitError(
      `Too many requests. Please try again in ${result.resetIn} seconds.`,
      result.resetIn
    );
  }
}

function getRequestRateLimitScope(request: NextRequest): string {
  const req = request as NextRequest & {
    nextUrl?: { pathname?: string };
    url?: string;
  };
  const method = req.method || "UNKNOWN";

  if (req.nextUrl?.pathname) {
    return `${method}:${req.nextUrl.pathname}`;
  }

  if (req.url) {
    try {
      return `${method}:${new URL(req.url).pathname}`;
    } catch {
      // Fall through to the stable fallback below.
    }
  }

  return `${method}:/unknown`;
}

/**
 * Rate limit by IP address
 * Use for public endpoints or when user is not authenticated
 */
export function rateLimitByIP(
  request: NextRequest,
  preset: RateLimitPreset = "lenient"
): void {
  const ip = getClientIP(request);
  const scope = getRequestRateLimitScope(request);
  applyRateLimit(request, `ip:${ip}:${scope}`, preset);
}

/**
 * Rate limit by user ID and action
 * Use for authenticated endpoints to track per-user limits
 */
export function rateLimitByUser(
  request: NextRequest,
  userId: string,
  action: string,
  preset: RateLimitPreset = "moderate",
  role?: UserRole | string | null
): void {
  if (shouldBypassRateLimiting(role)) return;
  applyRateLimit(request, `user:${userId}:${action}`, preset);
}

/**
 * Rate limit by session ID
 * Use for guest users with a session identifier
 */
export function rateLimitBySession(
  request: NextRequest,
  sessionId: string,
  action: string,
  preset: RateLimitPreset = "lenient"
): void {
  applyRateLimit(request, `session:${sessionId}:${action}`, preset);
}

/**
 * Rate limit by email address
 * Use for authentication-related endpoints
 */
export function rateLimitByEmail(
  request: NextRequest,
  email: string,
  action: string,
  preset: RateLimitPreset = "strict"
): void {
  const normalizedEmail = email.toLowerCase().trim();
  applyRateLimit(request, `email:${normalizedEmail}:${action}`, preset);
}

/**
 * Combined rate limit by both IP and user
 * Provides defense in depth - limits apply independently
 */
export function rateLimitByIPAndUser(
  request: NextRequest,
  userId: string,
  action: string,
  ipPreset: RateLimitPreset = "lenient",
  userPreset: RateLimitPreset = "moderate",
  role?: UserRole | string | null
): void {
  if (shouldBypassRateLimiting(role)) return;
  // First check IP limit
  rateLimitByIP(request, ipPreset);

  // Then check user-specific limit
  rateLimitByUser(request, userId, action, userPreset, role);
}

/**
 * Get rate limit status without incrementing counter
 * Useful for displaying remaining requests to users
 */
export function getRateLimitInfo(
  identifier: string,
  preset: RateLimitPreset = "lenient"
): {
  remaining: number;
  resetIn: number;
  limit: number;
} {
  const resolved = resolveRateLimitPresetForIdentifier(identifier, preset);
  if (!resolved) {
    return { remaining: Number.POSITIVE_INFINITY, resetIn: 0, limit: 0 };
  }
  const config = rateLimitPresets[resolved];
  const result = checkRateLimit(identifier, config);

  return {
    remaining: result.allowed ? config.max - 1 : 0,
    resetIn: result.resetIn,
    limit: config.max,
  };
}

/**
 * Preset descriptions for documentation
 */
export const RATE_LIMIT_DESCRIPTIONS = {
  strict: "5 requests per 15 minutes - Use for sensitive operations like login",
  moderate: "20 requests per 15 minutes - Use for authenticated mutations",
  lenient: "100 requests per 15 minutes - Use for general API access",
  veryStrict: "3 requests per 30 minutes - Use for password reset, 2FA",
} as const;
