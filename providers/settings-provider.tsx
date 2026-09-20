"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Application Settings Interface
 */
interface AppSettings {
  // Display Settings
  itemsPerPage: number;
  showProductImages: boolean;
  enableAnimations: boolean;
  compactMode: boolean;

  // Notification Settings
  emailNotifications: boolean;
  pushNotifications: boolean;
  orderUpdates: boolean;
  promotionalEmails: boolean;

  // Privacy Settings
  shareUsageData: boolean;
  personalization: boolean;

  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: "small" | "medium" | "large";
}

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  // Display Settings
  itemsPerPage: 12,
  showProductImages: true,
  enableAnimations: true,
  compactMode: false,

  // Notification Settings
  emailNotifications: true,
  pushNotifications: true,
  orderUpdates: true,
  promotionalEmails: false,

  // Privacy Settings
  shareUsageData: false,
  personalization: true,

  // Accessibility
  reducedMotion: false,
  highContrast: false,
  fontSize: "medium",
};

/**
 * Settings Store with Zustand
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateSettings: (newSettings: Partial<AppSettings>) => {
        set((state) => ({ ...state, ...newSettings }));
      },

      resetSettings: () => {
        set(defaultSettings);
      },
    }),
    {
      name: "minimart-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Hook to access settings
 */
export function useSettings() {
  const store = useSettingsStore();

  return {
    settings: {
      itemsPerPage: store.itemsPerPage,
      showProductImages: store.showProductImages,
      enableAnimations: store.enableAnimations,
      compactMode: store.compactMode,
      emailNotifications: store.emailNotifications,
      pushNotifications: store.pushNotifications,
      orderUpdates: store.orderUpdates,
      promotionalEmails: store.promotionalEmails,
      shareUsageData: store.shareUsageData,
      personalization: store.personalization,
      reducedMotion: store.reducedMotion,
      highContrast: store.highContrast,
      fontSize: store.fontSize,
    },
    updateSettings: store.updateSettings,
    resetSettings: store.resetSettings,
  };
}

