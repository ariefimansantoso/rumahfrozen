"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  DEFAULT_CURRENCY,
  DEFAULT_FAVICON_URL,
  DEFAULT_LANGUAGE,
  DEFAULT_STORE_NAME,
  resolveFaviconUrl,
} from "@/config/branding.config";
import {
  DEFAULT_SHARE_SETTINGS,
  resolveShareSettings,
  type ShareSettings,
} from "@/lib/share-config";
import type { InitialAppearanceSettings } from "@/stores/app-settings";

/**
 * App Settings Context
 * Provides database-driven application settings throughout the app
 * Replaces static environment variables with dynamic settings
 */

export interface SocialLinks {
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  tiktokUrl?: string;
}

interface AppSettingsContextValue {
  isMultiVendor: boolean;
  isLoading: boolean;
  posEnabled: boolean;
  storeName: string;
  storeDescription?: string;
  storeEmail?: string;
  storePhone?: string;
  storeAddress?: string;
  defaultCurrency: string;
  defaultLanguage: string;
  logoUrl?: string;
  darkModeLogoUrl?: string;
  faviconUrl?: string;
  socialLinks: SocialLinks;
  shareSettings: ShareSettings;
  refreshSettings: () => Promise<void>;
}

export type InitialAppSettings = Partial<
  Omit<AppSettingsContextValue, "refreshSettings">
> & {
  appearance?: InitialAppearanceSettings;
};

function resolveStoreName(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_STORE_NAME;
}

const defaultAppSettings: AppSettingsContextValue = {
  isMultiVendor: false,
  isLoading: true,
  posEnabled: false,
  storeName: DEFAULT_STORE_NAME,
  storeDescription: undefined,
  storeEmail: undefined,
  storePhone: undefined,
  storeAddress: undefined,
  defaultCurrency: DEFAULT_CURRENCY,
  defaultLanguage: DEFAULT_LANGUAGE,
  logoUrl: undefined,
  darkModeLogoUrl: undefined,
  faviconUrl: DEFAULT_FAVICON_URL,
  socialLinks: {},
  shareSettings: DEFAULT_SHARE_SETTINGS,
  refreshSettings: async () => {},
};

const AppSettingsContext =
  createContext<AppSettingsContextValue>(defaultAppSettings);

interface AppSettingsProviderProps {
  children: ReactNode;
  initialSettings?: InitialAppSettings;
}

export function AppSettingsProvider({
  children,
  initialSettings,
}: AppSettingsProviderProps) {
  const initialAppSettings = { ...(initialSettings ?? {}) };
  delete initialAppSettings.appearance;
  const [settings, setSettings] = useState<AppSettingsContextValue>({
    ...defaultAppSettings,
    ...initialAppSettings,
    storeName: resolveStoreName(initialSettings?.storeName),
    defaultCurrency: initialSettings?.defaultCurrency || DEFAULT_CURRENCY,
    defaultLanguage: initialSettings?.defaultLanguage || DEFAULT_LANGUAGE,
    faviconUrl: resolveFaviconUrl(initialSettings?.faviconUrl),
    socialLinks: initialSettings?.socialLinks ?? {},
    shareSettings: resolveShareSettings(initialSettings?.shareSettings),
    isLoading: !initialSettings,
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/public");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSettings({
            isMultiVendor:
              Boolean(
                data.data.multiVendorMode?.enabled ??
                  data.data.multiVendorEnabled,
              ),
            isLoading: false,
            posEnabled: data.data.pos?.enabled ?? false,
            storeName: resolveStoreName(data.data.storeName),
            storeDescription: data.data.storeDescription,
            storeEmail: data.data.storeEmail,
            storePhone: data.data.storePhone,
            storeAddress: data.data.storeAddress,
            defaultCurrency: data.data.defaultCurrency || DEFAULT_CURRENCY,
            defaultLanguage: data.data.defaultLanguage || DEFAULT_LANGUAGE,
            logoUrl: data.data.logoUrl,
            darkModeLogoUrl: data.data.darkModeLogoUrl,
            faviconUrl: resolveFaviconUrl(data.data.faviconUrl),
            socialLinks: {
              facebookUrl: data.data.social?.facebookUrl,
              twitterUrl: data.data.social?.twitterUrl,
              instagramUrl: data.data.social?.instagramUrl,
              youtubeUrl: data.data.social?.youtubeUrl,
              linkedinUrl: data.data.social?.linkedinUrl,
              tiktokUrl: data.data.social?.tiktokUrl,
            },
            shareSettings: resolveShareSettings(data.data.share),
            refreshSettings: fetchSettings,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch app settings:", error);
      setSettings((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Only fetch if we don't have initial settings
    if (!initialSettings) {
      fetchSettings();
    }
  }, [fetchSettings, initialSettings]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const faviconHref = resolveFaviconUrl(settings.faviconUrl);
    const rels = ["icon", "shortcut icon"];

    rels.forEach((rel) => {
      let link = document.querySelector(
        `link[rel='${rel}']`,
      ) as HTMLLinkElement | null;

      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }

      link.href = faviconHref;
    });
  }, [settings.faviconUrl]);

  return (
    <AppSettingsContext.Provider
      value={{ ...settings, refreshSettings: fetchSettings }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

/**
 * Hook to access app settings context
 */
export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error(
      "useAppSettings must be used within an AppSettingsProvider",
    );
  }
  return context;
}

/**
 * Hook specifically for multi-vendor mode check
 */
export function useMultiVendorMode(): {
  isMultiVendor: boolean;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
} {
  const { isMultiVendor, isLoading, refreshSettings } = useAppSettings();
  return { isMultiVendor, isLoading, refreshSettings };
}

/**
 * Hook for POS access check
 */
export function usePOSEnabled(): { posEnabled: boolean; isLoading: boolean } {
  const { posEnabled, isLoading } = useAppSettings();
  return { posEnabled, isLoading };
}
