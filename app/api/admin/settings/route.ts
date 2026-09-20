import { ValidationError } from "@/lib/api/errors";
import { connectDB } from "@/lib/db";
import { reloadAuthInstance } from "@/lib/auth";
import { EmailDelivery, getSettings, Settings } from "@/models";
import { successResponse } from "@/lib/api/response";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { createAuditContext, auditSettingsChange } from "@/lib/audit";
import { setRateLimitSettingsFromSecurity } from "@/lib/api/rate-limit-config";
import {
  CONTENT_PAGE_KEYS,
  normalizeContentPagesSettings,
} from "@/lib/content-pages-config";
import { normalizeHeaderSettings } from "@/lib/header-config";
import { normalizeFooterSettings } from "@/lib/footer-config";
import {
  getCredentialEnvSources,
  resolveSmtpConfig,
  type CredentialEnvSources,
} from "@/lib/credentials";
import { clearStorageConfigCache } from "@/lib/storage";
import {
  getSmtpConfigurationFingerprint,
  isCurrentSmtpConfigurationVerified,
} from "@/lib/smtp-verification";
import {
  DEMO_MODE_MESSAGE,
  getDemoModeMutationResponse,
  isDemoModeEnabled,
} from "@/lib/demo-mode";
import {
  revalidateProductContent,
  revalidateSettingsContent,
} from "@/lib/cache-invalidation";
import { ORDER_PREFIX_PATTERN } from "@/lib/order-settings";
import { withApi } from "@/lib/api/handler";

/**
 * Remove sensitive data from settings object
 */
function sanitizeSettings(settings: unknown): Record<string, unknown> {
  if (typeof settings !== "object" || settings === null) return {};
  const doc = settings as { toObject?: () => Record<string, unknown> } & Record<
    string,
    unknown
  >;
  const safe = doc.toObject ? doc.toObject() : { ...doc };
  const objectSections = [
    "general",
    "appearance",
    "payment",
    "email",
    "orders",
    "shipping",
    "seo",
    "social",
    "analytics",
    "maintenance",
    "security",
    "pos",
    "multiVendorMode",
    "notifications",
    "storage",
    "aiSalesAgent",
    "aiAuthoring",
    "header",
    "footer",
    "contentPages",
  ] as const;

  // Old/corrupted records may contain null for sections that the UI expects as objects.
  for (const section of objectSections) {
    if (!isPlainObject(safe[section])) {
      safe[section] = {};
    }
  }
  safe.header = normalizeHeaderSettings(safe.header);
  safe.footer = normalizeFooterSettings(safe.footer);
  safe.contentPages = normalizeContentPagesSettings(safe.contentPages);

  const meta: {
    payment: {
      stripe: { secretKeySet: boolean; webhookSecretSet: boolean };
      paypal: { clientSecretSet: boolean };
      razorpay: { keySecretSet: boolean; webhookSecretSet: boolean };
      paystack: { secretKeySet: boolean };
    };
    security: {
      googleClientSecretSet: boolean;
      facebookAppSecretSet: boolean;
    };
    ai: {
      apiKeySet: boolean;
    };
    demoMode: {
      enabled: boolean;
      message: string;
    };
    // Per-field flags reporting whether a `.env` fallback value is present.
    // Drives the read-only "Set via environment" hint in the admin UI.
    envSources: CredentialEnvSources;
  } = {
    payment: {
      stripe: { secretKeySet: false, webhookSecretSet: false },
      paypal: { clientSecretSet: false },
      razorpay: { keySecretSet: false, webhookSecretSet: false },
      paystack: { secretKeySet: false },
    },
    security: {
      googleClientSecretSet: false,
      facebookAppSecretSet: false,
    },
    ai: {
      apiKeySet: false,
    },
    demoMode: {
      enabled: isDemoModeEnabled(),
      message: DEMO_MODE_MESSAGE,
    },
    envSources: getCredentialEnvSources(),
  };

  // Payment secrets
  const payment = safe.payment;
  if (isPlainObject(payment)) {
    const stripe = payment.stripe;
    if (isPlainObject(stripe)) {
      meta.payment.stripe.secretKeySet = Boolean(stripe.secretKey);
      meta.payment.stripe.webhookSecretSet = Boolean(stripe.webhookSecret);
      delete stripe.secretKey;
      delete stripe.webhookSecret;
    }
    const paypal = payment.paypal;
    if (isPlainObject(paypal)) {
      meta.payment.paypal.clientSecretSet = Boolean(paypal.clientSecret);
      delete paypal.clientSecret;
    }
    const razorpay = payment.razorpay;
    if (isPlainObject(razorpay)) {
      meta.payment.razorpay.keySecretSet = Boolean(razorpay.keySecret);
      meta.payment.razorpay.webhookSecretSet = Boolean(
        razorpay.webhookSecret,
      );
      delete razorpay.keySecret;
      delete razorpay.webhookSecret;
    }
    const paystack = payment.paystack;
    if (isPlainObject(paystack)) {
      meta.payment.paystack.secretKeySet = Boolean(paystack.secretKey);
      delete paystack.secretKey;
    }
  }

  // Email secrets
  const email = safe.email;
  if (isPlainObject(email)) {
    const smtp = email.smtp;
    if (isPlainObject(smtp)) {
      delete smtp.password;
    }
    delete email.apiKey;
  }

  // OAuth secrets
  const security = safe.security;
  if (isPlainObject(security)) {
    meta.security.googleClientSecretSet = Boolean(
      security.googleClientSecret,
    );
    meta.security.facebookAppSecretSet = Boolean(
      security.facebookAppSecret,
    );
    delete security.googleClientSecret;
    delete security.facebookAppSecret;
    delete security.smtpVerificationFingerprint;
  }

  // Storage secrets
  const storage = safe.storage;
  if (isPlainObject(storage)) {
    delete storage.secretAccessKey;
  }

  // Analytics secrets
  const analytics = safe.analytics;
  if (isPlainObject(analytics)) {
    delete analytics.plausibleApiKey;
  }

  // AI secrets
  const aiAuthoring = safe.aiAuthoring;
  if (isPlainObject(aiAuthoring)) {
    meta.ai.apiKeySet = Boolean(
      typeof aiAuthoring.apiKey === "string" && aiAuthoring.apiKey.trim(),
    );
    delete aiAuthoring.apiKey;
  }

  safe._meta = meta;
  return safe;
}

const SECTION_ALLOWED_KEYS: Record<string, readonly string[]> = {
  general: [
    "storeName",
    "storeDescription",
    "storeEmail",
    "storePhone",
    "storeDomain",
    "storeAddress",
    "logoUrl",
    "darkModeLogoUrl",
    "faviconUrl",
    "defaultLanguage",
    "defaultCurrency",
    "supportedLanguages",
    "supportedCurrencies",
    "timezone",
  ],
  appearance: [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "theme",
    "contrast",
    "rtl",
    "collapsedSidebar",
    "navLayout",
    "navColor",
    "presetColor",
    "fontFamily",
    "borderRadius",
  ],
  payment: ["stripe", "paypal", "razorpay", "paystack", "cod"],
  email: [
    "provider",
    "enabled",
    "smtp",
    "fromEmail",
    "fromName",
    "replyTo",
    "apiKey",
    "logRetentionDays",
  ],
  orders: [
    "prefix",
    "taxRate",
    "freeShippingThreshold",
    "defaultShippingCost",
    "commission",
  ],
  shipping: [
    "enabled",
    "weightUnit",
    "origin",
    "delivery",
    "zones",
    "fallbackRate",
    "localPickup",
    "customs",
    "vendorShipping",
  ],
  seo: ["metaTitle", "metaDescription", "metaKeywords", "ogImage", "robotsTxt"],
  social: [
    "facebookUrl",
    "twitterUrl",
    "instagramUrl",
    "youtubeUrl",
    "linkedinUrl",
    "tiktokUrl",
    "share",
  ],
  analytics: [
    "googleAnalyticsId",
    "googleTagManagerId",
    "facebookPixelId",
    "tiktokPixelId",
    "plausibleDomain",
    "plausibleApiKey",
    "plausibleSelfHosted",
    "plausibleBaseUrl",
  ],
  maintenance: [
    "enabled",
    "title",
    "message",
    "backgroundImageUrl",
    "countdownEnabled",
    "countdownEndsAt",
    "allowedIPs",
  ],
  security: [
    "emailVerificationRequired",
    "emailVerificationForVendors",
    "twoFactorEnabled",
    "twoFactorRequiredForAdmin",
    "twoFactorRequiredForVendors",
    "twoFactorRequiredForStaff",
    "googleOAuthEnabled",
    "googleClientId",
    "googleClientSecret",
    "facebookOAuthEnabled",
    "facebookAppId",
    "facebookAppSecret",
    "sessionMaxAgeDays",
    "maxLoginAttempts",
    "lockoutDurationMinutes",
    "rateLimiting",
    "minPasswordLength",
    "requireUppercase",
    "requireNumbers",
    "requireSpecialChars",
  ],
  pos: [
    "enabled",
    "allowAdminSales",
    "allowVendorSales",
    "allowSellerSales",
    "language",
    "defaultPosLocationId",
    "customize",
    "checkout",
    "orders",
  ],
  multiVendorMode: [
    "enabled",
    "canManageProducts",
    "canViewOrders",
    "canManageOrders",
    "canManageStoreSettings",
    "canViewAnalytics",
    "canManageDiscounts",
    "canManagePayouts",
    "canAccessPOS",
  ],
  notifications: ["admin", "staff", "vendor", "customer"],
  storage: [
    "provider",
    "accountId",
    "endpoint",
    "region",
    "bucketName",
    "accessKeyId",
    "secretAccessKey",
    "publicUrl",
    "maxFileSizeMB",
    "maxImageSizeMB",
    "maxVideoSizeMB",
    "maxModelSizeMB",
    "allowedMimeTypes",
    "pathPrefix",
  ],
  aiSalesAgent: [
    "enabled",
    "model",
    "temperature",
    "reasoningEffort",
    "maxRecommendations",
    "agentName",
    "greeting",
    "tone",
    "instructions",
    "escalationMessage",
    "widget",
    "capabilities",
  ],
  aiAuthoring: [
    "enabled",
    "apiKey",
    "textModel",
    "imageModel",
    "surfaces",
    "imageDefaults",
    "brandVoice",
    "access",
    "limits",
  ],
  header: [
    "layout",
    "brand",
    "colors",
    "search",
    "market",
    "mobile",
    "widgets",
    "categoryMenu",
    "collectionsMenu",
    "utilityMenu",
    "pagesMenu",
  ],
  footer: [
    "layout",
    "brand",
    "colors",
    "widgets",
    "contact",
    "social",
    "linkColumns",
    "copyright",
    "paymentMethods",
  ],
  homePage: ["sectionOrder", "sections"],
  contentPages: [...CONTENT_PAGE_KEYS, "customPages"],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  if (isPlainObject(value)) return value;

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const maybeDoc = value as { toObject?: () => unknown };
    if (typeof maybeDoc.toObject === "function") {
      const obj = maybeDoc.toObject();
      return isPlainObject(obj) ? obj : {};
    }
    try {
      const obj = JSON.parse(JSON.stringify(value)) as unknown;
      return isPlainObject(obj) ? obj : {};
    } catch {
      return {};
    }
  }

  return {};
}

function flattenToDotPaths(
  basePath: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const walk = (prefix: string, current: unknown) => {
    if (isPlainObject(current)) {
      for (const [k, v] of Object.entries(current)) {
        walk(`${prefix}.${k}`, v);
      }
      return;
    }
    out[prefix] = current;
  };

  for (const [k, v] of Object.entries(value)) {
    walk(`${basePath}.${k}`, v);
  }

  return out;
}

function validateSectionUpdate(section: string, data: unknown) {
  const allowedKeys = SECTION_ALLOWED_KEYS[section];
  if (!allowedKeys) {
    throw new ValidationError(`Invalid section: ${section}`);
  }

  if (!isPlainObject(data)) {
    throw new ValidationError(`Invalid payload for section "${section}"`);
  }

  // Drop unknown keys instead of rejecting the whole request. Documents
  // persisted by older schema versions can carry stale fields (e.g. a removed
  // "canManageStaff" on multiVendorMode); the client echoes the full section
  // back on save, and throwing here would block every save of that section.
  // Only allow-listed paths are ever written ($set in flattenToDotPaths), so
  // stripping the extras is safe.
  for (const key of Object.keys(data)) {
    if (!allowedKeys.includes(key)) {
      delete (data as Record<string, unknown>)[key];
    }
  }
}

function deleteNestedKey(obj: Record<string, unknown>, path: string) {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = current[keys[i]];
    if (!isPlainObject(next)) return;
    current = next;
  }
  delete current[keys[keys.length - 1]];
}

function stripEmptySecrets(section: string, data: Record<string, unknown>) {
  const paths: string[] = [];
  if (section === "security") {
    paths.push("googleClientSecret", "facebookAppSecret");
  }
  if (section === "payment") {
    paths.push(
      "stripe.secretKey",
      "stripe.webhookSecret",
      "paypal.clientSecret",
      "razorpay.keySecret",
      "razorpay.webhookSecret",
      "paystack.secretKey",
    );
  }
  if (section === "email") {
    paths.push("smtp.password", "apiKey");
  }
  if (section === "storage") {
    paths.push("secretAccessKey");
  }
  if (section === "aiAuthoring") {
    paths.push("apiKey");
  }

  for (const path of paths) {
    const keys = path.split(".");
    let current: unknown = data;
    for (const key of keys) {
      if (!isPlainObject(current)) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (current === "") {
      deleteNestedKey(data, path);
    }
  }
}

function requireFiniteNumber(
  value: unknown,
  label: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new ValidationError(`${label} must be between ${min} and ${max}`);
  }
}

function validateOrderSettings(data: Record<string, unknown>) {
  if (Object.prototype.hasOwnProperty.call(data, "prefix")) {
    if (typeof data.prefix !== "string") {
      throw new ValidationError("Order prefix must be text");
    }
    const prefix = data.prefix.trim().toUpperCase();
    data.prefix = prefix;
    if (!ORDER_PREFIX_PATTERN.test(prefix)) {
      throw new ValidationError(
        "Order prefix must contain 2 to 10 uppercase letters or numbers",
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, "taxRate")) {
    // Tax is stored as a decimal fraction: 10% = 0.10.
    requireFiniteNumber(data.taxRate, "Tax rate", 0, 1);
  }
  if (Object.prototype.hasOwnProperty.call(data, "defaultShippingCost")) {
    requireFiniteNumber(data.defaultShippingCost, "Default shipping cost", 0);
  }
  if (Object.prototype.hasOwnProperty.call(data, "freeShippingThreshold")) {
    requireFiniteNumber(data.freeShippingThreshold, "Free shipping threshold", 0);
  }

  if (Object.prototype.hasOwnProperty.call(data, "commission")) {
    if (!isPlainObject(data.commission)) {
      throw new ValidationError("Commission settings are invalid");
    }
    const allowedCommissionKeys = new Set(["vendorRate", "minWithdrawalAmount"]);
    for (const key of Object.keys(data.commission)) {
      if (!allowedCommissionKeys.has(key)) {
        throw new ValidationError(`Invalid commission setting: ${key}`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(data.commission, "vendorRate")) {
      requireFiniteNumber(data.commission.vendorRate, "Commission rate", 0, 100);
    }
    if (
      Object.prototype.hasOwnProperty.call(data.commission, "minWithdrawalAmount")
    ) {
      requireFiniteNumber(
        data.commission.minWithdrawalAmount,
        "Minimum withdrawal amount",
        0,
      );
    }
  }
}

function validateEmailSettings(data: Record<string, unknown>) {
  const enabled = data.enabled === true;
  const smtp = isPlainObject(data.smtp) ? data.smtp : {};
  const host = typeof smtp.host === "string" ? smtp.host.trim() : "";
  const user = typeof smtp.user === "string" ? smtp.user.trim() : "";
  const password = typeof smtp.password === "string" ? smtp.password : undefined;
  const port = Number(smtp.port);
  const fromEmail =
    typeof data.fromEmail === "string" ? data.fromEmail.trim() : "";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (enabled && !host) throw new ValidationError("SMTP host is required");
  if (host && (!/^[a-z0-9.-]+$/i.test(host) || host.includes(".."))) {
    throw new ValidationError("SMTP host is invalid");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError("SMTP port must be between 1 and 65535");
  }
  if (enabled && !user) throw new ValidationError("SMTP username is required");
  if (user && (/\s/.test(user) || user.length > 320)) {
    throw new ValidationError("SMTP username is invalid");
  }
  if (fromEmail && !emailPattern.test(fromEmail)) {
    throw new ValidationError("From email must be a valid email address");
  }
  if (password !== undefined && password.length > 0 && password.trim().length === 0) {
    throw new ValidationError("SMTP password cannot contain only spaces");
  }

  smtp.host = host;
  smtp.user = user;
  smtp.port = port;
  // Retained in storage for backwards compatibility; runtime TLS is port-derived.
  smtp.secure = port === 465;
  data.smtp = smtp;
  if (fromEmail) data.fromEmail = fromEmail;
}

function mergeContentPagesSettings(
  existing: unknown,
  patch: Record<string, unknown>,
) {
  const current = normalizeContentPagesSettings(existing);
  const next: Record<string, unknown> = { ...current };

  for (const key of CONTENT_PAGE_KEYS) {
    const value = patch[key];
    if (isPlainObject(value)) {
      next[key] = {
        ...(current[key] as unknown as Record<string, unknown>),
        ...value,
      };
    }
  }

  if (Array.isArray(patch.customPages)) {
    next.customPages = patch.customPages;
  }

  return normalizeContentPagesSettings(next);
}

/**
 * GET /api/admin/settings
 * Get all settings
 */
export const GET = withApi(
  { auth: "admin" },
  async () => {
    const settings = await getSettings();

    return successResponse(sanitizeSettings(settings));
  },
);

/**
 * PUT /api/admin/settings
 * Update settings by section
 */
export const PUT = withApi(
  { auth: "admin" },
  async ({ request, session }) => {
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    // Rate limiting - settings changes are sensitive
    rateLimitByUser(
      request,
      session.user.id,
      "admin:settings:update",
      "moderate",
      session.user.role
    );

    await connectDB();

    const body = (await request.json()) as unknown;
    if (!isPlainObject(body)) {
      throw new ValidationError("Invalid request body");
    }

    const { section, data } = body as {
      section?: unknown;
      data?: unknown;
    };

    if (section !== undefined && typeof section !== "string") {
      throw new ValidationError("Invalid section");
    }

    // Get existing settings
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    // Capture before state for audit logging
    const auditContext = createAuditContext(request, session);
    const beforeSettings = settings.toObject();

    // Update by section (sub-document approach)
    if (section && data !== undefined) {
      const validSections = [
        "general",
        "appearance",
        "payment",
        "email",
        "orders",
        "shipping",
        "seo",
        "social",
        "analytics",
        "maintenance",
        "security",
        "pos",
        "multiVendorMode",
        "notifications",
        "storage",
        "aiSalesAgent",
        "aiAuthoring",
        "header",
        "footer",
        "homePage",
        "contentPages",
      ];

      if (!validSections.includes(section)) {
        throw new ValidationError(`Invalid section: ${section}`);
      }

      validateSectionUpdate(section, data);
      const sectionData = data as Record<string, unknown>;
      if (section === "orders") validateOrderSettings(sectionData);
      if (section === "email") validateEmailSettings(sectionData);
      stripEmptySecrets(section, sectionData);
      if (section === "contentPages") {
        settings.set(
          "contentPages",
          mergeContentPagesSettings(settings.contentPages, sectionData),
        );
        settings.markModified("contentPages");
      } else if (section === "footer") {
        settings.set("footer", normalizeFooterSettings(sectionData));
        settings.markModified("footer");
      } else {
        const updates = flattenToDotPaths(section, sectionData);
        for (const [path, value] of Object.entries(updates)) {
          settings.set(path, value);
        }
      }
    } else if (data !== undefined) {
      if (!isPlainObject(data)) {
        throw new ValidationError("Invalid data payload");
      }

      // Update multiple sections at once
      for (const [key, value] of Object.entries(data)) {
        if (!(key in SECTION_ALLOWED_KEYS)) {
          throw new ValidationError(`Invalid section: ${key}`);
        }
        validateSectionUpdate(key, value);
        if (key === "orders" && isPlainObject(value)) {
          validateOrderSettings(value);
        }
        if (key === "email" && isPlainObject(value)) {
          validateEmailSettings(value);
        }
        if (isPlainObject(value)) {
          stripEmptySecrets(key, value);
        }
        if (key === "contentPages" && isPlainObject(value)) {
          settings.set(
            "contentPages",
            mergeContentPagesSettings(settings.contentPages, value),
          );
          settings.markModified("contentPages");
        } else if (key === "footer" && isPlainObject(value)) {
          settings.set("footer", normalizeFooterSettings(value));
          settings.markModified("footer");
        } else if (isPlainObject(value)) {
          const updates = flattenToDotPaths(key, value);
          for (const [path, v] of Object.entries(updates)) {
            settings.set(path, v);
          }
        } else {
          settings.set(key, value);
        }
      }
    }

    settings.updatedBy = session.user.id;
    const emailWasUpdated =
      section === "email" ||
      (!section &&
        isPlainObject(data) &&
        Object.prototype.hasOwnProperty.call(data, "email"));
    if (
      emailWasUpdated &&
      settings.email?.enabled &&
      settings.email?.provider === "smtp" &&
      !resolveSmtpConfig(settings)
    ) {
      throw new ValidationError(
        "SMTP username and password are required. Enter a password or configure SMTP_USER and SMTP_PASS.",
      );
    }
    const beforeSecurity = isPlainObject(
      (beforeSettings as unknown as Record<string, unknown>).security,
    )
      ? ((beforeSettings as unknown as Record<string, unknown>)
          .security as Record<string, unknown>)
      : {};
    const enabledVerificationNow =
      (!Boolean(beforeSecurity.emailVerificationRequired) &&
        Boolean(settings.security?.emailVerificationRequired)) ||
      (!Boolean(beforeSecurity.emailVerificationForVendors) &&
        Boolean(settings.security?.emailVerificationForVendors));
    if (enabledVerificationNow) {
      if (!isCurrentSmtpConfigurationVerified(settings)) {
        throw new ValidationError(
          "Send a successful SMTP test email before enabling email verification.",
        );
      }
    }

    const beforeFingerprint = getSmtpConfigurationFingerprint(
      beforeSettings as unknown as typeof settings,
    );
    const currentFingerprint = getSmtpConfigurationFingerprint(settings);
    const smtpConfigurationChanged =
      emailWasUpdated && beforeFingerprint !== currentFingerprint;
    if (
      smtpConfigurationChanged &&
      (settings.security?.emailVerificationRequired ||
        settings.security?.emailVerificationForVendors)
    ) {
      throw new ValidationError(
        "Disable email verification before changing SMTP settings, then send a new successful test email.",
      );
    }
    if (smtpConfigurationChanged) {
      settings.set("security.smtpVerifiedAt", undefined);
      settings.set("security.smtpVerificationFingerprint", undefined);
    }

    const now = new Date();
    if (
      !Boolean(beforeSecurity.emailVerificationRequired) &&
      settings.security?.emailVerificationRequired
    ) {
      settings.set("security.emailVerificationRequiredSince", now);
    } else if (
      Boolean(beforeSecurity.emailVerificationRequired) &&
      !settings.security?.emailVerificationRequired
    ) {
      settings.set("security.emailVerificationRequiredSince", undefined);
    }
    if (
      !Boolean(beforeSecurity.emailVerificationForVendors) &&
      settings.security?.emailVerificationForVendors
    ) {
      settings.set("security.emailVerificationForVendorsSince", now);
    } else if (
      Boolean(beforeSecurity.emailVerificationForVendors) &&
      !settings.security?.emailVerificationForVendors
    ) {
      settings.set("security.emailVerificationForVendorsSince", undefined);
    }
    await settings.save();

    if (emailWasUpdated) {
      const beforeEmail = isPlainObject(
        (beforeSettings as unknown as Record<string, unknown>).email,
      )
        ? ((beforeSettings as unknown as Record<string, unknown>)
            .email as Record<string, unknown>)
        : {};
      const previousRetention = Number(beforeEmail.logRetentionDays || 30);
      const nextRetention = settings.email?.logRetentionDays ?? 30;
      if (previousRetention !== nextRetention) {
        await EmailDelivery.updateMany(
          { status: "sent" },
          {
            $set: {
              expiresAt: new Date(
                Date.now() + nextRetention * 24 * 60 * 60 * 1000,
              ),
            },
            $unset: { html: 1, text: 1, attachments: 1 },
          },
        );
      }
    }

    const shouldClearStorageCache =
      section === "storage" ||
      (!section &&
        isPlainObject(data) &&
        Object.prototype.hasOwnProperty.call(data, "storage"));
    if (shouldClearStorageCache) {
      clearStorageConfigCache();
    }

    const shouldSyncDefaultVendor =
      section === "general" ||
      section === "multiVendorMode" ||
      (!section &&
        isPlainObject(data) &&
        (Object.prototype.hasOwnProperty.call(data, "general") ||
          Object.prototype.hasOwnProperty.call(data, "multiVendorMode")));

    if (shouldSyncDefaultVendor) {
      const { syncDefaultVendorWithSettings } = await import("@/lib/multi-vendor");
      await syncDefaultVendorWithSettings(session.user.id, settings);
      revalidateProductContent();
    }

    revalidateSettingsContent();

    // Audit log the settings change
    const sectionToAudit = section || "multiple";
    const beforeObj = beforeSettings as unknown as Record<string, unknown>;
    const afterObj = settings.toObject() as unknown as Record<string, unknown>;
    const beforeSection = section
      ? toPlainRecord(beforeObj[section])
      : beforeObj;
    const afterSection = section ? toPlainRecord(afterObj[section]) : afterObj;
    await auditSettingsChange(
      auditContext,
      sectionToAudit,
      beforeSection,
      afterSection,
    );

    // Handle multi-vendor toggle migration
    if (section === "multiVendorMode") {
      const beforeMV = (beforeSettings as unknown as Record<string, unknown>).multiVendorMode as
        | Record<string, unknown>
        | undefined;
      const wasPreviouslyEnabled = Boolean(beforeMV?.enabled);
      const isNowEnabled = Boolean(settings.multiVendorMode?.enabled);

      if (wasPreviouslyEnabled && !isNowEnabled) {
        const { migrateToSingleVendor } = await import("@/lib/multi-vendor");
        await migrateToSingleVendor(session.user.id);
      }
    }

    const shouldReloadAuth =
      section === "security" ||
      emailWasUpdated ||
      (isPlainObject(data) &&
        Object.prototype.hasOwnProperty.call(data, "security"));
    if (shouldReloadAuth) {
      setRateLimitSettingsFromSecurity(settings.security);
      await reloadAuthInstance();
    }

    return successResponse(
      sanitizeSettings(settings),
      "Settings updated successfully",
    );
  },
);
