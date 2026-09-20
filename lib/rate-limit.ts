/**
 * Rate Limiting Utility
 * In-memory rate limiter for API routes
 * For production, consider using Upstash Redis
 */

// In-memory store for rate limiting (reset on server restart)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds
  limit: number;
}

interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Maximum requests per window
}

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (email, IP, etc.)
 * @param options - Rate limit configuration
 * @returns RateLimitResult
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const { windowMs = 15 * 60 * 1000, max = 100 } = options; // Default: 100 requests per 15 minutes
  const now = Date.now();
  const key = identifier;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // No record or expired, start fresh
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: max - 1,
      resetIn: Math.ceil(windowMs / 1000),
      limit: max,
    };
  }

  // Increment count
  record.count += 1;

  if (record.count > max) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((record.resetTime - now) / 1000),
      limit: max,
    };
  }

  return {
    allowed: true,
    remaining: max - record.count,
    resetIn: Math.ceil((record.resetTime - now) / 1000),
    limit: max,
  };
}

/**
 * Reset rate limit for a given identifier
 * Useful after successful authentication
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  identifier: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const { windowMs = 15 * 60 * 1000, max = 100 } = options;
  const now = Date.now();
  const key = identifier;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    return {
      allowed: true,
      remaining: max,
      resetIn: Math.ceil(windowMs / 1000),
      limit: max,
    };
  }

  return {
    allowed: record.count < max,
    remaining: Math.max(0, max - record.count),
    resetIn: Math.ceil((record.resetTime - now) / 1000),
    limit: max,
  };
}

// Preset rate limit configurations
export const rateLimitPresets = {
  // Strict: 5 attempts per 15 minutes (for login, password reset)
  strict: { windowMs: 15 * 60 * 1000, max: 5 },

  // Moderate: 20 attempts per 15 minutes (for registration)
  moderate: { windowMs: 15 * 60 * 1000, max: 20 },

  // Lenient: 100 attempts per 15 minutes (for general API)
  lenient: { windowMs: 15 * 60 * 1000, max: 100 },

  // Very strict: 3 attempts per 30 minutes (for 2FA)
  veryStrict: { windowMs: 30 * 60 * 1000, max: 3 },
};

/**
 * Clean up expired entries from the store
 * Call periodically to prevent memory leaks
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes. unref() so this housekeeping timer never
// keeps the Node process alive on its own (no-op in non-Node runtimes).
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}
