"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { formatCurrency } from "@/lib/money";

/**
 * Currency Configuration
 */
export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  exchangeRate: number;
}

export const CURRENCIES: Currency[] = [
  {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    locale: "en-US",
    exchangeRate: 1,
  },
  {
    code: "IDR",
    symbol: "Rp",
    name: "Indonesian Rupiah",
    locale: "id-ID",
    exchangeRate: 15000,
  },
  {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    locale: "de-DE",
    exchangeRate: 0.92,
  },
  {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    locale: "en-GB",
    exchangeRate: 0.79,
  },
  {
    code: "BDT",
    symbol: "৳",
    name: "Bangladeshi Taka",
    locale: "bn-BD",
    exchangeRate: 110,
  },
  {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    locale: "en-IN",
    exchangeRate: 83,
  },
  {
    code: "TRY",
    symbol: "₺",
    name: "Turkish Lira",
    locale: "tr-TR",
    exchangeRate: 41,
  },
  {
    code: "PKR",
    symbol: "₨",
    name: "Pakistani Rupee",
    locale: "ur-PK",
    exchangeRate: 283,
  },
  {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    locale: "ja-JP",
    exchangeRate: 149,
  },
  {
    code: "CNY",
    symbol: "¥",
    name: "Chinese Yuan",
    locale: "zh-CN",
    exchangeRate: 7.24,
  },
  {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    locale: "en-AU",
    exchangeRate: 1.53,
  },
  {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    locale: "en-CA",
    exchangeRate: 1.36,
  },
  {
    code: "PEN",
    symbol: "S/",
    name: "Peruvian Sol",
    locale: "es-PE",
    exchangeRate: 3.75,
  },
  {
    code: "SAR",
    symbol: "﷼",
    name: "Saudi Riyal",
    locale: "ar-SA",
    exchangeRate: 3.75,
  },
  {
    code: "AED",
    symbol: "د.إ",
    name: "UAE Dirham",
    locale: "ar-AE",
    exchangeRate: 3.67,
  },
  {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    locale: "en-SG",
    exchangeRate: 1.34,
  },
  {
    code: "MYR",
    symbol: "RM",
    name: "Malaysian Ringgit",
    locale: "ms-MY",
    exchangeRate: 4.47,
  },
  {
    code: "THB",
    symbol: "฿",
    name: "Thai Baht",
    locale: "th-TH",
    exchangeRate: 35.5,
  },
  {
    code: "KRW",
    symbol: "₩",
    name: "South Korean Won",
    locale: "ko-KR",
    exchangeRate: 1320,
  },
  {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    locale: "en-ZA",
    exchangeRate: 18.5,
  },
  {
    code: "KES",
    symbol: "KSh",
    name: "Kenyan Shilling",
    locale: "en-KE",
    exchangeRate: 155,
  },
  {
    code: "NGN",
    symbol: "₦",
    name: "Nigerian Naira",
    locale: "en-NG",
    exchangeRate: 1550,
  },
  {
    code: "QAR",
    symbol: "ر.ق",
    name: "Qatari Riyal",
    locale: "ar-QA",
    exchangeRate: 3.64,
  },
  {
    code: "KWD",
    symbol: "د.ك",
    name: "Kuwaiti Dinar",
    locale: "ar-KW",
    exchangeRate: 0.31,
  },
  {
    code: "BHD",
    symbol: ".د.ب",
    name: "Bahraini Dinar",
    locale: "ar-BH",
    exchangeRate: 0.38,
  },
  {
    code: "OMR",
    symbol: "ر.ع.",
    name: "Omani Rial",
    locale: "ar-OM",
    exchangeRate: 0.38,
  },
];

type CurrencyChangeListener = (currency: Currency) => void;

interface CurrencyState {
  currency: Currency;
  setCurrency: (code: string) => void;
  formatPrice: (price: number) => string;
  subscribe: (listener: CurrencyChangeListener) => () => void;
  _listeners: Set<CurrencyChangeListener>;
}

const currencyChangeListeners = new Set<CurrencyChangeListener>();

let currencyStoreHydrationStarted = false;

/**
 * Currency Store with Zustand
 */
export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: CURRENCIES[0],
      _listeners: new Set<CurrencyChangeListener>(),

      setCurrency: (code: string) => {
        const normalized = String(code || "").toUpperCase();
        const currency =
          CURRENCIES.find((c) => c.code === normalized) ||
          ({
            code: normalized || "USD",
            symbol: normalized || "USD",
            name: normalized || "USD",
            locale: "en-US",
            exchangeRate: 1,
          } satisfies Currency);
        set({ currency });
        currencyChangeListeners.forEach((listener) => listener(currency));
      },

      formatPrice: (price: number) => {
        const { currency } = get();
        const isZeroDecimal = currency.code === "JPY" || currency.code === "KRW";
        return formatCurrency(price, currency.code, currency.locale, {
          minimumFractionDigits: isZeroDecimal ? 0 : 2,
          maximumFractionDigits: isZeroDecimal ? 0 : 2,
        });
      },

      subscribe: (listener: CurrencyChangeListener) => {
        currencyChangeListeners.add(listener);
        return () => {
          currencyChangeListeners.delete(listener);
        };
      },
    }),
    {
      name: "minimart-currency",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ currency: state.currency }),
      merge: (persistedState, currentState) => {
        const persistedCurrency = (persistedState as Partial<CurrencyState>)
          ?.currency;
        const normalizedCode = String(persistedCurrency?.code || "")
          .toUpperCase();
        const currency =
          CURRENCIES.find((c) => c.code === normalizedCode) ||
          currentState.currency;

        return { ...currentState, currency };
      },
    }
  )
);

export function useHydrateCurrencyStore() {
  React.useEffect(() => {
    if (
      currencyStoreHydrationStarted ||
      useCurrencyStore.persist.hasHydrated()
    ) {
      return;
    }

    currencyStoreHydrationStarted = true;
    void useCurrencyStore.persist.rehydrate();
  }, []);
}

/**
 * Hook to access currency functions
 */
export function useCurrency() {
  useHydrateCurrencyStore();
  const { currency, setCurrency, formatPrice, subscribe } = useCurrencyStore();
  const [, forceUpdate] = React.useState({});
  const currencyRef = React.useRef(currency);

  React.useEffect(() => {
    const unsubscribe = subscribe((newCurrency) => {
      if (currencyRef.current.code !== newCurrency.code) {
        currencyRef.current = newCurrency;
        forceUpdate({});
      }
    });
    return unsubscribe;
  }, [subscribe]);

  return {
    currency,
    currencies: CURRENCIES,
    setCurrency,
    formatPrice,
  };
}
