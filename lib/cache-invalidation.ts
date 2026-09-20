import { revalidatePath, revalidateTag } from "next/cache";
import { locales } from "@/config/i18n.config";

export const CACHE_TAGS = {
  blogCategories: "blog-categories",
  blogPosts: "blog-posts",
  brands: "brands",
  categories: "categories",
  collections: "collections",
  menus: "menus",
  products: "products",
  settings: "settings",
} as const;

type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

const IMMEDIATE_REVALIDATION = { expire: 0 } as const;

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function revalidateCacheTags(tags: CacheTag[]) {
  for (const tag of new Set(tags)) {
    revalidateTag(tag, IMMEDIATE_REVALIDATION);
  }
}

export function revalidateLocalizedPaths(
  paths: Array<string | null | undefined>,
  type: "page" | "layout" = "page",
) {
  for (const path of uniqueStrings(paths).map(normalizePath)) {
    for (const locale of locales) {
      revalidatePath(path === "/" ? `/${locale}` : `/${locale}${path}`, type);
    }
  }
}

export function revalidateStorefrontLayouts() {
  for (const locale of locales) {
    revalidatePath(`/${locale}`, "layout");
  }
}

export function revalidateProductContent(options?: {
  slugs?: Array<string | null | undefined>;
}) {
  revalidateCacheTags([
    CACHE_TAGS.products,
    CACHE_TAGS.collections,
    CACHE_TAGS.categories,
    CACHE_TAGS.brands,
  ]);

  revalidateLocalizedPaths([
    "/",
    "/products",
    ...(options?.slugs || []).map((slug) =>
      slug ? `/products/${slug}` : undefined,
    ),
  ]);
}

export function revalidateSettingsContent() {
  revalidateCacheTags([CACHE_TAGS.settings]);
  revalidateStorefrontLayouts();
}

export function revalidateMenuContent() {
  revalidateCacheTags([CACHE_TAGS.menus]);
  revalidateStorefrontLayouts();
}

export function revalidateCategoryContent(options?: {
  slugs?: Array<string | null | undefined>;
}) {
  revalidateCacheTags([
    CACHE_TAGS.categories,
    CACHE_TAGS.products,
    CACHE_TAGS.collections,
  ]);
  revalidateLocalizedPaths([
    "/",
    "/products",
    "/categories",
    "/collections",
    ...(options?.slugs || []).map((slug) =>
      slug ? `/categories/${slug}` : undefined,
    ),
  ]);
}

export function revalidateBrandContent(options?: {
  slugs?: Array<string | null | undefined>;
}) {
  revalidateCacheTags([CACHE_TAGS.brands, CACHE_TAGS.products]);
  revalidateLocalizedPaths([
    "/",
    "/brands",
    "/products",
    ...(options?.slugs || []).map((slug) =>
      slug ? `/brands/${slug}` : undefined,
    ),
  ]);
}

export function revalidateCollectionContent(options?: {
  slugs?: Array<string | null | undefined>;
}) {
  revalidateCacheTags([CACHE_TAGS.collections, CACHE_TAGS.products]);
  revalidateLocalizedPaths([
    "/",
    "/collections",
    ...(options?.slugs || []).map((slug) =>
      slug ? `/collections/${slug}` : undefined,
    ),
  ]);
}

export function revalidateBlogContent(options?: {
  slugs?: Array<string | null | undefined>;
}) {
  revalidateCacheTags([CACHE_TAGS.blogPosts, CACHE_TAGS.blogCategories]);
  revalidateLocalizedPaths([
    "/blog",
    ...(options?.slugs || []).map((slug) => (slug ? `/blog/${slug}` : undefined)),
  ]);
}
