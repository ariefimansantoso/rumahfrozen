"use client";

import { useEffect, useRef } from "react";
import { useAppSettings } from "@/providers/app-settings-provider";
import {
  useCurrencyStore,
  useHydrateCurrencyStore,
} from "@/providers/currency-provider";

export function CurrencyApplier() {
  useHydrateCurrencyStore();
  const { defaultCurrency, isLoading } = useAppSettings();
  const currencyCode = useCurrencyStore((s) => s.currency.code);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const lastSyncedRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    const next = String(defaultCurrency || "USD").toUpperCase();

    if (!isInitializedRef.current || lastSyncedRef.current !== next) {
      isInitializedRef.current = true;
      lastSyncedRef.current = next;
      if (currencyCode !== next) {
        setCurrency(next);
      }
    }
  }, [defaultCurrency, isLoading, currencyCode, setCurrency]);

  return null;
}
