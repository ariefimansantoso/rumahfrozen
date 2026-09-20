"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_PRESET_COLOR,
  DEFAULT_PRIMARY_COLOR,
} from "@/config/branding.config";

export type ThemeMode = "light" | "dark" | "system";
export type NavLayout = "vertical" | "horizontal" | "mini";
export type NavColor = "integrate" | "apparent";
export type PresetColor =
  | "default"
  | "cyan"
  | "purple"
  | "blue"
  | "orange"
  | "red";

interface AppSettingsState {
  // Theme
  themeMode: ThemeMode;
  contrast: boolean;

  // Layout
  rtl: boolean;
  collapsedSidebar: boolean;
  navLayout: NavLayout;
  navColor: NavColor;

  // Colors
  presetColor: PresetColor;

  dbHydrated: boolean;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setContrast: (enabled: boolean) => void;
  setRtl: (enabled: boolean) => void;
  setCollapsedSidebar: (enabled: boolean) => void;
  setNavLayout: (layout: NavLayout) => void;
  setNavColor: (color: NavColor) => void;
  setPresetColor: (color: PresetColor) => void;
  resetSettings: () => void;
  hydrateFromDb: (settings: InitialAppearanceSettings) => void;
  loadFromDb: () => Promise<void>;
  saveToDb: () => Promise<boolean>;
}

export interface InitialAppearanceSettings {
  themeMode?: ThemeMode;
  contrast?: boolean;
  rtl?: boolean;
  collapsedSidebar?: boolean;
  navLayout?: NavLayout;
  navColor?: NavColor;
  presetColor?: PresetColor;
}

const defaultSettings = {
  themeMode: "system" as ThemeMode,
  contrast: false,
  rtl: false,
  collapsedSidebar: false,
  navLayout: "mini" as NavLayout,
  navColor: "integrate" as NavColor,
  presetColor: DEFAULT_PRESET_COLOR as PresetColor,
  dbHydrated: false,
};

let appSettingsStoreHydrationStarted = false;

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isNavLayout(value: unknown): value is NavLayout {
  return value === "vertical" || value === "horizontal" || value === "mini";
}

function isNavColor(value: unknown): value is NavColor {
  return value === "integrate" || value === "apparent";
}

function isPresetColor(value: unknown): value is PresetColor {
  return (
    value === "default" ||
    value === "cyan" ||
    value === "purple" ||
    value === "blue" ||
    value === "orange" ||
    value === "red"
  );
}

function normalizeAppearanceSettings(settings?: InitialAppearanceSettings) {
  return {
    themeMode: isThemeMode(settings?.themeMode)
      ? settings.themeMode
      : defaultSettings.themeMode,
    contrast:
      typeof settings?.contrast === "boolean"
        ? settings.contrast
        : defaultSettings.contrast,
    rtl:
      typeof settings?.rtl === "boolean" ? settings.rtl : defaultSettings.rtl,
    collapsedSidebar:
      typeof settings?.collapsedSidebar === "boolean"
        ? settings.collapsedSidebar
        : defaultSettings.collapsedSidebar,
    navLayout: isNavLayout(settings?.navLayout)
      ? settings.navLayout
      : defaultSettings.navLayout,
    navColor: isNavColor(settings?.navColor)
      ? settings.navColor
      : defaultSettings.navColor,
    presetColor: isPresetColor(settings?.presetColor)
      ? settings.presetColor
      : defaultSettings.presetColor,
  };
}

export const useAppSettings = create<AppSettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setThemeMode: (mode) => set({ themeMode: mode }),
      setContrast: (enabled) => set({ contrast: enabled }),
      setRtl: (enabled) => set({ rtl: enabled }),
      setCollapsedSidebar: (enabled) => set({ collapsedSidebar: enabled }),
      setNavLayout: (layout) => set({ navLayout: layout }),
      setNavColor: (color) => set({ navColor: color }),
      setPresetColor: (color) => set({ presetColor: color }),
      resetSettings: () => set(defaultSettings),
      hydrateFromDb: (settings) =>
        set({
          ...normalizeAppearanceSettings(settings),
          dbHydrated: true,
        }),
      loadFromDb: async () => {
        if (get().dbHydrated) return;
        try {
          const res = await fetch("/api/settings/public");
          const json = (await res.json()) as unknown;
          const payload = json as {
            success?: boolean;
            data?: { appearance?: Record<string, unknown> };
          };
          if (!payload?.success || !payload.data?.appearance) return;
          const a = payload.data.appearance;
          set({
            ...normalizeAppearanceSettings({
              themeMode: isThemeMode(a.theme) ? a.theme : undefined,
              contrast: typeof a.contrast === "boolean" ? a.contrast : undefined,
              rtl: typeof a.rtl === "boolean" ? a.rtl : undefined,
              collapsedSidebar:
                typeof a.collapsedSidebar === "boolean"
                  ? a.collapsedSidebar
                  : undefined,
              navLayout: isNavLayout(a.navLayout) ? a.navLayout : undefined,
              navColor: isNavColor(a.navColor) ? a.navColor : undefined,
              presetColor: isPresetColor(a.presetColor)
                ? a.presetColor
                : undefined,
            }),
            dbHydrated: true,
          });
        } catch {
          set({ dbHydrated: true });
        }
      },
      saveToDb: async () => {
        try {
          const state = get();
          const res = await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              section: "appearance",
              data: {
                theme: state.themeMode,
                contrast: state.contrast,
                rtl: state.rtl,
                collapsedSidebar: state.collapsedSidebar,
                navLayout: state.navLayout,
                navColor: state.navColor,
                presetColor: state.presetColor,
              },
            }),
          });
          const json = (await res.json()) as unknown;
          const payload = json as {
            success?: boolean;
            data?: { appearance?: Record<string, unknown> };
          };
          if (payload?.success && payload.data?.appearance) {
            const a = payload.data.appearance;
            set({
              themeMode:
                (typeof a.theme === "string" ? a.theme : state.themeMode) as ThemeMode,
              contrast:
                typeof a.contrast === "boolean" ? a.contrast : state.contrast,
              rtl: typeof a.rtl === "boolean" ? a.rtl : state.rtl,
              collapsedSidebar:
                typeof a.collapsedSidebar === "boolean"
                  ? a.collapsedSidebar
                  : state.collapsedSidebar,
              navLayout:
                (typeof a.navLayout === "string"
                  ? a.navLayout
                  : state.navLayout) as NavLayout,
              navColor:
                (typeof a.navColor === "string"
                  ? a.navColor
                  : state.navColor) as NavColor,
              presetColor:
                (typeof a.presetColor === "string"
                  ? a.presetColor
                  : state.presetColor) as PresetColor,
            });
          }
          return Boolean(payload?.success);
        } catch {
          return false;
        }
      },
    }),
    {
      name: "app-settings",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        themeMode: state.themeMode,
        contrast: state.contrast,
        rtl: state.rtl,
        collapsedSidebar: state.collapsedSidebar,
        navLayout: state.navLayout,
        navColor: state.navColor,
        presetColor: state.presetColor,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppSettingsState> | null;

        return {
          ...currentState,
          themeMode: persisted?.themeMode ?? currentState.themeMode,
          contrast: persisted?.contrast ?? currentState.contrast,
          rtl: persisted?.rtl ?? currentState.rtl,
          collapsedSidebar:
            persisted?.collapsedSidebar ?? currentState.collapsedSidebar,
          navLayout: persisted?.navLayout ?? currentState.navLayout,
          navColor: persisted?.navColor ?? currentState.navColor,
          presetColor: persisted?.presetColor ?? currentState.presetColor,
          dbHydrated: currentState.dbHydrated,
        };
      },
    }
  )
);

export function useHydrateAppSettingsStore() {
  const [hasHydrated, setHasHydrated] = React.useState(() =>
    typeof window === "undefined"
      ? false
      : useAppSettings.persist.hasHydrated(),
  );

  React.useEffect(() => {
    const unsubscribe = useAppSettings.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    if (
      appSettingsStoreHydrationStarted ||
      useAppSettings.persist.hasHydrated()
    ) {
      return unsubscribe;
    }

    appSettingsStoreHydrationStarted = true;
    void Promise.resolve(useAppSettings.persist.rehydrate()).then(() => {
      setHasHydrated(true);
    });

    return unsubscribe;
  }, []);

  return hasHydrated;
}

// Preset color values for CSS variables
export const presetColors: Record<
  PresetColor,
  { primary: string; hex: string; name: string }
> = {
  default: {
    primary: "oklch(0.55 0.20 250)",
    hex: DEFAULT_PRIMARY_COLOR,
    name: "Blue",
  },
  cyan: { primary: "oklch(0.65 0.15 200)", hex: "#00B8D9", name: "Cyan" },
  purple: { primary: "oklch(0.55 0.20 290)", hex: "#7635DC", name: "Purple" },
  blue: {
    primary: "oklch(0.18 0 0)",
    hex: "#111111",
    name: "Black",
  },
  orange: { primary: "oklch(0.70 0.18 60)", hex: "#FDA92D", name: "Orange" },
  red: { primary: "oklch(0.55 0.25 25)", hex: "#FF3030", name: "Red" },
};
