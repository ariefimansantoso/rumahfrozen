"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: "class" | `data-${string}`;
  enableColorScheme?: boolean;
  enableSystem?: boolean;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme | ((theme: Theme) => Theme)) => void;
  systemTheme: ResolvedTheme;
  resolvedTheme: ResolvedTheme;
  themes: Theme[];
}

const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const THEME_CHANGE_EVENT = "minimart-theme-change";
const THEMES: Theme[] = ["light", "dark", "system"];

const ThemeContext = createContext<ThemeProviderState>({
  theme: "system",
  setTheme: () => undefined,
  systemTheme: "light",
  resolvedTheme: "light",
  themes: THEMES,
});

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MEDIA_QUERY).matches
  ) {
    return "dark";
  }

  return "light";
}

function getServerSystemTheme(): ResolvedTheme {
  return "light";
}

function readStoredTheme(storageKey: string, fallbackTheme: Theme): Theme {
  try {
    const storedTheme = localStorage.getItem(storageKey);
    return isTheme(storedTheme) ? storedTheme : fallbackTheme;
  } catch {
    return fallbackTheme;
  }
}

function subscribeSystemTheme(onStoreChange: () => void) {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function applyTheme(
  theme: ResolvedTheme,
  attribute: "class" | `data-${string}`,
  enableColorScheme: boolean,
) {
  const root = document.documentElement;

  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  } else {
    root.setAttribute(attribute, theme);
  }

  if (enableColorScheme) {
    root.style.colorScheme = theme;
  }
}

/**
 * Theme Provider
 * Provides dark/light/system mode without rendering a client-side script tag.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "minimart-theme",
  attribute = "class",
  enableColorScheme = true,
  enableSystem = true,
}: ThemeProviderProps) {
  const subscribeTheme = useCallback(
    (onStoreChange: () => void) => {
      const handleStoreChange = (event: Event) => {
        if (event instanceof StorageEvent && event.key !== storageKey) return;
        onStoreChange();
      };

      window.addEventListener("storage", handleStoreChange);
      window.addEventListener(THEME_CHANGE_EVENT, handleStoreChange);

      return () => {
        window.removeEventListener("storage", handleStoreChange);
        window.removeEventListener(THEME_CHANGE_EVENT, handleStoreChange);
      };
    },
    [storageKey],
  );

  const getThemeSnapshot = useCallback(
    () => readStoredTheme(storageKey, defaultTheme),
    [defaultTheme, storageKey],
  );

  const getServerThemeSnapshot = useCallback(
    () => defaultTheme,
    [defaultTheme],
  );

  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    getServerSystemTheme,
  );

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (enableSystem ? systemTheme : "light") : theme;

  const setTheme = useCallback(
    (value: Theme | ((theme: Theme) => Theme)) => {
      const currentTheme = readStoredTheme(storageKey, defaultTheme);
      const nextTheme =
        typeof value === "function" ? value(currentTheme) : value;

      try {
        localStorage.setItem(storageKey, nextTheme);
      } catch {
        // Ignore storage failures in private browsing or restricted contexts.
      }

      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    },
    [defaultTheme, storageKey],
  );

  useEffect(() => {
    applyTheme(resolvedTheme, attribute, enableColorScheme);
  }, [attribute, enableColorScheme, resolvedTheme]);

  const value = useMemo<ThemeProviderState>(
    () => ({
      theme,
      setTheme,
      systemTheme,
      resolvedTheme,
      themes: enableSystem ? THEMES : ["light", "dark"],
    }),
    [enableSystem, resolvedTheme, setTheme, systemTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook matching the subset of next-themes used by this app.
 */
export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Hook to access and control the current theme
 */
export function useAppTheme() {
  const { theme, setTheme, systemTheme, resolvedTheme, themes } = useTheme();

  return {
    theme,
    setTheme,
    systemTheme,
    resolvedTheme,
    themes,
    isDark: resolvedTheme === "dark",
    isLight: resolvedTheme === "light",
    isSystem: theme === "system",
    toggleTheme: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
  };
}
