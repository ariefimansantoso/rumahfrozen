import { headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "@/config/i18n.config";

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part) => part.trim())
    .map((part) => part.split(";")[0]?.trim())
    .filter((part): part is string => Boolean(part));
}

export async function detectRequestLocale(): Promise<Locale> {
  const h = await headers();
  const acceptLanguage = h.get("accept-language") ?? "";
  const candidates = parseAcceptLanguage(acceptLanguage);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    const base = normalized.split("-")[0] ?? normalized;
    const match = locales.find((l) => l.toLowerCase() === normalized);
    if (match) return match as Locale;
    const baseMatch = locales.find((l) => l.toLowerCase() === base);
    if (baseMatch) return baseMatch as Locale;
  }

  return defaultLocale;
}

