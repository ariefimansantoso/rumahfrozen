"use client";

import type { ComponentType } from "react";
import {
  BarChart3,
  Bell,
  CreditCard,
  HardDrive,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Palette,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Wrench,
} from "lucide-react";

export type AdminSettingsSectionId =
  | "general"
  | "appearance"
  | "marketplace"
  | "pos"
  | "locations"
  | "twoFactor"
  | "oauth"
  | "security"
  | "payment"
  | "email"
  | "notifications"
  | "orders"
  | "shipping"
  | "seo"
  | "social"
  | "analytics"
  | "maintenance"
  | "storage"
  | "aiAuthoring";

export type SectionStatus = "ok" | "warning" | "disabled";

export type AdminSettingsSection = {
  id: AdminSettingsSectionId;
  tab: AdminSettingsSectionId;
  labelKey: string;
  defaultLabel: string;
  icon: ComponentType<{ className?: string }>;
};

export const ADMIN_SETTINGS_SECTIONS: AdminSettingsSection[] = [
  {
    id: "general",
    tab: "general",
    labelKey: "admin.settings.general.title",
    defaultLabel: "General",
    icon: Store,
  },
  {
    id: "appearance",
    tab: "appearance",
    labelKey: "admin.settings.appearance.title",
    defaultLabel: "Appearance",
    icon: Palette,
  },
  {
    id: "marketplace",
    tab: "marketplace",
    labelKey: "admin.settings.security.multiVendor.label",
    defaultLabel: "Multi-Vendor Management",
    icon: ShoppingBag,
  },
  {
    id: "pos",
    tab: "pos",
    labelKey: "admin.settings.pos.title",
    defaultLabel: "POS",
    icon: Monitor,
  },
  {
    id: "locations",
    tab: "locations",
    labelKey: "admin.settings.locations.title",
    defaultLabel: "Inventory Locations",
    icon: MapPin,
  },
  {
    id: "twoFactor",
    tab: "twoFactor",
    labelKey: "admin.settings.twoFactor.title",
    defaultLabel: "Two-Factor Authentication",
    icon: Lock,
  },
  {
    id: "oauth",
    tab: "oauth",
    labelKey: "admin.settings.oauth.title",
    defaultLabel: "OAuth / Social Login",
    icon: KeyRound,
  },
  {
    id: "aiAuthoring",
    tab: "aiAuthoring",
    labelKey: "admin.settings.ai.title",
    defaultLabel: "AI Configuration",
    icon: Sparkles,
  },
  {
    id: "security",
    tab: "security",
    labelKey: "admin.settings.security.title",
    defaultLabel: "Security & Access Control",
    icon: Shield,
  },
  {
    id: "payment",
    tab: "payment",
    labelKey: "admin.settings.payment.title",
    defaultLabel: "Payment Settings",
    icon: CreditCard,
  },
  {
    id: "email",
    tab: "email",
    labelKey: "admin.settings.email.title",
    defaultLabel: "Email Configuration (SMTP)",
    icon: Mail,
  },
  {
    id: "notifications",
    tab: "notifications",
    labelKey: "admin.settings.notifications.title",
    defaultLabel: "Notification Settings",
    icon: Bell,
  },
  {
    id: "orders",
    tab: "orders",
    labelKey: "admin.settings.orders.title",
    defaultLabel: "Order Settings",
    icon: Wrench,
  },
  {
    id: "shipping",
    tab: "shipping",
    labelKey: "admin.settings.shipping.title",
    defaultLabel: "Shipping & Delivery",
    icon: Truck,
  },
  {
    id: "seo",
    tab: "seo",
    labelKey: "admin.settings.seo.title",
    defaultLabel: "SEO Settings",
    icon: BarChart3,
  },
  {
    id: "social",
    tab: "social",
    labelKey: "admin.settings.social.title",
    defaultLabel: "Social / Links",
    icon: Wrench,
  },
  {
    id: "analytics",
    tab: "analytics",
    labelKey: "admin.settings.analytics.title",
    defaultLabel: "Analytics",
    icon: BarChart3,
  },
  {
    id: "maintenance",
    tab: "maintenance",
    labelKey: "admin.settings.maintenance.title",
    defaultLabel: "Maintenance",
    icon: Wrench,
  },
  {
    id: "storage",
    tab: "storage",
    labelKey: "admin.settings.storage.title",
    defaultLabel: "Storage",
    icon: HardDrive,
  },
];

type SettingsForStatus = {
  maintenance?: { enabled?: boolean };
  payment?: {
    stripe?: { enabled?: boolean; secretKey?: string };
    paypal?: { enabled?: boolean; clientSecret?: string };
    razorpay?: { enabled?: boolean; keySecret?: string };
    paystack?: { enabled?: boolean; secretKey?: string };
  };
  email?: { enabled?: boolean; provider?: string; smtp?: { host?: string; user?: string } };
  shipping?: { enabled?: boolean; zones?: Array<{ rates?: unknown[] }> };
  storage?: { provider?: string; bucketName?: string; accessKeyId?: string };
  security?: {
    twoFactorEnabled?: boolean;
    googleOAuthEnabled?: boolean;
    googleClientId?: string;
    facebookOAuthEnabled?: boolean;
    facebookAppId?: string;
  };
  aiAuthoring?: { enabled?: boolean };
  _meta?: {
    payment?: {
      stripe?: { secretKeySet?: boolean };
      paypal?: { clientSecretSet?: boolean };
      razorpay?: { keySecretSet?: boolean };
      paystack?: { secretKeySet?: boolean };
    };
    security?: {
      googleClientSecretSet?: boolean;
      facebookAppSecretSet?: boolean;
    };
    ai?: { apiKeySet?: boolean };
    envSources?: { ai?: { apiKey?: boolean } };
  };
};

export function getSectionStatus(
  sectionId: AdminSettingsSectionId,
  settings: SettingsForStatus,
): SectionStatus {
  if (sectionId === "maintenance") {
    return settings.maintenance?.enabled ? "warning" : "ok";
  }

  if (sectionId === "payment") {
    const stripeEnabled = settings.payment?.stripe?.enabled ?? false;
    const stripeConfigured =
      Boolean(settings.payment?.stripe?.secretKey) ||
      Boolean(settings._meta?.payment?.stripe?.secretKeySet);
    const paypalEnabled = settings.payment?.paypal?.enabled ?? false;
    const paypalConfigured =
      Boolean(settings.payment?.paypal?.clientSecret) ||
      Boolean(settings._meta?.payment?.paypal?.clientSecretSet);
    const razorpayEnabled = settings.payment?.razorpay?.enabled ?? false;
    const razorpayConfigured =
      Boolean(settings.payment?.razorpay?.keySecret) ||
      Boolean(settings._meta?.payment?.razorpay?.keySecretSet);
    const paystackEnabled = settings.payment?.paystack?.enabled ?? false;
    const paystackConfigured =
      Boolean(settings.payment?.paystack?.secretKey) ||
      Boolean(settings._meta?.payment?.paystack?.secretKeySet);
    const hasWarning =
      (stripeEnabled && !stripeConfigured) ||
      (paypalEnabled && !paypalConfigured) ||
      (razorpayEnabled && !razorpayConfigured) ||
      (paystackEnabled && !paystackConfigured);
    return hasWarning ? "warning" : "ok";
  }

  if (sectionId === "email") {
    if (!settings.email?.enabled) return "disabled";
    if (settings.email.provider !== "smtp") return "ok";
    const host = settings.email.smtp?.host;
    const user = settings.email.smtp?.user;
    return !host || !user ? "warning" : "ok";
  }

  if (sectionId === "storage") {
    if (!settings.storage) return "ok";
    const bucketName = settings.storage.bucketName;
    const accessKeyId = settings.storage.accessKeyId;
    return !bucketName || !accessKeyId ? "warning" : "ok";
  }

  if (sectionId === "oauth") {
    const googleEnabled = settings.security?.googleOAuthEnabled ?? false;
    const facebookEnabled = settings.security?.facebookOAuthEnabled ?? false;
    const googleConfigured =
      Boolean(settings.security?.googleClientId) &&
      Boolean(settings._meta?.security?.googleClientSecretSet);
    const facebookConfigured =
      Boolean(settings.security?.facebookAppId) &&
      Boolean(settings._meta?.security?.facebookAppSecretSet);
    const hasWarning =
      (googleEnabled && !googleConfigured) || (facebookEnabled && !facebookConfigured);
    return hasWarning ? "warning" : "ok";
  }

  if (sectionId === "twoFactor") {
    const enabled = settings.security?.twoFactorEnabled ?? false;
    return enabled ? "ok" : "disabled";
  }

  if (sectionId === "shipping") {
    const enabled = settings.shipping?.enabled ?? false;
    if (!enabled) return "disabled";
    const zones = settings.shipping?.zones ?? [];
    if (zones.length === 0) return "warning";
    const hasRates = zones.some((z) => Array.isArray(z.rates) && z.rates.length > 0);
    return hasRates ? "ok" : "warning";
  }

  if (sectionId === "aiAuthoring") {
    if (settings.aiAuthoring?.enabled === false) return "disabled";
    const keyAvailable =
      (settings._meta?.ai?.apiKeySet ?? false) ||
      (settings._meta?.envSources?.ai?.apiKey ?? false);
    return keyAvailable ? "ok" : "warning";
  }

  return "ok";
}
