import type { CredentialEnvSources } from "@/lib/credentials";

export interface Settings {
  general: {
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
  };
  appearance: {
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
  };
  payment: {
    stripe: {
      enabled: boolean;
      publishableKey?: string;
      secretKey?: string;
      webhookSecret?: string;
    };
    paypal: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
      mode: "sandbox" | "live";
      webhookId?: string;
    };
    razorpay: {
      enabled: boolean;
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
    };
    paystack: {
      enabled: boolean;
      publicKey?: string;
      secretKey?: string;
    };
    cod: {
      enabled: boolean;
      instructions?: string;
      minOrderAmount?: number;
      maxOrderAmount?: number;
    };
  };
  _meta?: {
    payment?: {
      stripe?: {
        secretKeySet?: boolean;
        webhookSecretSet?: boolean;
      };
      paypal?: {
        clientSecretSet?: boolean;
      };
      razorpay?: {
        keySecretSet?: boolean;
        webhookSecretSet?: boolean;
      };
      paystack?: {
        secretKeySet?: boolean;
      };
    };
    security?: {
      googleClientSecretSet?: boolean;
      facebookAppSecretSet?: boolean;
    };
    ai?: {
      apiKeySet?: boolean;
    };
    demoMode?: {
      enabled?: boolean;
      message?: string;
    };
    envSources?: CredentialEnvSources;
  };
  email: {
    provider: "smtp" | "sendgrid" | "ses" | "mailgun";
    enabled: boolean;
    smtp: {
      host?: string;
      port: number;
      user?: string;
      password?: string;
      secure: boolean;
    };
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
    apiKey?: string;
    logRetentionDays?: 7 | 30 | 90;
  };
  notifications: {
    admin: {
      newOrders: NotificationChannelSettings;
      newCustomers: NotificationChannelSettings;
      newVendors: NotificationChannelSettings;
      returns: NotificationChannelSettings;
      payments: NotificationChannelSettings;
    };
    staff: {
      newOrders: NotificationChannelSettings;
      newCustomers: NotificationChannelSettings;
      returns: NotificationChannelSettings;
      payments: NotificationChannelSettings;
      lowStock: NotificationChannelSettings;
    };
    vendor: {
      applicationStatus: NotificationChannelSettings;
      newOrders: NotificationChannelSettings;
      returns: NotificationChannelSettings;
    };
    customer: {
      orderUpdates: NotificationChannelSettings;
      returnUpdates: NotificationChannelSettings;
    };
  };
  orders: {
    prefix: string;
    taxRate: number;
    freeShippingThreshold?: number;
    defaultShippingCost: number;
    commission: {
      vendorRate: number;
      minWithdrawalAmount: number;
    };
  };
  shipping: {
    enabled: boolean;
    weightUnit?: "kg" | "lb";
    origin?: {
      country: string;
      state?: string;
      city?: string;
      postalCode?: string;
      address1?: string;
      address2?: string;
    };
    delivery?: {
      processingDaysMin: number;
      processingDaysMax: number;
      showEstimatedDelivery: boolean;
    };
    zones: Array<{
      id: string;
      name: string;
      countries: string[];
      regions?: string[];
      rates: Array<{
        id: string;
        name: string;
        type: "flat" | "free_over" | "subtotal_range" | "weight_range";
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
      }>;
    }>;
    fallbackRate?: {
      enabled: boolean;
      name: string;
      price: number;
      minDays?: number;
      maxDays?: number;
    };
    localPickup?: {
      enabled: boolean;
      pickupAddress?: string;
      instructions?: string;
      readyInDaysMin?: number;
      readyInDaysMax?: number;
    };
    customs?: {
      enabled: boolean;
      dutyMode: "DDP" | "DDU";
      dutyRatePercent?: number;
      deMinimis?: number;
    };
    vendorShipping?: {
      enabled: boolean;
    };
  };
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
    ogImage?: string;
  };
  social: {
    facebookUrl?: string;
    twitterUrl?: string;
    instagramUrl?: string;
    youtubeUrl?: string;
    linkedinUrl?: string;
    tiktokUrl?: string;
    share?: SocialShareSettings;
  };
  analytics: {
    googleAnalyticsId?: string;
    googleTagManagerId?: string;
    facebookPixelId?: string;
    tiktokPixelId?: string;
    plausibleDomain?: string;
    plausibleApiKey?: string;
    plausibleSelfHosted?: boolean;
    plausibleBaseUrl?: string;
  };
  maintenance: {
    enabled: boolean;
    title?: string;
    message?: string;
    backgroundImageUrl?: string;
    countdownEnabled?: boolean;
    countdownEndsAt?: string;
    allowedIPs?: string[];
  };
  security: {
    emailVerificationRequired: boolean;
    emailVerificationForVendors: boolean;
    emailVerificationRequiredSince?: string;
    emailVerificationForVendorsSince?: string;
    smtpVerifiedAt?: string;
    twoFactorEnabled: boolean;
    twoFactorRequiredForAdmin: boolean;
    twoFactorRequiredForVendors: boolean;
    twoFactorRequiredForStaff: boolean;
    googleOAuthEnabled: boolean;
    googleClientId?: string;
    googleClientSecret?: string;
    facebookOAuthEnabled: boolean;
    facebookAppId?: string;
    facebookAppSecret?: string;
    sessionMaxAgeDays: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    rateLimiting?: {
      enabled: boolean;
      ipPreset: "default" | "lenient" | "moderate" | "strict";
      adminPreset: "default" | "lenient" | "moderate" | "strict";
      vendorPreset: "default" | "lenient" | "moderate" | "strict";
      checkoutPreset: "default" | "lenient" | "moderate" | "strict";
      cartPreset: "default" | "lenient" | "moderate" | "strict";
      couponPreset: "default" | "lenient" | "moderate" | "strict";
      authPreset: "default" | "lenient" | "moderate" | "strict";
    };
    minPasswordLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  pos: {
    enabled: boolean;
    allowAdminSales: boolean;
    allowVendorSales: boolean;
    allowSellerSales: boolean;
    language?: string;
    defaultPosLocationId?: string;
    customize?: {
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
    };
    checkout?: {
      paymentMethods: ("cash" | "card" | "manual")[];
      customerReceiptSelectionEnabled: boolean;
      offlinePaymentsEnabled: boolean;
    };
    orders?: {
      orderNumberPrefix: string;
      returnRules: {
        enabled: boolean;
        windowDays: number;
        allowWithoutReceipt: boolean;
        conditionNotes?: string;
      };
    };
  };
  multiVendorMode: {
    enabled: boolean;
    canManageProducts: boolean;
    canViewOrders: boolean;
    canManageOrders: boolean;
    canManageStoreSettings: boolean;
    canViewAnalytics: boolean;
    canManageDiscounts: boolean;
    canManagePayouts: boolean;
    canAccessPOS: boolean;
  };
  storage: {
    provider: "cloudflare_r2" | "s3" | "local";
    endpoint?: string;
    accountId?: string;
    region?: string;
    bucketName?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrl?: string;
    maxFileSizeMB: number;
    maxImageSizeMB?: number;
    maxVideoSizeMB?: number;
    maxModelSizeMB?: number;
    allowedMimeTypes: string[];
    pathPrefix?: string;
  };
  aiSalesAgent?: {
    enabled: boolean;
    model: "gpt-5.4-mini" | "gpt-5.4" | "gpt-5.5" | "gpt-5.4-nano";
    temperature: number;
    reasoningEffort: "none" | "low" | "medium" | "high";
    maxRecommendations: number;
    agentName: string;
    greeting: string;
    tone: "friendly" | "professional" | "playful" | "luxury";
    instructions?: string;
    escalationMessage: string;
    widget: {
      position: "bottom-right" | "bottom-left";
      primaryColor: string;
      accentColor: string;
      avatarUrl?: string;
      footerText?: string;
    };
    capabilities: {
      productQA: boolean;
      recommendations: boolean;
      cartActions: boolean;
      checkoutHandoff: boolean;
      orderStatus: boolean;
    };
  };
  aiAuthoring?: {
    enabled: boolean;
    /** Write-only; the server strips it from every response. */
    apiKey?: string;
    textModel: "" | "gpt-4.1-mini" | "gpt-4.1" | "gpt-5-mini" | "gpt-5";
    imageModel: "" | "gpt-image-1" | "gpt-image-1-mini";
    surfaces: {
      products: boolean;
      categories: boolean;
      collections: boolean;
      brands: boolean;
      blogPosts: boolean;
      contentPages: boolean;
      reviews: boolean;
      heroBanner: boolean;
    };
    imageDefaults: {
      size: "auto" | "1024x1024" | "1024x1536" | "1536x1024";
      quality: "auto" | "medium" | "high";
    };
    brandVoice: {
      tone: "" | "friendly" | "professional" | "luxury" | "playful" | "supportive";
      instructions: string;
      imageStyle?: string;
    };
    brandKit?: {
      primaryColor?: string;
      secondaryColor?: string;
      logoUrl?: string;
    };
    access: {
      staffEnabled: boolean;
      vendorsEnabled: boolean;
    };
    limits: {
      textPerUserPerDay: number;
      imagePerUserPerDay: number;
    };
  };
}

export interface NotificationChannelSettings {
  inApp: boolean;
  email: boolean;
  browserPush: boolean;
}

export interface CustomShareButton {
  id: string;
  label: string;
  urlTemplate: string;
  enabled: boolean;
  icon?: string;
}

export interface SocialShareSettings {
  enabled: boolean;
  copyLink: boolean;
  facebook: boolean;
  twitter: boolean;
  whatsapp: boolean;
  telegram: boolean;
  pinterest: boolean;
  linkedin: boolean;
  email: boolean;
  custom: CustomShareButton[];
}
