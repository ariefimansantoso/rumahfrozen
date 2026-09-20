/**
 * Settings Model - Redesigned
 * Industry-standard architecture with proper sub-document organization
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import {
  getDefaultContentPagesSettings,
  type ContentPagesSettings,
} from "@/lib/content-pages-config";
import {
  getDefaultHomePageSettings,
  type HomePageSettings,
} from "@/lib/home-page-config";
import {
  getDefaultHeaderSettings,
  type HeaderSettings,
} from "@/lib/header-config";
import {
  getDefaultFooterSettings,
  type FooterSettings,
} from "@/lib/footer-config";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CURRENCY,
  DEFAULT_FAVICON_URL,
  DEFAULT_LANGUAGE,
  DEFAULT_PRESET_COLOR,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  DEFAULT_STORE_NAME,
  DEFAULT_TIMEZONE,
} from "@/config/branding.config";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from "@/lib/notification-settings";
import {
  DEFAULT_MIN_WITHDRAWAL_AMOUNT,
  DEFAULT_ORDER_PREFIX,
  DEFAULT_ORDER_SHIPPING_COST,
  DEFAULT_ORDER_TAX_RATE,
  DEFAULT_VENDOR_COMMISSION_RATE,
  ORDER_PREFIX_PATTERN,
} from "@/lib/order-settings";

// ============================================
// General Settings Sub-interface
// ============================================

export interface IGeneralSettings {
  storeName: string;
  storeDescription?: string;
  storeEmail: string;
  storePhone?: string;
  storeDomain?: string;
  storeAddress?: string;
  logoUrl?: string;
  darkModeLogoUrl?: string;
  faviconUrl?: string;
  defaultLanguage: string;
  defaultCurrency: string;
  supportedLanguages: string[];
  supportedCurrencies: string[];
  timezone: string;
}

// ============================================
// Appearance Settings Sub-interface
// ============================================

export interface IAppearanceSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  theme: "light" | "dark" | "system";
  contrast: boolean;
  rtl: boolean;
  collapsedSidebar: boolean;
  navLayout: "vertical" | "horizontal" | "mini";
  navColor: "integrate" | "apparent";
  presetColor: "default" | "cyan" | "purple" | "blue" | "orange" | "red";
  fontFamily?: string;
  borderRadius?: string;
}

// ============================================
// Payment Settings Sub-interfaces
// ============================================

export interface IStripeSettings {
  enabled: boolean;
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

export interface IPayPalSettings {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  mode: "sandbox" | "live";
  webhookId?: string;
}

export interface IRazorpaySettings {
  enabled: boolean;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

export interface IPaystackSettings {
  enabled: boolean;
  publicKey?: string;
  secretKey?: string;
}

export interface ICODSettings {
  enabled: boolean;
  instructions?: string;
  minOrderAmount?: number;
  maxOrderAmount?: number;
}

export interface IPaymentSettings {
  stripe: IStripeSettings;
  paypal: IPayPalSettings;
  razorpay: IRazorpaySettings;
  paystack: IPaystackSettings;
  cod: ICODSettings;
}

// ============================================
// Email Settings Sub-interface
// ============================================

export interface ISMTPSettings {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  secure: boolean;
}

export interface IEmailSettings {
  provider: "smtp" | "sendgrid" | "ses" | "mailgun";
  enabled: boolean;
  smtp: ISMTPSettings;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  apiKey?: string; // For SendGrid, SES, Mailgun
  logRetentionDays?: 7 | 30 | 90;
}

// ============================================
// Order Settings Sub-interface
// ============================================

export interface ICommissionSettings {
  vendorRate: number; // Percentage
  minWithdrawalAmount: number;
}

export interface IOrderSettings {
  prefix: string;
  taxRate: number;
  freeShippingThreshold?: number;
  defaultShippingCost: number;
  commission: ICommissionSettings;
}

export type ShippingRateType =
  | "flat"
  | "free_over"
  | "subtotal_range"
  | "weight_range";

export type ShippingWeightUnit = "kg" | "lb";

export type ShippingDutyMode = "DDP" | "DDU";

export interface IShippingOrigin {
  country: string;
  state?: string;
  city?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
}

export interface IShippingDeliveryDefaults {
  processingDaysMin: number;
  processingDaysMax: number;
  showEstimatedDelivery: boolean;
}

export interface IShippingRate {
  id: string;
  name: string;
  type: ShippingRateType;
  price: number;
  freeOver?: number;
  minSubtotal?: number;
  maxSubtotal?: number;
  minWeight?: number;
  maxWeight?: number;
  pricePerWeightUnit?: number;
  minDays?: number;
  maxDays?: number;
  active: boolean;
}

export interface IShippingZone {
  id: string;
  name: string;
  countries: string[];
  regions?: string[];
  rates: IShippingRate[];
}

export interface ILocalPickupSettings {
  enabled: boolean;
  pickupAddress?: string;
  instructions?: string;
  readyInDaysMin?: number;
  readyInDaysMax?: number;
}

export interface IFallbackShippingRate {
  enabled: boolean;
  name: string;
  price: number;
  minDays?: number;
  maxDays?: number;
}

export interface ICustomsSettings {
  enabled: boolean;
  dutyMode: ShippingDutyMode;
  dutyRatePercent?: number;
  deMinimis?: number;
}

export interface IVendorShippingSettings {
  enabled: boolean;
}

export interface IShippingSettings {
  enabled: boolean;
  weightUnit?: ShippingWeightUnit;
  origin?: IShippingOrigin;
  delivery?: IShippingDeliveryDefaults;
  zones: IShippingZone[];
  fallbackRate?: IFallbackShippingRate;
  localPickup?: ILocalPickupSettings;
  customs?: ICustomsSettings;
  vendorShipping?: IVendorShippingSettings;
}

// ============================================
// SEO Settings Sub-interface
// ============================================

export interface ISEOSettings {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImage?: string;
  robotsTxt?: string;
}

// ============================================
// Social Settings Sub-interface
// ============================================

export interface ICustomShareButton {
  id: string;
  label: string;
  urlTemplate: string;
  enabled: boolean;
  /** Optional uploaded icon URL shown on the storefront share button. */
  icon?: string;
}

export interface ISocialShareSettings {
  enabled: boolean;
  copyLink: boolean;
  facebook: boolean;
  twitter: boolean;
  whatsapp: boolean;
  telegram: boolean;
  pinterest: boolean;
  linkedin: boolean;
  email: boolean;
  custom: ICustomShareButton[];
}

export interface ISocialSettings {
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  tiktokUrl?: string;
  share?: ISocialShareSettings;
}

// ============================================
// Analytics Settings Sub-interface
// ============================================

export interface IAnalyticsSettings {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  tiktokPixelId?: string;
  plausibleDomain?: string;
  plausibleApiKey?: string;
  plausibleSelfHosted?: boolean;
  plausibleBaseUrl?: string;
}

// ============================================
// Maintenance Settings Sub-interface
// ============================================

export interface IMaintenanceSettings {
  enabled: boolean;
  title?: string;
  message?: string;
  backgroundImageUrl?: string;
  countdownEnabled?: boolean;
  countdownEndsAt?: string;
  allowedIPs?: string[];
}

// ============================================
// Security Settings Sub-interface
// ============================================

export type RateLimitPresetSetting = "default" | "lenient" | "moderate" | "strict";

export interface IRateLimitingSettings {
  enabled: boolean;
  ipPreset: RateLimitPresetSetting;
  adminPreset: RateLimitPresetSetting;
  vendorPreset: RateLimitPresetSetting;
  checkoutPreset: RateLimitPresetSetting;
  cartPreset: RateLimitPresetSetting;
  couponPreset: RateLimitPresetSetting;
  authPreset: RateLimitPresetSetting;
}

export interface ISecuritySettings {
  // Email Verification
  emailVerificationRequired: boolean;
  emailVerificationForVendors: boolean;
  emailVerificationRequiredSince?: Date;
  emailVerificationForVendorsSince?: Date;
  smtpVerifiedAt?: Date;
  smtpVerificationFingerprint?: string;

  // Two-Factor Authentication
  twoFactorEnabled: boolean;
  twoFactorRequiredForAdmin: boolean;
  twoFactorRequiredForVendors: boolean;
  twoFactorRequiredForStaff: boolean;

  // OAuth Providers
  googleOAuthEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  facebookOAuthEnabled: boolean;
  facebookAppId?: string;
  facebookAppSecret?: string;

  // Session Security
  sessionMaxAgeDays: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;

  // Rate Limiting
  rateLimiting?: IRateLimitingSettings;

  // Password Policy
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

// ============================================
// POS Settings Sub-interface
// ============================================

export interface IPOSCustomizeSettings {
  smartGridEnabled: boolean;
  lockScreenTimeoutMinutes: number;
  printedReceiptsEnabled: boolean;
  receiptPrinter?: string;
  customerDisplayEnabled: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  soundAddToCart: boolean;
  soundOrderComplete: boolean;
  soundPayment: boolean;
  soundError: boolean;
}

export type POSPaymentMethod = "cash" | "card" | "manual";

export interface IPOSCheckoutSettings {
  paymentMethods: POSPaymentMethod[];
  customerReceiptSelectionEnabled: boolean;
  offlinePaymentsEnabled: boolean;
}

export interface IPOSReturnRulesSettings {
  enabled: boolean;
  windowDays: number;
  allowWithoutReceipt: boolean;
  conditionNotes?: string;
}

export interface IPOSOrdersSettings {
  orderNumberPrefix: string;
  returnRules: IPOSReturnRulesSettings;
}

export interface IPOSSettings {
  enabled: boolean;
  allowAdminSales: boolean;
  allowVendorSales: boolean;
  allowSellerSales: boolean;
  language?: string;
  defaultPosLocationId?: string;
  customize: IPOSCustomizeSettings;
  checkout: IPOSCheckoutSettings;
  orders: IPOSOrdersSettings;
}

export interface IMultiVendorModeSettings {
  enabled: boolean;
  canManageProducts: boolean;
  canViewOrders: boolean;
  canManageOrders: boolean;
  canManageStoreSettings: boolean;
  canViewAnalytics: boolean;
  canManageDiscounts: boolean;
  canManagePayouts: boolean;
  canAccessPOS: boolean;
}
// ============================================
// Vendor Permissions Sub-interface
// ============================================

export interface IVendorPermissionSettings {
  canManageProducts: boolean;
  canViewOrders: boolean;
  canManageOrders: boolean;
  canManageStoreSettings: boolean;
  canViewAnalytics: boolean;
  canManageDiscounts: boolean;
  canManagePayouts: boolean;
  canAccessPOS: boolean;
}

// ============================================
// Storage Settings Sub-interface
// ============================================

export interface IStorageSettings {
  provider: "cloudflare_r2" | "s3" | "local";
  accountId?: string; // R2 Account ID
  endpoint?: string;
  region?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  maxFileSizeMB: number;
  // Per-media-type limits, Shopify-style. Server picks the type-specific
  // limit when present; falls back to maxFileSizeMB for unknown types.
  maxImageSizeMB?: number;
  maxVideoSizeMB?: number;
  maxModelSizeMB?: number;
  allowedMimeTypes: string[];
  pathPrefix?: string;
}

import type {
  AISalesAgentModel,
  AISalesAgentReasoningEffort,
  AISalesAgentTone,
} from "@/lib/ai-sales-agent/models";

export type { AISalesAgentModel, AISalesAgentReasoningEffort, AISalesAgentTone };

export interface IAISalesAgentCapabilities {
  productQA: boolean;
  recommendations: boolean;
  cartActions: boolean;
  checkoutHandoff: boolean;
  orderStatus: boolean;
}

export interface IAISalesAgentWidgetSettings {
  position: "bottom-right" | "bottom-left";
  primaryColor: string;
  accentColor: string;
  avatarUrl?: string;
  footerText?: string;
  headerTitle?: string;
  width: number;
  height: number;
  showFooterText: boolean;
}

export interface IAISalesAgentFaqEntry {
  question: string;
  answer: string;
  tags?: string[];
}

export interface IAISalesAgentSettings {
  enabled: boolean;
  model: AISalesAgentModel;
  temperature: number;
  reasoningEffort: AISalesAgentReasoningEffort;
  maxRecommendations: number;
  agentName: string;
  greeting: string;
  tone: AISalesAgentTone;
  instructions?: string;
  escalationMessage: string;
  widget: IAISalesAgentWidgetSettings;
  capabilities: IAISalesAgentCapabilities;
  faq: IAISalesAgentFaqEntry[];
}

export interface IAIAuthoringSurfaces {
  products: boolean;
  categories: boolean;
  collections: boolean;
  brands: boolean;
  blogPosts: boolean;
  contentPages: boolean;
  reviews: boolean;
  heroBanner: boolean;
}

export interface IAIAuthoringSettings {
  enabled: boolean;
  /** Shared OpenAI key for all AI features; OPENAI_API_KEY is the env fallback. */
  apiKey?: string;
  /** Empty string = inherit OPENAI_AUTHORING_TEXT_MODEL env or the built-in default. */
  textModel: string;
  /** Empty string = inherit OPENAI_AUTHORING_IMAGE_MODEL env or the built-in default. */
  imageModel: string;
  surfaces: IAIAuthoringSurfaces;
  imageDefaults: {
    size: "auto" | "1024x1024" | "1024x1536" | "1536x1024";
    quality: "auto" | "medium" | "high";
  };
  brandVoice: {
    /** Empty string = no default tone. */
    tone: string;
    instructions: string;
    /** Style guidance appended to every image generation prompt. */
    imageStyle: string;
  };
  /** Brand kit — colors and logo used by image generation and social export. */
  brandKit: {
    /** Hex color, "" = none. Hints generation and sets the export pad color. */
    primaryColor: string;
    secondaryColor: string;
    /** Own-storage logo URL, "" = none. Optional lockup on social exports. */
    logoUrl: string;
  };
  access: {
    staffEnabled: boolean;
    vendorsEnabled: boolean;
  };
  limits: {
    /** 0 = unlimited. */
    textPerUserPerDay: number;
    imagePerUserPerDay: number;
  };
}

export type IHomePageSettings = HomePageSettings;
export type IContentPagesSettings = ContentPagesSettings;
export type INotificationSettings = NotificationSettings;
export type IHeaderSettings = HeaderSettings;
export type IFooterSettings = FooterSettings;

// ============================================
// Main Settings Interface
// ============================================

export interface ISettings extends Document {
  // Grouped Sub-documents
  general: IGeneralSettings;
  appearance: IAppearanceSettings;
  payment: IPaymentSettings;
  email: IEmailSettings;
  orders: IOrderSettings;
  shipping: IShippingSettings;
  seo: ISEOSettings;
  social: ISocialSettings;
  analytics: IAnalyticsSettings;
  maintenance: IMaintenanceSettings;
  security: ISecuritySettings;
  pos: IPOSSettings;
  multiVendorMode: IMultiVendorModeSettings;
  notifications: INotificationSettings;
  storage: IStorageSettings;
  aiSalesAgent: IAISalesAgentSettings;
  aiAuthoring: IAIAuthoringSettings;
  header: IHeaderSettings;
  footer: IFooterSettings;
  homePage: IHomePageSettings;
  contentPages: IContentPagesSettings;

  // Metadata
  updatedAt: Date;
  updatedBy?: string;
}

// ============================================
// Mongoose Schema
// ============================================

const SettingsSchema = new Schema<ISettings>(
  {
    // General Settings
    general: {
      type: new Schema(
        {
          storeName: {
            type: String,
            required: true,
            default: DEFAULT_STORE_NAME,
          },
          storeDescription: String,
          storeEmail: {
            type: String,
            required: true,
            default: "store@example.com",
          },
          storePhone: String,
          storeDomain: String,
          storeAddress: String,
          logoUrl: String,
          darkModeLogoUrl: String,
          faviconUrl: { type: String, default: DEFAULT_FAVICON_URL },
          defaultLanguage: { type: String, default: DEFAULT_LANGUAGE },
          defaultCurrency: { type: String, default: DEFAULT_CURRENCY },
          supportedLanguages: {
            type: [String],
            default: ["en", "bn", "ar", "hi", "zh", "ja", "ko", "fr", "es"],
          },
          supportedCurrencies: {
            type: [String],
            default: ["USD", "EUR", "GBP", "BDT", "INR"],
          },
          timezone: { type: String, default: DEFAULT_TIMEZONE },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Appearance Settings
    appearance: {
      type: new Schema(
        {
          primaryColor: { type: String, default: DEFAULT_PRIMARY_COLOR },
          secondaryColor: { type: String, default: DEFAULT_SECONDARY_COLOR },
          accentColor: { type: String, default: DEFAULT_ACCENT_COLOR },
          theme: {
            type: String,
            enum: ["light", "dark", "system"],
            default: "system",
          },
          contrast: { type: Boolean, default: false },
          rtl: { type: Boolean, default: false },
          collapsedSidebar: { type: Boolean, default: false },
          navLayout: {
            type: String,
            enum: ["vertical", "horizontal", "mini"],
            default: "mini",
          },
          navColor: {
            type: String,
            enum: ["integrate", "apparent"],
            default: "integrate",
          },
          presetColor: {
            type: String,
            enum: ["default", "cyan", "purple", "blue", "orange", "red"],
            default: DEFAULT_PRESET_COLOR,
          },
          fontFamily: String,
          borderRadius: String,
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Payment Settings
    payment: {
      type: new Schema(
        {
          stripe: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
                publishableKey: String,
                secretKey: String,
                webhookSecret: String,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          paypal: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
                clientId: String,
                clientSecret: String,
                mode: {
                  type: String,
                  enum: ["sandbox", "live"],
                  default: "sandbox",
                },
                webhookId: String,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          razorpay: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
                keyId: String,
                keySecret: String,
                webhookSecret: String,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          paystack: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
                publicKey: String,
                secretKey: String,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          cod: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: true },
                instructions: String,
                minOrderAmount: Number,
                maxOrderAmount: Number,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Email Settings
    email: {
      type: new Schema(
        {
          provider: {
            type: String,
            enum: ["smtp", "sendgrid", "ses", "mailgun"],
            default: "smtp",
          },
          enabled: { type: Boolean, default: false },
          smtp: {
            type: new Schema(
              {
                host: String,
                port: { type: Number, default: 587 },
                user: String,
                password: String,
                secure: { type: Boolean, default: false },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          fromEmail: String,
          fromName: String,
          replyTo: String,
          apiKey: String,
          logRetentionDays: {
            type: Number,
            enum: [7, 30, 90],
            default: 30,
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Order Settings
    orders: {
      type: new Schema(
        {
          prefix: {
            type: String,
            default: DEFAULT_ORDER_PREFIX,
            trim: true,
            uppercase: true,
            match: ORDER_PREFIX_PATTERN,
          },
          taxRate: {
            type: Number,
            default: DEFAULT_ORDER_TAX_RATE,
            min: 0,
            max: 1,
          },
          freeShippingThreshold: { type: Number, default: 0, min: 0 },
          defaultShippingCost: {
            type: Number,
            default: DEFAULT_ORDER_SHIPPING_COST,
            min: 0,
          },
          commission: {
            type: new Schema(
              {
                vendorRate: {
                  type: Number,
                  default: DEFAULT_VENDOR_COMMISSION_RATE,
                  min: 0,
                  max: 100,
                },
                minWithdrawalAmount: {
                  type: Number,
                  default: DEFAULT_MIN_WITHDRAWAL_AMOUNT,
                  min: 0,
                },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    shipping: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          weightUnit: {
            type: String,
            enum: ["kg", "lb"],
            default: "kg",
          },
          origin: {
            type: new Schema(
              {
                country: { type: String, default: "" },
                state: String,
                city: String,
                postalCode: String,
                address1: String,
                address2: String,
              },
              { _id: false },
            ),
            default: undefined,
          },
          delivery: {
            type: new Schema(
              {
                processingDaysMin: { type: Number, default: 0 },
                processingDaysMax: { type: Number, default: 0 },
                showEstimatedDelivery: { type: Boolean, default: true },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          zones: {
            type: [
              new Schema(
                {
                  id: { type: String, required: true },
                  name: { type: String, required: true },
                  countries: { type: [String], default: [] },
                  regions: { type: [String], default: [] },
                  rates: {
                    type: [
                      new Schema(
                        {
                          id: { type: String, required: true },
                          name: { type: String, required: true },
                          type: {
                            type: String,
                            enum: [
                              "flat",
                              "free_over",
                              "subtotal_range",
                              "weight_range",
                            ],
                            default: "flat",
                          },
                          price: { type: Number, default: 0 },
                          freeOver: Number,
                          minSubtotal: Number,
                          maxSubtotal: Number,
                          minWeight: Number,
                          maxWeight: Number,
                          pricePerWeightUnit: Number,
                          minDays: Number,
                          maxDays: Number,
                          active: { type: Boolean, default: true },
                        },
                        { _id: false },
                      ),
                    ],
                    default: [],
                  },
                },
                { _id: false },
              ),
            ],
            default: [],
          },
          fallbackRate: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
                name: { type: String, default: "Standard" },
                price: { type: Number, default: 0 },
                minDays: Number,
                maxDays: Number,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          localPickup: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
                pickupAddress: String,
                instructions: String,
                readyInDaysMin: Number,
                readyInDaysMax: Number,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          customs: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
                dutyMode: {
                  type: String,
                  enum: ["DDP", "DDU"],
                  default: "DDU",
                },
                dutyRatePercent: Number,
                deMinimis: Number,
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          vendorShipping: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: false },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // SEO Settings
    seo: {
      type: new Schema(
        {
          metaTitle: String,
          metaDescription: String,
          metaKeywords: String,
          ogImage: String,
          robotsTxt: String,
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Social Settings
    social: {
      type: new Schema(
        {
          facebookUrl: String,
          twitterUrl: String,
          instagramUrl: String,
          youtubeUrl: String,
          linkedinUrl: String,
          tiktokUrl: String,
          share: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: true },
                copyLink: { type: Boolean, default: true },
                facebook: { type: Boolean, default: true },
                twitter: { type: Boolean, default: true },
                whatsapp: { type: Boolean, default: true },
                telegram: { type: Boolean, default: false },
                pinterest: { type: Boolean, default: false },
                linkedin: { type: Boolean, default: false },
                email: { type: Boolean, default: true },
                custom: {
                  type: [
                    new Schema(
                      {
                        id: String,
                        label: String,
                        urlTemplate: String,
                        enabled: { type: Boolean, default: true },
                        icon: String,
                      },
                      { _id: false },
                    ),
                  ],
                  default: [],
                },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Analytics Settings
    analytics: {
      type: new Schema(
        {
          googleAnalyticsId: String,
          googleTagManagerId: String,
          facebookPixelId: String,
          tiktokPixelId: String,
          plausibleDomain: String,
          plausibleApiKey: String,
          plausibleSelfHosted: { type: Boolean, default: false },
          plausibleBaseUrl: String,
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Maintenance Settings
    maintenance: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          title: {
            type: String,
            default: `${DEFAULT_STORE_NAME} is temporarily offline`,
          },
          message: {
            type: String,
            default:
              "We're making a few improvements behind the scenes. Thanks for your patience.",
          },
          backgroundImageUrl: String,
          countdownEnabled: { type: Boolean, default: false },
          countdownEndsAt: String,
          allowedIPs: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Security Settings
    security: {
      type: new Schema(
        {
          emailVerificationRequired: { type: Boolean, default: false },
          emailVerificationForVendors: { type: Boolean, default: false },
          emailVerificationRequiredSince: Date,
          emailVerificationForVendorsSince: Date,
          smtpVerifiedAt: Date,
          smtpVerificationFingerprint: String,
          twoFactorEnabled: { type: Boolean, default: false },
          twoFactorRequiredForAdmin: { type: Boolean, default: false },
          twoFactorRequiredForVendors: { type: Boolean, default: false },
          twoFactorRequiredForStaff: { type: Boolean, default: false },
          googleOAuthEnabled: { type: Boolean, default: false },
          googleClientId: String,
          googleClientSecret: String,
          facebookOAuthEnabled: { type: Boolean, default: false },
          facebookAppId: String,
          facebookAppSecret: String,
          sessionMaxAgeDays: { type: Number, default: 7 },
          maxLoginAttempts: { type: Number, default: 5 },
          lockoutDurationMinutes: { type: Number, default: 15 },
          rateLimiting: {
            type: new Schema(
              {
                enabled: { type: Boolean, default: true },
                ipPreset: {
                  type: String,
                  enum: ["default", "lenient", "moderate", "strict"],
                  default: "default",
                },
                adminPreset: {
                  type: String,
                  enum: ["default", "lenient", "moderate", "strict"],
                  default: "default",
                },
                vendorPreset: {
                  type: String,
                  enum: ["default", "lenient", "moderate", "strict"],
                  default: "default",
                },
                checkoutPreset: {
                  type: String,
                  enum: ["default", "lenient", "moderate", "strict"],
                  default: "default",
                },
                cartPreset: {
                  type: String,
                  enum: ["default", "lenient", "moderate", "strict"],
                  default: "default",
                },
                couponPreset: {
                  type: String,
                  enum: ["default", "lenient", "moderate", "strict"],
                  default: "default",
                },
                authPreset: {
                  type: String,
                  enum: ["default", "lenient", "moderate", "strict"],
                  default: "default",
                },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          minPasswordLength: { type: Number, default: 8 },
          requireUppercase: { type: Boolean, default: false },
          requireNumbers: { type: Boolean, default: false },
          requireSpecialChars: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // POS Settings
    pos: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          allowAdminSales: { type: Boolean, default: true },
          allowVendorSales: { type: Boolean, default: true },
          allowSellerSales: { type: Boolean, default: true },
          language: { type: String, default: "en" },
          defaultPosLocationId: { type: String },
          customize: {
            type: new Schema(
              {
                smartGridEnabled: { type: Boolean, default: true },
                lockScreenTimeoutMinutes: { type: Number, default: 5 },
                printedReceiptsEnabled: { type: Boolean, default: false },
                receiptPrinter: { type: String },
                customerDisplayEnabled: { type: Boolean, default: false },
                soundEnabled: { type: Boolean, default: true },
                soundVolume: { type: Number, default: 50, min: 0, max: 100 },
                soundAddToCart: { type: Boolean, default: true },
                soundOrderComplete: { type: Boolean, default: true },
                soundPayment: { type: Boolean, default: true },
                soundError: { type: Boolean, default: true },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          checkout: {
            type: new Schema(
              {
                paymentMethods: {
                  type: [String],
                  enum: ["cash", "card", "manual", "bank"],
                  default: ["cash", "card"],
                },
                customerReceiptSelectionEnabled: {
                  type: Boolean,
                  default: false,
                },
                offlinePaymentsEnabled: { type: Boolean, default: false },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          orders: {
            type: new Schema(
              {
                orderNumberPrefix: { type: String, default: "POS" },
                returnRules: {
                  type: new Schema(
                    {
                      enabled: { type: Boolean, default: false },
                      windowDays: { type: Number, default: 30 },
                      allowWithoutReceipt: { type: Boolean, default: false },
                      conditionNotes: { type: String },
                    },
                    { _id: false },
                  ),
                  default: () => ({}),
                },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Multi-Vendor Mode
    multiVendorMode: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          canManageProducts: { type: Boolean, default: true },
          canViewOrders: { type: Boolean, default: true },
          canManageOrders: { type: Boolean, default: true },
          canManageStoreSettings: { type: Boolean, default: true },
          canViewAnalytics: { type: Boolean, default: true },
          canManageDiscounts: { type: Boolean, default: true },
          canManagePayouts: { type: Boolean, default: true },
          canAccessPOS: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Notification Settings
    notifications: {
      type: new Schema(
        {
          admin: {
            type: new Schema(
              {
                newOrders: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.admin.newOrders,
                },
                newCustomers: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.admin.newCustomers,
                },
                newVendors: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: true },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.admin.newVendors,
                },
                returns: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: true },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.admin.returns,
                },
                payments: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.admin.payments,
                },
              },
              { _id: false },
            ),
            default: () => DEFAULT_NOTIFICATION_SETTINGS.admin,
          },
          staff: {
            type: new Schema(
              {
                newOrders: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.staff.newOrders,
                },
                newCustomers: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.staff.newCustomers,
                },
                returns: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.staff.returns,
                },
                payments: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.staff.payments,
                },
                lowStock: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: false },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.staff.lowStock,
                },
              },
              { _id: false },
            ),
            default: () => DEFAULT_NOTIFICATION_SETTINGS.staff,
          },
          vendor: {
            type: new Schema(
              {
                applicationStatus: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: true },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () =>
                    DEFAULT_NOTIFICATION_SETTINGS.vendor.applicationStatus,
                },
                newOrders: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: true },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.vendor.newOrders,
                },
                returns: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: true },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () => DEFAULT_NOTIFICATION_SETTINGS.vendor.returns,
                },
              },
              { _id: false },
            ),
            default: () => DEFAULT_NOTIFICATION_SETTINGS.vendor,
          },
          customer: {
            type: new Schema(
              {
                orderUpdates: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: true },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () =>
                    DEFAULT_NOTIFICATION_SETTINGS.customer.orderUpdates,
                },
                returnUpdates: {
                  type: new Schema(
                    {
                      inApp: { type: Boolean, default: true },
                      email: { type: Boolean, default: true },
                      browserPush: { type: Boolean, default: true },
                    },
                    { _id: false },
                  ),
                  default: () =>
                    DEFAULT_NOTIFICATION_SETTINGS.customer.returnUpdates,
                },
              },
              { _id: false },
            ),
            default: () => DEFAULT_NOTIFICATION_SETTINGS.customer,
          },
        },
        { _id: false },
      ),
      default: () => DEFAULT_NOTIFICATION_SETTINGS,
    },

    // Storage Settings
    storage: {
      type: new Schema(
        {
          provider: {
            type: String,
            enum: ["cloudflare_r2", "s3", "local"],
            default: "cloudflare_r2",
          },
          accountId: String,
          endpoint: String,
          region: { type: String, default: "auto" },
          bucketName: String,
          accessKeyId: String,
          secretAccessKey: String,
          publicUrl: String,
          maxFileSizeMB: { type: Number, default: 20 },
          maxImageSizeMB: { type: Number, default: 20 },
          maxVideoSizeMB: { type: Number, default: 1024 },
          maxModelSizeMB: { type: Number, default: 500 },
          allowedMimeTypes: {
            type: [String],
            default: [
              // Images
              "image/jpeg",
              "image/jpg",
              "image/png",
              "image/gif",
              "image/webp",
              "image/svg+xml",
              "image/avif",
              "image/heic",
              "image/heif",
              "image/bmp",
              "image/tiff",
              "image/x-icon",
              // Videos
              "video/mp4",
              "video/webm",
              "video/ogg",
              "video/quicktime",
              // 3D Models
              "model/gltf-binary",
              "model/gltf+json",
              "application/octet-stream",
              // Documents
              "application/pdf",
            ],
          },
          pathPrefix: { type: String, default: "uploads/" },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    aiSalesAgent: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          model: {
            type: String,
            enum: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1-mini"],
            default: "gpt-5-mini",
          },
          temperature: { type: Number, default: 0.3, min: 0, max: 1 },
          reasoningEffort: {
            type: String,
            enum: ["minimal", "low", "medium", "high"],
            default: "minimal",
          },
          maxRecommendations: { type: Number, default: 4, min: 1, max: 8 },
          agentName: { type: String, default: "Sales AI" },
          greeting: {
            type: String,
            default: "Hi! I can help you find products, compare options, add items to your cart, and check order status.",
          },
          tone: {
            type: String,
            enum: ["friendly", "professional", "playful", "luxury"],
            default: "friendly",
          },
          instructions: { type: String, default: "" },
          escalationMessage: {
            type: String,
            default:
              "I can connect you with the store team for anything that needs a human review.",
          },
          widget: {
            type: new Schema(
              {
                position: {
                  type: String,
                  enum: ["bottom-right", "bottom-left"],
                  default: "bottom-right",
                },
                primaryColor: { type: String, default: "#7c3aed" },
                accentColor: { type: String, default: "#a855f7" },
                avatarUrl: String,
                footerText: { type: String, default: "Powered by AI" },
                headerTitle: { type: String, default: "" },
                width: { type: Number, default: 400, min: 320, max: 640 },
                height: { type: Number, default: 680, min: 420, max: 900 },
                showFooterText: { type: Boolean, default: true },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          capabilities: {
            type: new Schema(
              {
                productQA: { type: Boolean, default: true },
                recommendations: { type: Boolean, default: true },
                cartActions: { type: Boolean, default: true },
                checkoutHandoff: { type: Boolean, default: true },
                orderStatus: { type: Boolean, default: true },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          faq: {
            type: [
              new Schema(
                {
                  question: { type: String, default: "" },
                  answer: { type: String, default: "" },
                  tags: { type: [String], default: [] },
                },
                { _id: false },
              ),
            ],
            default: () => [],
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    aiAuthoring: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: true },
          apiKey: String,
          textModel: {
            type: String,
            enum: ["", "gpt-4.1-mini", "gpt-4.1", "gpt-5-mini", "gpt-5"],
            default: "",
          },
          imageModel: {
            type: String,
            enum: ["", "gpt-image-1", "gpt-image-1-mini"],
            default: "",
          },
          surfaces: {
            type: new Schema(
              {
                products: { type: Boolean, default: true },
                categories: { type: Boolean, default: true },
                collections: { type: Boolean, default: true },
                brands: { type: Boolean, default: true },
                blogPosts: { type: Boolean, default: true },
                contentPages: { type: Boolean, default: true },
                reviews: { type: Boolean, default: true },
                heroBanner: { type: Boolean, default: true },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          imageDefaults: {
            type: new Schema(
              {
                size: {
                  type: String,
                  enum: ["auto", "1024x1024", "1024x1536", "1536x1024"],
                  default: "auto",
                },
                quality: {
                  type: String,
                  enum: ["auto", "medium", "high"],
                  default: "high",
                },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          brandVoice: {
            type: new Schema(
              {
                tone: {
                  type: String,
                  enum: [
                    "",
                    "friendly",
                    "professional",
                    "luxury",
                    "playful",
                    "supportive",
                  ],
                  default: "",
                },
                instructions: { type: String, default: "", maxlength: 2000 },
                imageStyle: { type: String, default: "", maxlength: 1000 },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          brandKit: {
            type: new Schema(
              {
                primaryColor: { type: String, default: "", maxlength: 9 },
                secondaryColor: { type: String, default: "", maxlength: 9 },
                logoUrl: { type: String, default: "", maxlength: 2048 },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          access: {
            type: new Schema(
              {
                staffEnabled: { type: Boolean, default: true },
                vendorsEnabled: { type: Boolean, default: true },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
          limits: {
            type: new Schema(
              {
                textPerUserPerDay: {
                  type: Number,
                  default: 0,
                  min: 0,
                  max: 100000,
                },
                imagePerUserPerDay: {
                  type: Number,
                  default: 0,
                  min: 0,
                  max: 100000,
                },
              },
              { _id: false },
            ),
            default: () => ({}),
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Storefront Header Settings
    header: {
      type: Schema.Types.Mixed,
      default: () => getDefaultHeaderSettings(),
    },

    footer: {
      type: Schema.Types.Mixed,
      default: () => getDefaultFooterSettings(),
    },

    // Home Page Settings
    homePage: {
      type: Schema.Types.Mixed,
      default: () => getDefaultHomePageSettings(),
    },
    contentPages: {
      type: Schema.Types.Mixed,
      default: () => getDefaultContentPagesSettings(),
    },

    updatedBy: String,
  },
  {
    timestamps: true,
  },
);

// Delete cached model in development so schema changes take effect on hot reload
if (process.env.NODE_ENV !== "production" && mongoose.models.Settings) {
  mongoose.deleteModel("Settings");
}

export const Settings: Model<ISettings> =
  mongoose.models.Settings ||
  mongoose.model<ISettings>("Settings", SettingsSchema);

let hasCheckedSettingsMigration = false;

// Helper to get singleton settings
export async function getSettings(): Promise<ISettings> {
  if (!hasCheckedSettingsMigration) {
    hasCheckedSettingsMigration = true;
    await migrateSettings();
  }

  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}

// ============================================
// Migration Helper (for existing data)
// ============================================

export async function migrateSettings(): Promise<void> {
  const settings = await Settings.findOne();
  if (!settings) return;

  type LegacySettingsDoc = Record<string, unknown> & {
    general?: Record<string, unknown>;
    appearance?: Record<string, unknown>;
    payment?: {
      stripe?: Record<string, unknown>;
    };
    email?: Record<string, unknown>;
    orders?: Record<string, unknown>;
    seo?: Record<string, unknown>;
    social?: Record<string, unknown>;
    maintenance?: Record<string, unknown>;
    pos?: {
      language?: unknown;
      customize?: unknown;
      checkout?: unknown;
      orders?: {
        returnRules?: unknown;
      };
    };
  };

  // Check if migration is needed (old flat structure exists)
  const doc = settings.toObject() as unknown as LegacySettingsDoc;

  // Migration: old flat fields to new structure
  const updates: Record<string, unknown> = {};
  let needsMigration = false;

  // Migrate general fields
  if (doc.storeName && !doc.general?.storeName) {
    needsMigration = true;
    updates["general.storeName"] = doc.storeName;
    updates["general.storeEmail"] = doc.storeEmail;
    updates["general.storeDescription"] = doc.storeDescription;
    updates["general.storePhone"] = doc.storePhone;
    updates["general.storeAddress"] = doc.storeAddress;
    updates["general.logoUrl"] = doc.logoUrl;
    updates["general.faviconUrl"] = doc.faviconUrl;
    updates["general.defaultLanguage"] = doc.defaultLanguage;
    updates["general.defaultCurrency"] = doc.defaultCurrency;
    updates["general.supportedLanguages"] = doc.supportedLanguages;
    updates["general.supportedCurrencies"] = doc.supportedCurrencies;
    updates["general.multiVendorEnabled"] = doc.multiVendorEnabled;
  }

  const generalFaviconUrl =
    typeof doc.general?.faviconUrl === "string"
      ? doc.general.faviconUrl.trim()
      : "";
  if (!generalFaviconUrl) {
    needsMigration = true;
    updates["general.faviconUrl"] = DEFAULT_FAVICON_URL;
  }

  // Migrate appearance fields
  if (doc.primaryColor && !doc.appearance?.primaryColor) {
    needsMigration = true;
    updates["appearance.primaryColor"] = doc.primaryColor;
    updates["appearance.secondaryColor"] = doc.secondaryColor;
    updates["appearance.accentColor"] = doc.accentColor;
    updates["appearance.theme"] = doc.theme;
  }

  // Migrate payment fields
  if (doc.stripeEnabled !== undefined && !doc.payment?.stripe?.enabled) {
    needsMigration = true;
    updates["payment.stripe.enabled"] = doc.stripeEnabled;
    updates["payment.stripe.publishableKey"] = doc.stripePublishableKey;
    updates["payment.stripe.secretKey"] = doc.stripeSecretKey;
    updates["payment.stripe.webhookSecret"] = doc.stripeWebhookSecret;
    updates["payment.cod.enabled"] = doc.codEnabled;
    updates["payment.cod.instructions"] = doc.codInstructions;
  }

  // Migrate email fields
  if (doc.smtpEnabled !== undefined && !doc.email?.enabled) {
    needsMigration = true;
    updates["email.enabled"] = doc.smtpEnabled;
    updates["email.smtp.host"] = doc.smtpHost;
    updates["email.smtp.port"] = doc.smtpPort;
    updates["email.smtp.user"] = doc.smtpUser;
    updates["email.smtp.password"] = doc.smtpPassword;
    updates["email.smtp.secure"] = doc.smtpSecure;
    updates["email.fromEmail"] = doc.smtpFromEmail;
    updates["email.fromName"] = doc.smtpFromName;
  }

  // Migrate order fields
  if (doc.orderPrefix && !doc.orders?.prefix) {
    needsMigration = true;
    updates["orders.prefix"] = doc.orderPrefix;
    updates["orders.taxRate"] = doc.taxRate;
    updates["orders.freeShippingThreshold"] = doc.freeShippingThreshold;
    updates["orders.defaultShippingCost"] = doc.defaultShippingCost;
    updates["orders.commission.vendorRate"] = doc.vendorCommissionRate;
    updates["orders.commission.minWithdrawalAmount"] = doc.minWithdrawalAmount;
  }

  // Migrate SEO fields
  if (doc.metaTitle && !doc.seo?.metaTitle) {
    needsMigration = true;
    updates["seo.metaTitle"] = doc.metaTitle;
    updates["seo.metaDescription"] = doc.metaDescription;
    updates["seo.metaKeywords"] = doc.metaKeywords;
  }

  // Migrate social fields
  if (doc.facebookUrl && !doc.social?.facebookUrl) {
    needsMigration = true;
    updates["social.facebookUrl"] = doc.facebookUrl;
    updates["social.twitterUrl"] = doc.twitterUrl;
    updates["social.instagramUrl"] = doc.instagramUrl;
    updates["social.youtubeUrl"] = doc.youtubeUrl;
  }

  // Migrate maintenance fields
  if (doc.maintenanceMode !== undefined && !doc.maintenance?.enabled) {
    needsMigration = true;
    updates["maintenance.enabled"] = doc.maintenanceMode;
    updates["maintenance.message"] = doc.maintenanceMessage;
  }

  // Initialize POS nested structure defaults if missing
  if (doc.pos) {
    if (doc.pos.language === undefined) {
      needsMigration = true;
      updates["pos.language"] = "en";
    }
    if (!doc.pos.customize) {
      needsMigration = true;
      updates["pos.customize.smartGridEnabled"] = true;
      updates["pos.customize.lockScreenTimeoutMinutes"] = 5;
      updates["pos.customize.printedReceiptsEnabled"] = false;
      updates["pos.customize.customerDisplayEnabled"] = false;
    }
    if (!doc.pos.checkout) {
      needsMigration = true;
      updates["pos.checkout.paymentMethods"] = ["cash", "card"];
      updates["pos.checkout.customerReceiptSelectionEnabled"] = false;
      updates["pos.checkout.offlinePaymentsEnabled"] = false;
    }
    if (!doc.pos.orders || !doc.pos.orders.returnRules) {
      needsMigration = true;
      updates["pos.orders.returnRules.enabled"] = false;
      updates["pos.orders.returnRules.windowDays"] = 30;
      updates["pos.orders.returnRules.allowWithoutReceipt"] = false;
    }
  }

  // Migrate multi-vendor fields
  if (doc.general?.multiVendorEnabled !== undefined) {
    needsMigration = true;
    updates["multiVendorMode.enabled"] = Boolean(doc.general.multiVendorEnabled);
    updates["general.multiVendorEnabled"] = undefined;
  }
  if (doc.vendorPermissions) {
    const vp = doc.vendorPermissions as Record<string, unknown>;
    needsMigration = true;
    updates["multiVendorMode.canManageProducts"] = Boolean(vp.canManageProducts);
    updates["multiVendorMode.canViewOrders"] = Boolean(vp.canViewOrders);
    updates["multiVendorMode.canManageOrders"] = Boolean(vp.canManageOrders);
    updates["multiVendorMode.canManageStoreSettings"] = Boolean(
      vp.canManageStoreSettings,
    );
    updates["multiVendorMode.canViewAnalytics"] = Boolean(vp.canViewAnalytics);
    updates["multiVendorMode.canManageDiscounts"] = Boolean(
      vp.canManageDiscounts ?? vp.canManageProducts,
    );
    updates["multiVendorMode.canManagePayouts"] = Boolean(vp.canManagePayouts);
    updates["multiVendorMode.canAccessPOS"] = Boolean(vp.canAccessPOS);
    updates["vendorPermissions"] = undefined;
  }

  if (needsMigration) {
    await Settings.updateOne({ _id: settings._id }, { $set: updates });
    console.log("Settings migration completed successfully");
  }
}
