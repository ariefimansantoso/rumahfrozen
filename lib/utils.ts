import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { generateInternalEan13 } from "@/lib/barcode/standards"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncate a string to a maximum number of words, appending "..." when
 * the input exceeds the limit. Useful for fitting long product names
 * inside narrow UI panels (e.g. the POS checkout sidebar).
 *
 * @example
 * truncateByWords("Apple iPhone 15 Pro Max 256GB Blue Titanium", 5)
 * // => "Apple iPhone 15 Pro Max..."
 */
export function truncateByWords(text: string, maxWords: number): string {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

/**
 * Auto-generate a SKU from product title.
 * E.g. "Classic Cotton T-Shirt" → "CCT-8A3F"
 * Takes uppercase initials of each word + 4-char random hex suffix.
 */
export function generateSku(title: string): string {
  const cleaned = title.trim().replace(/[^a-zA-Z0-9\s]/g, "");
  const words = cleaned.split(/\s+/).filter(Boolean);

  let base: string;
  if (words.length >= 2) {
    // Take first letter of each word (up to 5)
    base = words
      .slice(0, 5)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  } else if (words.length === 1) {
    // Single word: take first 3 chars
    base = words[0].substring(0, 3).toUpperCase();
  } else {
    base = "PRD";
  }

  const suffix = Math.random().toString(16).substring(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

/**
 * Auto-generate a numeric internal-use EAN-13 Restricted Circulation Number.
 * It is suitable for this store's POS/inventory labels, not marketplace GTINs.
 */
export function generateBarcode(existingBarcodes: Iterable<string> = []): string {
  const used = new Set(existingBarcodes);

  for (let attempt = 0; attempt < 20; attempt++) {
    const barcode = generateInternalEan13();
    if (!used.has(barcode)) return barcode;
  }

  throw new Error("Unable to generate a unique internal barcode");
}
