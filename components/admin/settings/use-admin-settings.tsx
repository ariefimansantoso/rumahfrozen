"use client";

import type { Settings } from "./types";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/toast-notification";
import { useAppSettings as useAppSettingsStore } from "@/stores/app-settings";
import { useCurrencyStore } from "@/providers/currency-provider";
import { getSectionIdFromPath, isPlainObject, setNestedValue } from "./utils";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  DEFAULT_PRESET_COLOR,
  DEFAULT_STORE_NAME,
  DEFAULT_TIMEZONE,
} from "@/config/branding.config";
import { normalizeNotificationSettings } from "@/lib/notification-settings";
import { apiClient, ApiClientError } from "@/lib/api/client";

const REQUIRED_OBJECT_SECTIONS = [
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
] as const;

const DEFAULT_GENERAL_SETTINGS: Settings["general"] = {
  storeName: DEFAULT_STORE_NAME,
  storeEmail: "store@example.com",
  defaultLanguage: DEFAULT_LANGUAGE,
  defaultCurrency: DEFAULT_CURRENCY,
  supportedLanguages: [DEFAULT_LANGUAGE],
  supportedCurrencies: [DEFAULT_CURRENCY],
  timezone: DEFAULT_TIMEZONE,
};

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length ? normalized : fallback;
}

function normalizeSettingsPayload(value: unknown): Settings | null {
  if (!isPlainObject(value)) return null;

  const normalized: Record<string, unknown> = { ...value };
  for (const section of REQUIRED_OBJECT_SECTIONS) {
    if (!isPlainObject(normalized[section])) {
      normalized[section] = {};
    }
  }

  const general = normalized.general as Record<string, unknown>;
  normalized.general = {
    ...DEFAULT_GENERAL_SETTINGS,
    ...general,
    supportedLanguages: normalizeStringArray(
      general.supportedLanguages,
      DEFAULT_GENERAL_SETTINGS.supportedLanguages,
    ),
    supportedCurrencies: normalizeStringArray(
      general.supportedCurrencies,
      DEFAULT_GENERAL_SETTINGS.supportedCurrencies,
    ),
  };

  normalized.notifications = normalizeNotificationSettings(
    normalized.notifications,
  );

  return normalized as unknown as Settings;
}

function normalizeComparableValue(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparableValue(item));
  }

  if (isPlainObject(value)) {
    const normalized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const next = normalizeComparableValue(nestedValue);
      if (next !== undefined) normalized[key] = next;
    }
    return normalized;
  }

  return value;
}

function comparableJson(value: unknown) {
  return JSON.stringify(normalizeComparableValue(value));
}

function pickSecurityFields(
  settings: Settings,
  keys: Array<keyof Settings["security"]>,
) {
  const security = settings.security || {};
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    acc[String(key)] = security[key];
    return acc;
  }, {});
}

function getComparableSection(section: string, settings: Settings): unknown {
  if (section === "oauth") {
    return {
      ...pickSecurityFields(settings, [
        "googleOAuthEnabled",
        "googleClientId",
        "googleClientSecret",
        "facebookOAuthEnabled",
        "facebookAppId",
        "facebookAppSecret",
      ]),
      googleClientSecretSet:
        settings._meta?.security?.googleClientSecretSet ?? false,
      facebookAppSecretSet:
        settings._meta?.security?.facebookAppSecretSet ?? false,
    };
  }

  if (section === "twoFactor") {
    return pickSecurityFields(settings, [
      "twoFactorEnabled",
      "twoFactorRequiredForAdmin",
      "twoFactorRequiredForVendors",
      "twoFactorRequiredForStaff",
    ]);
  }

  if (section === "emailVerification") {
    return pickSecurityFields(settings, [
      "emailVerificationRequired",
      "emailVerificationForVendors",
    ]);
  }

  if (section === "security") {
    return pickSecurityFields(settings, [
      "sessionMaxAgeDays",
      "maxLoginAttempts",
      "lockoutDurationMinutes",
      "minPasswordLength",
      "requireUppercase",
      "requireNumbers",
      "requireSpecialChars",
    ]);
  }

  const key = section === "marketplace" ? "multiVendorMode" : section;
  return (settings as unknown as Record<string, unknown>)[key];
}

function getEffectiveDirtySections(
  settings: Settings | null,
  initialSettings: Settings | null,
  dirtySectionHints: Set<string>,
) {
  const next = new Set<string>();
  if (!settings || !initialSettings) return next;

  for (const section of dirtySectionHints) {
    const current = getComparableSection(section, settings);
    const initial = getComparableSection(section, initialSettings);
    if (comparableJson(current) !== comparableJson(initial)) {
      next.add(section);
    }
  }

  return next;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [initialSettings, setInitialSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingPayment, setIsTestingPayment] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [dirtySectionHints, setDirtySectionHints] = useState<Set<string>>(
    () => new Set(),
  );
  const dirtySections = useMemo(
    () =>
      getEffectiveDirtySections(
        settings,
        initialSettings,
        dirtySectionHints,
      ),
    [settings, initialSettings, dirtySectionHints],
  );
  const isDemoMode = Boolean(settings?._meta?.demoMode?.enabled);
  const demoModeMessage =
    settings?._meta?.demoMode?.message ||
    "Demo mode is enabled. Settings changes are disabled on this demo site.";

  const notifyDemoMode = () => {
    toast.error(demoModeMessage);
  };

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/settings", {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json()) as unknown;
      const data = isPlainObject(json) ? json : {};
      if (data.success === true && "data" in data) {
        const loaded = normalizeSettingsPayload(data.data);
        if (!loaded) {
          toast.error("Failed to load settings");
          setSettings(null);
          setInitialSettings(null);
          return;
        }
        setSettings(loaded);
        setInitialSettings(loaded);
        setDirtySectionHints(new Set());
      } else {
        toast.error("Failed to load settings");
        setSettings(null);
        setInitialSettings(null);
        setDirtySectionHints(new Set());
      }
    } catch {
      toast.error("Failed to load settings");
      setSettings(null);
      setInitialSettings(null);
      setDirtySectionHints(new Set());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const markSectionDirty = (sectionId: string) => {
    if (isDemoMode) {
      notifyDemoMode();
      return;
    }
    setDirtySectionHints((prev) => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  };

  const updateNestedField = (path: string, value: unknown) => {
    if (isDemoMode) {
      notifyDemoMode();
      return;
    }
    const sectionId = getSectionIdFromPath(path);
    if (sectionId) markSectionDirty(String(sectionId));
    setSettings((prev) => {
      if (!prev) return prev;
      return setNestedValue(
        prev as unknown as Record<string, unknown>,
        path,
        value,
      ) as unknown as Settings;
    });
  };

  const updateFieldInSection = (section: string, path: string, value: unknown) => {
    if (isDemoMode) {
      notifyDemoMode();
      return;
    }
    const resolvedPath = path.includes(".") ? path : `${section}.${path}`;
    markSectionDirty(section);
    setSettings((prev) => {
      if (!prev) return prev;
      return setNestedValue(
        prev as unknown as Record<string, unknown>,
        resolvedPath,
        value,
      ) as unknown as Settings;
    });
  };

  const saveSection = async (section: string, data: unknown) => {
    if (isDemoMode) {
      notifyDemoMode();
      return false;
    }
    try {
      setIsSaving(true);
      const apiSection =
        section === "marketplace"
          ? "general"
          : section === "twoFactor" ||
              section === "oauth" ||
              section === "emailVerification"
            ? "security"
            : section;
      const payloadData =
        apiSection === "general" && isPlainObject(data)
          ? (() => {
              const src = data as Record<string, unknown>;
              const {
                storeName,
                storeDescription,
                storeEmail,
                storePhone,
                storeDomain,
                storeAddress,
                logoUrl,
                darkModeLogoUrl,
                faviconUrl,
                defaultLanguage,
                defaultCurrency,
                supportedLanguages,
                supportedCurrencies,
                timezone,
              } = src;
              return {
                storeName,
                storeDescription,
                storeEmail,
                storePhone,
                storeDomain,
                storeAddress,
                logoUrl,
                darkModeLogoUrl,
                faviconUrl,
                defaultLanguage,
                defaultCurrency,
                supportedLanguages,
                supportedCurrencies,
                timezone,
              };
            })()
          : data;
      const saved = await apiClient.put<unknown>("/api/admin/settings", {
        section: apiSection,
        data: payloadData,
      });
      {
        const nextSettings = normalizeSettingsPayload(saved);
        if (!nextSettings) {
          toast.error("Failed to save settings");
          return false;
        }
        setSettings(nextSettings);
        setInitialSettings(nextSettings);
        if (apiSection === "appearance" && nextSettings.appearance) {
          useAppSettingsStore.setState({
            themeMode: nextSettings.appearance.theme,
            contrast: Boolean(nextSettings.appearance.contrast),
            rtl: Boolean(nextSettings.appearance.rtl),
            collapsedSidebar: Boolean(nextSettings.appearance.collapsedSidebar),
            navLayout: nextSettings.appearance.navLayout || "mini",
            navColor: nextSettings.appearance.navColor || "integrate",
            presetColor:
              nextSettings.appearance.presetColor || DEFAULT_PRESET_COLOR,
            dbHydrated: true,
          });
        }
        if (apiSection === "general" && nextSettings.general) {
          const newCurrency = nextSettings.general.defaultCurrency || DEFAULT_CURRENCY;
          const currentCurrency = useCurrencyStore.getState().currency.code;
          if (newCurrency.toUpperCase() !== currentCurrency.toUpperCase()) {
            useCurrencyStore.getState().setCurrency(newCurrency);
          }
        }
        setDirtySectionHints((prev) => {
          const next = new Set(prev);
          next.delete(section);
          return next;
        });
        toast.success("Settings saved");
        return true;
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 429) {
        const fallback = error.retryAfter
          ? `Too many requests. Please try again in ${error.retryAfter} seconds.`
          : "Too many requests. Please try again shortly.";
        toast.error(error.message || fallback);
        return false;
      }
      toast.error(
        error instanceof ApiClientError && error.message
          ? error.message
          : "Failed to save settings",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveSections = async (data: Record<string, unknown>) => {
    if (isDemoMode) {
      notifyDemoMode();
      return false;
    }
    try {
      setIsSaving(true);
      const saved = await apiClient.put<unknown>("/api/admin/settings", {
        data,
      });
      {
        const nextSettings = normalizeSettingsPayload(saved);
        if (!nextSettings) {
          toast.error("Failed to save settings");
          return false;
        }
        setSettings(nextSettings);
        setInitialSettings(nextSettings);
        if (nextSettings.appearance) {
          useAppSettingsStore.setState({
            themeMode: nextSettings.appearance.theme,
            contrast: Boolean(nextSettings.appearance.contrast),
            rtl: Boolean(nextSettings.appearance.rtl),
            collapsedSidebar: Boolean(nextSettings.appearance.collapsedSidebar),
            navLayout: nextSettings.appearance.navLayout || "mini",
            navColor: nextSettings.appearance.navColor || "integrate",
            presetColor:
              nextSettings.appearance.presetColor || DEFAULT_PRESET_COLOR,
            dbHydrated: true,
          });
        }
        setDirtySectionHints(new Set());
        toast.success("Settings saved");
        return true;
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 429) {
        const fallback = error.retryAfter
          ? `Too many requests. Please try again in ${error.retryAfter} seconds.`
          : "Too many requests. Please try again shortly.";
        toast.error(error.message || fallback);
        return false;
      }
      toast.error("Failed to save settings");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const testSmtp = async () => {
    if (isDemoMode) {
      notifyDemoMode();
      return;
    }
    try {
      setIsTestingEmail(true);
      const result = await apiClient.request<unknown>(
        "POST",
        "/api/admin/settings/test-email",
        { testEmail },
      );
      toast.success(result.message || "Test email sent");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to send test email",
      );
    } finally {
      setIsTestingEmail(false);
    }
  };

  const testPaymentConnection = async (
    provider: "stripe" | "paypal" | "razorpay" | "paystack",
  ) => {
    if (isDemoMode) {
      notifyDemoMode();
      return;
    }
    try {
      setIsTestingPayment(true);
      const result = await apiClient.request<unknown>(
        "POST",
        "/api/admin/settings/test-payment",
        { provider },
      );
      toast.success(result.message || "Connected");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Connection failed",
      );
    } finally {
      setIsTestingPayment(false);
    }
  };

  const hasUnsaved = (): boolean => {
    return dirtySections.size > 0;
  };

  return {
    settings,
    setSettings,
    isLoading,
    isSaving,
    isTestingEmail,
    isTestingPayment,
    testEmail,
    setTestEmail,
    dirtySections,
    markSectionDirty,
    updateNestedField,
    updateFieldInSection,
    saveSection,
    saveSections,
    testSmtp,
    testPaymentConnection,
    refetch: fetchSettings,
    hasUnsaved,
    isDemoMode,
    demoModeMessage,
  };
}
