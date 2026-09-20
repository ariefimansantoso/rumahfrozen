export const DEFAULT_STORE_NAME = "Storify";
export const DEFAULT_FAVICON_URL = "/favicon.svg";
export const DEFAULT_CURRENCY = "IDR";
export const DEFAULT_LANGUAGE = "id";
export const DEFAULT_TIMEZONE = "UTC";

export const DEFAULT_PRIMARY_COLOR = "#2065D1";
export const DEFAULT_SECONDARY_COLOR = "#8b5cf6";
export const DEFAULT_ACCENT_COLOR = "#f59e0b";
export const DEFAULT_PRESET_COLOR = "default";

export function resolveFaviconUrl(value?: string | null) {
  const faviconUrl = typeof value === "string" ? value.trim() : "";
  return faviconUrl && faviconUrl !== "/favicon.ico"
    ? faviconUrl
    : DEFAULT_FAVICON_URL;
}
