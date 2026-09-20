"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "@/providers/theme-provider";
import {
  type InitialAppearanceSettings,
  useAppSettings,
  useHydrateAppSettingsStore,
  presetColors,
} from "@/stores/app-settings";
import { getLocaleDirection, isValidLocale } from "@/config/i18n.config";

/**
 * SettingsApplier
 * This component applies global settings to the DOM.
 * It should be rendered once at the root of the application.
 */
export function SettingsApplier({
  initialAppearanceSettings,
}: {
  initialAppearanceSettings?: InitialAppearanceSettings;
}) {
  const hasHydratedAppSettings = useHydrateAppSettingsStore();
  const {
    contrast,
    presetColor,
    rtl,
    themeMode,
    hydrateFromDb,
    loadFromDb,
  } = useAppSettings();
  const { setTheme, theme } = useTheme();
  const params = useParams();
  const localeParamRaw = (
    params as Record<string, string | string[] | undefined>
  )?.locale;
  const localeParam = Array.isArray(localeParamRaw)
    ? localeParamRaw[0]
    : localeParamRaw;

  useEffect(() => {
    if (!hasHydratedAppSettings) return;
    if (initialAppearanceSettings) {
      hydrateFromDb(initialAppearanceSettings);
      return;
    }
    void loadFromDb();
  }, [
    hasHydratedAppSettings,
    hydrateFromDb,
    initialAppearanceSettings,
    loadFromDb,
  ]);

  useEffect(() => {
    const userThemePreference = localStorage.getItem("minimart-theme");
    if (userThemePreference) return;
    if (theme && theme === themeMode) return;
    setTheme(themeMode);
  }, [setTheme, themeMode, theme]);

  // Apply RTL mode (right-to-left direction)
  useEffect(() => {
    const docLang = document.documentElement.getAttribute("lang");

    const autoLocale =
      (typeof docLang === "string" && isValidLocale(docLang) && docLang) ||
      (typeof localeParam === "string" &&
        isValidLocale(localeParam) &&
        localeParam) ||
      null;

    const autoDirection = autoLocale ? getLocaleDirection(autoLocale) : "ltr";
    document.documentElement.setAttribute("dir", rtl ? "rtl" : autoDirection);
  }, [rtl, localeParam]);

  // Apply Contrast mode (high contrast)
  useEffect(() => {
    if (contrast) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
  }, [contrast]);

  // Apply Preset Color (primary color)
  useEffect(() => {
    const colorValue = presetColors[presetColor]?.primary;
    if (colorValue) {
      const accentValue = colorValue.includes("/")
        ? colorValue
        : colorValue.replace(/\)\s*$/, " / 0.12)");
      document.documentElement.style.setProperty("--primary", colorValue);
      // Also update related variables for consistency
      document.documentElement.style.setProperty("--ring", colorValue);
      document.documentElement.style.setProperty("--chart-1", colorValue);
      document.documentElement.style.setProperty(
        "--sidebar-primary",
        colorValue,
      );
      document.documentElement.style.setProperty("--sidebar-ring", colorValue);
      document.documentElement.style.setProperty(
        "--sidebar-accent-foreground",
        colorValue,
      );
      document.documentElement.style.setProperty(
        "--sidebar-accent",
        accentValue,
      );
    }
  }, [presetColor]);

  return null;
}
