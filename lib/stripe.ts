/**
 * Stripe Server Configuration
 * Server-side Stripe instance for API routes
 */

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Create Stripe instance only if key is available
// This prevents build errors when key is not set
let stripe: Stripe | null = null;
const stripeBySecretKey = new Map<string, Stripe>();

if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
    typescript: true,
  });
}

/**
 * Get Stripe instance (throws if not configured)
 */
export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable."
    );
  }
  return stripe;
}

export function getStripeForSecretKey(secretKey?: string): Stripe {
  const key = secretKey || stripeSecretKey;
  if (!key) {
    throw new Error("Stripe is not configured. Missing secret key.");
  }

  const cached = stripeBySecretKey.get(key);
  if (cached) return cached;

  const instance = new Stripe(key, {
    apiVersion: "2026-02-25.clover",
    typescript: true,
  });
  stripeBySecretKey.set(key, instance);
  return instance;
}

export function isStripeSecretKeyConfigured(secretKey?: string): boolean {
  return Boolean(secretKey || stripeSecretKey);
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!stripeSecretKey;
}

/**
 * Get Stripe publishable key for client
 */
export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
}

// Export stripe for direct usage (may be null)
export { stripe };
