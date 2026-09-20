/**
 * Two-Source Credential Resolution
 *
 * Integration credentials (payments, OAuth, SMTP, storage, analytics) can be
 * supplied from two sources: the admin Settings page (persisted in the DB) and
 * the `.env` file. This module owns the single, consistent merge rule:
 *
 *   DB value wins; the matching env var is the per-field fallback.
 *
 * An empty / whitespace-only value counts as "unset" and falls through to env.
 * The DB value is returned verbatim when present (never trimmed/mutated) so
 * stored secrets are not altered.
 */

import type {
  IStripeSettings,
  IPayPalSettings,
  IRazorpaySettings,
  IPaystackSettings,
  ISecuritySettings,
  IStorageSettings,
  IAnalyticsSettings,
  ISettings,
} from "@/models/settings.model";
import type { PayPalMode } from "@/lib/paypal";

/**
 * Env var names, declared once so the resolvers and `getCredentialEnvSources`
 * stay in sync.
 */
const ENV = {
  stripeSecretKey: ["STRIPE_SECRET_KEY"],
  stripePublishableKey: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
  stripeWebhookSecret: ["STRIPE_WEBHOOK_SECRET"],

  paypalClientId: ["PAYPAL_CLIENT_ID"],
  paypalClientSecret: ["PAYPAL_CLIENT_SECRET"],
  paypalWebhookId: ["PAYPAL_WEBHOOK_ID"],

  razorpayKeyId: ["RAZORPAY_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID"],
  razorpayKeySecret: ["RAZORPAY_KEY_SECRET"],
  razorpayWebhookSecret: ["RAZORPAY_WEBHOOK_SECRET"],

  paystackSecretKey: ["PAYSTACK_SECRET_KEY"],
  paystackPublicKey: ["PAYSTACK_PUBLIC_KEY", "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"],

  googleClientId: ["GOOGLE_CLIENT_ID"],
  googleClientSecret: ["GOOGLE_CLIENT_SECRET"],
  facebookAppId: ["FACEBOOK_APP_ID"],
  facebookAppSecret: ["FACEBOOK_APP_SECRET"],

  smtpHost: ["SMTP_HOST"],
  smtpPort: ["SMTP_PORT"],
  smtpUser: ["SMTP_USER"],
  smtpPass: ["SMTP_PASS"],
  smtpFrom: ["SMTP_FROM"],

  storageAccessKeyId: ["STORAGE_ACCESS_KEY_ID"],
  storageSecretAccessKey: ["STORAGE_SECRET_ACCESS_KEY"],
  storageAccountId: ["STORAGE_ACCOUNT_ID"],
  storageEndpoint: ["STORAGE_ENDPOINT"],
  storageRegion: ["STORAGE_REGION"],
  storageBucket: ["STORAGE_BUCKET"],
  storagePublicUrl: ["STORAGE_PUBLIC_URL", "CLOUDFLARE_R2_PUBLIC_URL"],

  gaId: ["NEXT_PUBLIC_GA_ID"],
  gtmId: ["NEXT_PUBLIC_GTM_ID"],
  facebookPixelId: ["NEXT_PUBLIC_FACEBOOK_PIXEL_ID"],
  tiktokPixelId: ["NEXT_PUBLIC_TIKTOK_PIXEL_ID"],
  plausibleApiKey: ["PLAUSIBLE_API_KEY"],

  openaiApiKey: ["OPENAI_API_KEY"],
} as const;

function envValue(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

/** DB value wins (returned verbatim); first non-empty env var is the fallback. */
function pick(
  dbValue: string | undefined | null,
  envKeys: readonly string[],
): string | undefined {
  if (typeof dbValue === "string" && dbValue.trim() !== "") return dbValue;
  return envValue(envKeys);
}

/** True when at least one of the given env vars holds a non-empty value. */
function envSet(keys: readonly string[]): boolean {
  return envValue(keys) !== undefined;
}

// ============================================
// Payment
// ============================================

export interface ResolvedStripeCredentials {
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
}

export function resolveStripeCredentials(
  stripe?: Partial<IStripeSettings> | null,
): ResolvedStripeCredentials {
  return {
    secretKey: pick(stripe?.secretKey, ENV.stripeSecretKey),
    publishableKey: pick(stripe?.publishableKey, ENV.stripePublishableKey),
    webhookSecret: pick(stripe?.webhookSecret, ENV.stripeWebhookSecret),
  };
}

export interface ResolvedPayPalCredentials {
  clientId?: string;
  clientSecret?: string;
  mode: PayPalMode;
  webhookId?: string;
}

export function resolvePayPalCredentials(
  paypal?: Partial<IPayPalSettings> | null,
): ResolvedPayPalCredentials {
  return {
    clientId: pick(paypal?.clientId, ENV.paypalClientId),
    clientSecret: pick(paypal?.clientSecret, ENV.paypalClientSecret),
    mode: (paypal?.mode || "sandbox") as PayPalMode,
    webhookId: pick(paypal?.webhookId, ENV.paypalWebhookId),
  };
}

export interface ResolvedRazorpayCredentials {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

export function resolveRazorpayCredentials(
  razorpay?: Partial<IRazorpaySettings> | null,
): ResolvedRazorpayCredentials {
  return {
    keyId: pick(razorpay?.keyId, ENV.razorpayKeyId),
    keySecret: pick(razorpay?.keySecret, ENV.razorpayKeySecret),
    webhookSecret: pick(razorpay?.webhookSecret, ENV.razorpayWebhookSecret),
  };
}

export interface ResolvedPaystackCredentials {
  secretKey?: string;
  publicKey?: string;
}

export function resolvePaystackCredentials(
  paystack?: Partial<IPaystackSettings> | null,
): ResolvedPaystackCredentials {
  return {
    secretKey: pick(paystack?.secretKey, ENV.paystackSecretKey),
    publicKey: pick(paystack?.publicKey, ENV.paystackPublicKey),
  };
}

// ============================================
// OAuth / Social login
// ============================================

export interface ResolvedOAuthCredentials {
  google: { clientId?: string; clientSecret?: string };
  facebook: { appId?: string; appSecret?: string };
}

export function resolveOAuthCredentials(
  security?: Partial<ISecuritySettings> | null,
): ResolvedOAuthCredentials {
  return {
    google: {
      clientId: pick(security?.googleClientId, ENV.googleClientId),
      clientSecret: pick(security?.googleClientSecret, ENV.googleClientSecret),
    },
    facebook: {
      appId: pick(security?.facebookAppId, ENV.facebookAppId),
      appSecret: pick(security?.facebookAppSecret, ENV.facebookAppSecret),
    },
  };
}

// ============================================
// SMTP / Email
// ============================================

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
  tls: { minVersion: "TLSv1.2" };
}

/**
 * Resolve SMTP transport config from DB settings with per-field env fallback.
 * Returns null when no usable user/password can be resolved.
 *
 * Usable when the DB has SMTP enabled, OR env SMTP credentials are present
 * (so an env-only deployment works without touching the Settings page).
 */
export function resolveSmtpConfig(
  settings?: Pick<ISettings, "email"> | null,
): ResolvedSmtpConfig | null {
  const email = settings?.email;
  const provider = email?.provider ?? "smtp";
  const dbEnabledSmtp = Boolean(email?.enabled) && provider === "smtp";
  const envHasCreds = envSet(ENV.smtpUser) && envSet(ENV.smtpPass);

  if (!dbEnabledSmtp && !envHasCreds) return null;

  const host = pick(email?.smtp?.host, ENV.smtpHost) || "smtp.gmail.com";
  const portStr =
    pick(
      email?.smtp?.port ? String(email.smtp.port) : undefined,
      ENV.smtpPort,
    ) || "587";
  const port = parseInt(portStr, 10) || 587;
  const user = pick(email?.smtp?.user, ENV.smtpUser);
  const pass = pick(email?.smtp?.password, ENV.smtpPass);

  if (!user || !pass) return null;

  return {
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
  };
}

export function resolveSmtpFromEmail(
  settings?: Pick<ISettings, "email"> | null,
): string | undefined {
  return pick(settings?.email?.fromEmail, ENV.smtpFrom);
}

// ============================================
// Storage
// ============================================

export interface ResolvedStorageCredentials {
  accountId?: string;
  endpoint?: string;
  region?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
}

export function resolveStorageCredentials(
  storage?: Partial<IStorageSettings> | null,
): ResolvedStorageCredentials {
  return {
    accountId: pick(storage?.accountId, ENV.storageAccountId),
    endpoint: pick(storage?.endpoint, ENV.storageEndpoint),
    region: pick(storage?.region, ENV.storageRegion),
    bucketName: pick(storage?.bucketName, ENV.storageBucket),
    accessKeyId: pick(storage?.accessKeyId, ENV.storageAccessKeyId),
    secretAccessKey: pick(storage?.secretAccessKey, ENV.storageSecretAccessKey),
    publicUrl: pick(storage?.publicUrl, ENV.storagePublicUrl),
  };
}

// ============================================
// Analytics
// ============================================

export interface ResolvedAnalyticsConfig {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  tiktokPixelId?: string;
  plausibleApiKey?: string;
}

export function resolveAnalyticsConfig(
  analytics?: Partial<IAnalyticsSettings> | null,
): ResolvedAnalyticsConfig {
  return {
    googleAnalyticsId: pick(analytics?.googleAnalyticsId, ENV.gaId),
    googleTagManagerId: pick(analytics?.googleTagManagerId, ENV.gtmId),
    facebookPixelId: pick(analytics?.facebookPixelId, ENV.facebookPixelId),
    tiktokPixelId: pick(analytics?.tiktokPixelId, ENV.tiktokPixelId),
    plausibleApiKey: pick(analytics?.plausibleApiKey, ENV.plausibleApiKey),
  };
}

// ============================================
// AI (OpenAI)
// ============================================

export interface ResolvedOpenAICredentials {
  apiKey?: string;
}

/**
 * One shared OpenAI credential for every AI feature (authoring/studio and the
 * sales agent). Stored on `settings.aiAuthoring`; `OPENAI_API_KEY` remains the
 * env fallback so existing installs keep working without touching Settings.
 */
export function resolveOpenAICredentials(
  ai?: { apiKey?: string } | null,
): ResolvedOpenAICredentials {
  return {
    apiKey: pick(ai?.apiKey, ENV.openaiApiKey),
  };
}

// ============================================
// Env-source detection (for the admin "Set via environment" indicator)
// ============================================

export interface CredentialEnvSources {
  payment: {
    stripe: {
      publishableKey: boolean;
      secretKey: boolean;
      webhookSecret: boolean;
    };
    paypal: { clientId: boolean; clientSecret: boolean };
    razorpay: { keyId: boolean; keySecret: boolean; webhookSecret: boolean };
    paystack: { publicKey: boolean; secretKey: boolean };
  };
  security: {
    googleClientId: boolean;
    googleClientSecret: boolean;
    facebookAppId: boolean;
    facebookAppSecret: boolean;
  };
  email: { host: boolean; user: boolean; password: boolean };
  storage: {
    accountId: boolean;
    endpoint: boolean;
    region: boolean;
    bucketName: boolean;
    accessKeyId: boolean;
    secretAccessKey: boolean;
    publicUrl: boolean;
  };
  analytics: {
    googleAnalyticsId: boolean;
    googleTagManagerId: boolean;
    facebookPixelId: boolean;
    tiktokPixelId: boolean;
    plausibleApiKey: boolean;
  };
  ai: {
    apiKey: boolean;
  };
}

/**
 * Reports, per credential field, whether a `.env` fallback value is present.
 * Drives the read-only "Set via environment" hint on the admin Settings page.
 */
export function getCredentialEnvSources(): CredentialEnvSources {
  return {
    payment: {
      stripe: {
        publishableKey: envSet(ENV.stripePublishableKey),
        secretKey: envSet(ENV.stripeSecretKey),
        webhookSecret: envSet(ENV.stripeWebhookSecret),
      },
      paypal: {
        clientId: envSet(ENV.paypalClientId),
        clientSecret: envSet(ENV.paypalClientSecret),
      },
      razorpay: {
        keyId: envSet(ENV.razorpayKeyId),
        keySecret: envSet(ENV.razorpayKeySecret),
        webhookSecret: envSet(ENV.razorpayWebhookSecret),
      },
      paystack: {
        publicKey: envSet(ENV.paystackPublicKey),
        secretKey: envSet(ENV.paystackSecretKey),
      },
    },
    security: {
      googleClientId: envSet(ENV.googleClientId),
      googleClientSecret: envSet(ENV.googleClientSecret),
      facebookAppId: envSet(ENV.facebookAppId),
      facebookAppSecret: envSet(ENV.facebookAppSecret),
    },
    email: {
      host: envSet(ENV.smtpHost),
      user: envSet(ENV.smtpUser),
      password: envSet(ENV.smtpPass),
    },
    storage: {
      accountId: envSet(ENV.storageAccountId),
      endpoint: envSet(ENV.storageEndpoint),
      region: envSet(ENV.storageRegion),
      bucketName: envSet(ENV.storageBucket),
      accessKeyId: envSet(ENV.storageAccessKeyId),
      secretAccessKey: envSet(ENV.storageSecretAccessKey),
      publicUrl: envSet(ENV.storagePublicUrl),
    },
    analytics: {
      googleAnalyticsId: envSet(ENV.gaId),
      googleTagManagerId: envSet(ENV.gtmId),
      facebookPixelId: envSet(ENV.facebookPixelId),
      tiktokPixelId: envSet(ENV.tiktokPixelId),
      plausibleApiKey: envSet(ENV.plausibleApiKey),
    },
    ai: {
      apiKey: envSet(ENV.openaiApiKey),
    },
  };
}
