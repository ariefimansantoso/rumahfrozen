const PRODUCT_SEARCH_FIELDS = [
  "name",
  "title",
  "slug",
  "handle",
  "sku",
  "barcode",
  "productType",
  "tags",
  "shortDescription",
  "description",
  "attributes.name",
  "attributes.value",
  "variants.name",
  "variants.sku",
  "variants.barcode",
  "variants.attributes.name",
  "variants.attributes.value",
  "variants.optionValues.value",
  "options.name",
  "options.values.value",
  "seo.pageTitle",
  "seo.metaDescription",
  "seo.handle",
] as const;

const MAX_SEARCH_LENGTH = 100;
const MAX_SEARCH_TOKENS = 8;

// Bidirectional synonym groups. Tokens are normalized lower-case; each token in a group
// expands to all sibling tokens (joined by space) so MongoDB $text widens the OR-match.
// Keep groups small and high-signal — overly broad groups dilute relevance.
const SYNONYM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ["shoe", "shoes", "sneaker", "sneakers", "trainer", "trainers", "footwear"],
  ["phone", "phones", "mobile", "smartphone", "smartphones", "cellphone"],
  ["laptop", "laptops", "notebook", "notebooks", "ultrabook"],
  ["tv", "television", "televisions"],
  ["headphone", "headphones", "earphone", "earphones", "earbuds", "earbud"],
  ["tshirt", "t-shirt", "tee", "tees"],
  ["hoodie", "hoodies", "sweatshirt", "sweatshirts"],
  ["jacket", "jackets", "coat", "coats"],
  ["bag", "bags", "backpack", "backpacks", "rucksack"],
  ["watch", "watches", "smartwatch", "smartwatches"],
  ["sofa", "couch", "couches", "sofas"],
  ["fridge", "refrigerator", "refrigerators"],
  ["bike", "bikes", "bicycle", "bicycles", "cycle"],
  ["pant", "pants", "trouser", "trousers"],
];

const SYNONYM_MAP: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const token of group) {
      const siblings = group.filter((sibling) => sibling !== token);
      map.set(token, siblings);
    }
  }
  return map;
})();

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeProductSearchInput(search?: string | null): string {
  return (search || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_SEARCH_LENGTH);
}

export function tokenizeProductSearch(search?: string | null): string[] {
  const normalized = normalizeProductSearchInput(search);
  if (!normalized) return [];

  const tokens = normalized
    .split(/[\s,/\\|+._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const usefulTokens = tokens.filter((token) => token.length >= 2);
  const finalTokens = usefulTokens.length > 0 ? usefulTokens : tokens;

  return Array.from(new Set(finalTokens)).slice(0, MAX_SEARCH_TOKENS);
}

// Scaling note: case-insensitive unanchored $regex cannot use B-tree indexes,
// so every token scans candidate documents across all fields below. This is
// fine at catalog sizes in the hundreds-to-thousands; at tens of thousands of
// products, move the main search endpoints to the $text index that already
// exists on Product (name/title/description/tags) or to Atlas Search, and keep
// regex only for the substring-match fields ($text is word-based).
export function buildProductSearchQuery(
  search?: string | null,
): Record<string, unknown> | null {
  const tokens = tokenizeProductSearch(search);
  if (tokens.length === 0) return null;

  return {
    $and: tokens.map((token) => {
      const escapedToken = escapeRegexLiteral(token);

      return {
        $or: PRODUCT_SEARCH_FIELDS.map((field) => ({
          [field]: { $regex: escapedToken, $options: "i" },
        })),
      };
    }),
  };
}

function expandTokenWithSynonyms(token: string): string[] {
  const expanded = new Set<string>([token]);
  const siblings = SYNONYM_MAP.get(token.toLowerCase());
  if (siblings) for (const sibling of siblings) expanded.add(sibling);
  return Array.from(expanded);
}

// Regex-based query used by the sales agent. Each tokenized term is expanded
// with synonyms (shoes ↔ sneaker ↔ trainer ↔ footwear) and OR-matched across
// all searchable product fields. Tokens themselves are AND'd, so "running
// shoes" requires BOTH a running-ish term AND a shoe-ish term to be present.
// Does not depend on a MongoDB text index — works on any collection state.
export function buildProductAgentSearch(
  search?: string | null,
): Record<string, unknown> | null {
  const tokens = tokenizeProductSearch(search);
  if (tokens.length === 0) return null;

  return {
    $and: tokens.map((token) => ({
      $or: expandTokenWithSynonyms(token).flatMap((term) => {
        const escaped = escapeRegexLiteral(term);
        return PRODUCT_SEARCH_FIELDS.map((field) => ({
          [field]: { $regex: escaped, $options: "i" },
        }));
      }),
    })),
  };
}

// Compute a relevance score so callers can rank candidates in-app. Name and
// tag matches weigh heaviest because they're the strongest intent signal;
// description matches are weakest because product descriptions are noisy.
export function scoreProductRelevance(
  product: {
    name?: string;
    title?: string;
    tags?: string[];
    shortDescription?: string;
    description?: string;
    category?: { name?: string };
  },
  search?: string | null,
): number {
  const tokens = tokenizeProductSearch(search);
  if (tokens.length === 0) return 0;

  const name = (product.name || product.title || "").toLowerCase();
  const tags = (product.tags || []).map((tag) => tag.toLowerCase());
  const categoryName = (product.category?.name || "").toLowerCase();
  const short = (product.shortDescription || "").toLowerCase();
  const desc = (product.description || "")
    .replace(/<[^>]*>/g, " ")
    .toLowerCase();

  let score = 0;
  for (const token of tokens) {
    const variants = expandTokenWithSynonyms(token).map((value) =>
      value.toLowerCase(),
    );
    for (const variant of variants) {
      const isOriginal = variant === token.toLowerCase();
      const weight = isOriginal ? 1 : 0.6;
      if (name.includes(variant)) score += 10 * weight;
      if (tags.some((tag) => tag.includes(variant))) score += 6 * weight;
      if (categoryName.includes(variant)) score += 4 * weight;
      if (short.includes(variant)) score += 2 * weight;
      else if (desc.includes(variant)) score += 1 * weight;
    }
  }
  return score;
}
