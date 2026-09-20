"use client";

import { useEffect, useRef } from "react";
import { useAppSettings } from "@/providers/app-settings-provider";
import { useLanguageStore } from "@/providers/language-provider";

export function LanguageApplier() {
  const { defaultLanguage, isLoading } = useAppSettings();
  const languageCode = useLanguageStore((s) => s.language.code);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const lastSyncedRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    const next = String(defaultLanguage || "en").toLowerCase();

    if (!isInitializedRef.current || lastSyncedRef.current !== next) {
      isInitializedRef.current = true;
      lastSyncedRef.current = next;
      if (languageCode !== next) {
        setLanguage(next);
      }
    }
  }, [defaultLanguage, isLoading, languageCode, setLanguage]);

  return null;
}
