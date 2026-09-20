import {
  CONTENT_PAGE_KEYS,
  CONTENT_PAGE_META,
  HEADER_APP_PAGE_OPTIONS,
} from "@/lib/content-pages-config";
import {
  MAX_MEGA_MENU_DEPTH,
  getMenuTreeMaxDepth,
  trimMenuTreeDepth,
} from "@/lib/menu-depth";

export type MenuItem = {
  _id?: string;
  label: string;
  url: string;
  type:
    | "custom"
    | "page"
    | "product"
    | "category"
    | "collection"
    | "brand"
    | "blog"
    | "blog-post"
    | "external";
  target: "_self" | "_blank";
  icon?: string;
  image?: string;
  description?: string;
  badge?: string;
  isFeatured?: boolean;
  isMegaColumn?: boolean;
  columnTitle?: string;
  children: MenuItem[];
};

export type CategoryMenuNode = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  children?: CategoryMenuNode[];
};

export type MenuLocation =
  | "header"
  | "header-mega"
  | "footer"
  | "mobile"
  | "sidebar"
  | "custom";

export interface MenuFormState {
  name: string;
  handle: string;
  location: MenuLocation;
  description: string;
  isActive: boolean;
  items: MenuItem[];
}

export const LOCATION_OPTIONS: { value: MenuLocation; label: string }[] = [
  { value: "header", label: "Header (main)" },
  { value: "header-mega", label: "Mega Menu" },
  { value: "footer", label: "Footer" },
  { value: "mobile", label: "Mobile" },
  { value: "sidebar", label: "Sidebar" },
  { value: "custom", label: "Custom" },
];

export function makeId() {
  return `tmp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function blankItem(): MenuItem {
  return {
    _id: makeId(),
    label: "New item",
    url: "/",
    type: "custom",
    target: "_self",
    children: [],
  };
}

function cleanOptionalString(value: unknown, maxLength?: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return typeof maxLength === "number" ? trimmed.slice(0, maxLength) : trimmed;
}

export function categoryToMenuItem(category: CategoryMenuNode): MenuItem {
  return {
    _id: makeId(),
    label: category.name,
    url: `/products?category=${encodeURIComponent(category.slug)}`,
    type: "category",
    target: "_self",
    icon: cleanOptionalString(category.icon),
    image: cleanOptionalString(category.image),
    description: cleanOptionalString(category.description, 280),
    children: (category.children || []).map(categoryToMenuItem),
  };
}

export function ensureChildren(arr: MenuItem[]): MenuItem[] {
  return arr.map((it) => ({ ...it, children: ensureChildren(it.children || []) }));
}

export type MenuStats = {
  total: number;
  topLevel: number;
  maxDepth: number;
  imageCount: number;
  promoCount: number;
  missingUrlCount: number;
};

export type ResourceOption = {
  id: string;
  label: string;
  url: string;
  type: MenuItem["type"];
  description?: string;
  image?: string;
  subtitle?: string;
};

export type CategorySyncDiff = {
  added: MenuItem[];
  removed: MenuItem[];
  changed: Array<{
    current: MenuItem;
    incoming: MenuItem;
    reason: string;
  }>;
  preserved: number;
};

export type PendingCategorySync = {
  items: MenuItem[];
  diff: CategorySyncDiff;
  trimmedCount: number;
};

export type StructureMode = "tree" | "mega";

export function pathKey(path: number[]) {
  return path.join(".");
}

export function pathsEqual(a: number[] | null, b: number[] | null) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function firstItemPath(items: MenuItem[]): number[] | null {
  return items.length > 0 ? [0] : null;
}

export function firstImageItemPath(items: MenuItem[], basePath: number[] = []): number[] | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const currentPath = [...basePath, index];
    if (item.image || item.icon) return currentPath;
    const childPath = firstImageItemPath(item.children || [], currentPath);
    if (childPath) return childPath;
  }
  return null;
}

export function getMenuStats(items: MenuItem[]): MenuStats {
  const stats: MenuStats = {
    total: 0,
    topLevel: items.length,
    maxDepth: 0,
    imageCount: 0,
    promoCount: 0,
    missingUrlCount: 0,
  };

  const walk = (nodes: MenuItem[], depth: number) => {
    for (const item of nodes) {
      stats.total += 1;
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      if (item.image || item.icon) stats.imageCount += 1;
      if (item.isFeatured) stats.promoCount += 1;
      if (!item.url?.trim()) stats.missingUrlCount += 1;
      walk(item.children || [], depth + 1);
    }
  };

  walk(items, 1);
  return stats;
}

export function getMegaMenuDepthWarning(items: MenuItem[]) {
  const maxDepth = getMenuTreeMaxDepth(items);
  if (maxDepth <= MAX_MEGA_MENU_DEPTH) return null;
  const { trimmedCount } = trimMenuTreeDepth(items, MAX_MEGA_MENU_DEPTH);
  return {
    maxDepth,
    trimmedCount,
  };
}

export function trimMegaMenuItems(
  items: MenuItem[],
  maxDepth = MAX_MEGA_MENU_DEPTH,
) {
  return trimMenuTreeDepth(items, maxDepth);
}

export function itemMatchesQuery(item: MenuItem, query: string): boolean {
  if (!query) return true;
  const haystack = [item.label, item.url, item.description, item.badge, item.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function itemOrDescendantMatches(item: MenuItem, query: string): boolean {
  return (
    itemMatchesQuery(item, query) ||
    (item.children || []).some((child) => itemOrDescendantMatches(child, query))
  );
}

export function flattenItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => [item, ...flattenItems(item.children || [])]);
}

export function resourceKey(item: MenuItem) {
  return `${item.type}:${item.url}`.toLowerCase();
}

export function buildItemIndex(items: MenuItem[]) {
  const index = new Map<string, MenuItem>();
  for (const item of flattenItems(items)) {
    if (item.url) index.set(resourceKey(item), item);
  }
  return index;
}

export function mergeGeneratedCategoryItem(
  item: MenuItem,
  currentByResource: Map<string, MenuItem>,
): MenuItem {
  const current = currentByResource.get(resourceKey(item));
  const currentImage = current?.image?.trim() || "";
  const currentIcon = current?.icon?.trim() || "";
  const incomingIcon = item.icon?.trim() || "";
  const preservedImage =
    currentImage && currentImage !== currentIcon && currentImage !== incomingIcon
      ? currentImage
      : item.image;

  return {
    ...item,
    _id: current?._id || item._id,
    target: current?.target || item.target,
    image: preservedImage,
    icon: current?.icon || item.icon,
    badge: current?.badge || item.badge,
    isFeatured: current?.isFeatured || item.isFeatured,
    isMegaColumn: current?.isMegaColumn || item.isMegaColumn,
    columnTitle: current?.columnTitle || item.columnTitle,
    description: item.description || current?.description,
    children: (item.children || []).map((child) =>
      mergeGeneratedCategoryItem(child, currentByResource),
    ),
  };
}

export function buildCategorySyncDiff(
  currentItems: MenuItem[],
  generatedItems: MenuItem[],
): CategorySyncDiff {
  const currentCategoryItems = flattenItems(currentItems).filter(
    (item) => item.type === "category" && item.url,
  );
  const generatedCategoryItems = flattenItems(generatedItems).filter(
    (item) => item.type === "category" && item.url,
  );
  const currentByResource = buildItemIndex(currentCategoryItems);
  const generatedByResource = buildItemIndex(generatedCategoryItems);

  const added = generatedCategoryItems.filter(
    (item) => !currentByResource.has(resourceKey(item)),
  );
  const removed = currentCategoryItems.filter(
    (item) => !generatedByResource.has(resourceKey(item)),
  );
  const changed = generatedCategoryItems.flatMap((incoming) => {
    const current = currentByResource.get(resourceKey(incoming));
    if (!current) return [];
    const reasons = [
      current.label !== incoming.label ? "label" : "",
      (current.description || "") !== (incoming.description || "")
        ? "description"
        : "",
      (current.image || current.icon || "") !== (incoming.image || incoming.icon || "")
        ? "image"
        : "",
    ].filter(Boolean);
    return reasons.length > 0 ? [{ current, incoming, reason: reasons.join(", ") }] : [];
  });

  return {
    added,
    removed,
    changed,
    preserved: generatedCategoryItems.length - added.length - changed.length,
  };
}

export function remapPathAfterReorder(
  currentPath: number[] | null,
  parentPath: number[],
  fromIndex: number,
  toIndex: number,
) {
  if (!currentPath) return currentPath;
  if (currentPath.length < parentPath.length + 1) return currentPath;
  if (!pathsEqual(currentPath.slice(0, parentPath.length), parentPath)) {
    return currentPath;
  }
  const currentIndex = currentPath[parentPath.length];
  if (currentIndex === fromIndex) {
    return [
      ...parentPath,
      toIndex,
      ...currentPath.slice(parentPath.length + 1),
    ];
  }
  if (fromIndex < toIndex && currentIndex > fromIndex && currentIndex <= toIndex) {
    return [
      ...parentPath,
      currentIndex - 1,
      ...currentPath.slice(parentPath.length + 1),
    ];
  }
  if (fromIndex > toIndex && currentIndex >= toIndex && currentIndex < fromIndex) {
    return [
      ...parentPath,
      currentIndex + 1,
      ...currentPath.slice(parentPath.length + 1),
    ];
  }
  return currentPath;
}

export function getMegaLayoutRole(depth: number, isFeatured?: boolean) {
  if (isFeatured) return "Promo panel";
  if (depth <= 1) return "Trigger";
  if (depth === 2) return "Column / group";
  if (depth === MAX_MEGA_MENU_DEPTH) return "Final link";
  return "Too deep";
}

export function getMegaLayoutAddLabel(depth: number) {
  if (depth <= 0) return "Add trigger";
  if (depth === 1) return "Add group";
  if (depth >= MAX_MEGA_MENU_DEPTH) return "Max depth reached";
  return "Add link";
}

export function getMegaLayoutFieldLabel(depth: number, isFeatured?: boolean) {
  if (isFeatured) return "Promo label";
  if (depth <= 1) return "Trigger label";
  if (depth === 2) return "Group label";
  if (depth > MAX_MEGA_MENU_DEPTH) return "Hidden label";
  return "Link label";
}

export interface Props {
  menuId?: string;
}

export function pathToItem(items: MenuItem[], path: number[]): MenuItem | null {
  let current: MenuItem | undefined;
  let arr = items;
  for (const idx of path) {
    current = arr[idx];
    if (!current) return null;
    arr = current.children || [];
  }
  return current ?? null;
}

export function replaceAtPath(items: MenuItem[], path: number[], updated: MenuItem) {
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  const arr =
    parentPath.length === 0 ? items : pathToItem(items, parentPath)?.children;
  if (arr) arr[idx] = updated;
}

export function stripTempIds(items: MenuItem[]): MenuItem[] {
  return items.map((it) => {
    const { _id, children, ...rest } = it;
    const cleaned: MenuItem = {
      ...rest,
      children: stripTempIds(children || []),
    };
    if (_id && !_id.startsWith("tmp_")) cleaned._id = _id;
    return cleaned;
  });
}

export function getApiItems(data: unknown): Array<Record<string, unknown>> {
  const payload = data as {
    data?: Array<Record<string, unknown>> | { data?: Array<Record<string, unknown>> };
  };
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

export function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function getFirstImage(item: Record<string, unknown>) {
  const direct = getString(item.image) || getString(item.logo) || getString(item.featuredImage);
  if (direct) return direct;
  const images = item.images;
  if (Array.isArray(images)) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const record = first as Record<string, unknown>;
      return getString(record.url) || getString(record.thumbnailUrl);
    }
  }
  const media = item.media;
  if (Array.isArray(media)) {
    const first = media[0];
    if (first && typeof first === "object") {
      const record = first as Record<string, unknown>;
      return getString(record.url) || getString(record.thumbnailUrl);
    }
  }
  return "";
}

export function buildPageResourceOptions(): ResourceOption[] {
  const appPages = HEADER_APP_PAGE_OPTIONS.map((page) => ({
    id: `app:${page.publicPath}`,
    label: page.label,
    url: page.publicPath,
    type: "page" as const,
    description: page.keywords.join(", "),
    subtitle: "Storefront page",
  }));
  const standardPages = CONTENT_PAGE_KEYS.map((key) => {
    const meta = CONTENT_PAGE_META[key];
    return {
      id: `standard:${key}`,
      label: meta.adminTitle,
      url: meta.publicPath,
      type: "page" as const,
      description: meta.description,
      subtitle: "Content page",
    };
  });
  return [...appPages, ...standardPages];
}

export function normalizeResourceOption(
  type: MenuItem["type"],
  item: Record<string, unknown>,
): ResourceOption | null {
  const id = getString(item._id) || getString(item.id);
  const title = getString(item.title) || getString(item.name);
  const seo =
    item.seo && typeof item.seo === "object"
      ? (item.seo as Record<string, unknown>)
      : {};
  const slug = getString(item.slug) || getString(item.handle) || getString(seo.handle);
  const description = getString(item.description) || getString(item.excerpt);
  const image = getFirstImage(item);

  if (!title && !slug) return null;

  if (type === "category") {
    const categorySlug = slug || id;
    return {
      id: id || categorySlug,
      label: title || categorySlug,
      url: `/products?category=${encodeURIComponent(categorySlug)}`,
      type,
      description,
      image,
      subtitle: "Category",
    };
  }
  if (type === "collection") {
    const collectionSlug = slug || id;
    return {
      id: id || collectionSlug,
      label: title || collectionSlug,
      url: `/collections/${collectionSlug}`,
      type,
      description,
      image,
      subtitle: "Collection",
    };
  }
  if (type === "product") {
    const productSlug = slug || id;
    return {
      id: id || productSlug,
      label: title || productSlug,
      url: `/products/${productSlug}`,
      type,
      description,
      image,
      subtitle: "Product",
    };
  }
  if (type === "brand") {
    const brandSlug = slug || id;
    return {
      id: id || brandSlug,
      label: title || brandSlug,
      url: `/brands/${brandSlug}`,
      type,
      description,
      image,
      subtitle: "Brand",
    };
  }
  if (type === "blog-post") {
    const postSlug = slug || id;
    return {
      id: id || postSlug,
      label: title || postSlug,
      url: `/blog/${postSlug}`,
      type,
      description,
      image,
      subtitle: "Blog post",
    };
  }
  return null;
}

export function getResourceEndpoint(type: MenuItem["type"], query: string) {
  const encodedQuery = encodeURIComponent(query);
  if (type === "category") {
    return `/api/categories?flat=true&status=active${query ? `&search=${encodedQuery}` : ""}`;
  }
  if (type === "brand") {
    return `/api/brands?limit=30&status=active${query ? `&search=${encodedQuery}` : ""}`;
  }
  if (type === "collection") return "/api/collections?limit=50";
  if (type === "product") {
    return `/api/products?limit=30${query ? `&search=${encodedQuery}` : ""}`;
  }
  if (type === "blog-post") {
    return `/api/blog-posts?limit=30&status=published${query ? `&search=${encodedQuery}` : ""}`;
  }
  return "";
}

export function findFeaturedItem(items: MenuItem[]): MenuItem | null {
  for (const item of items) {
    if (item.isFeatured && (item.image || item.icon)) return item;
    const child = findFeaturedItem(item.children || []);
    if (child) return child;
  }
  return null;
}

export function findFirstImageItem(items: MenuItem[]): MenuItem | null {
  for (const item of items) {
    if (item.image || item.icon) return item;
    const child = findFirstImageItem(item.children || []);
    if (child) return child;
  }
  return null;
}

export function getPreviewItemKey(item?: MenuItem | null) {
  if (!item) return null;
  return `${item.url}::${item.label}`;
}

export function getVisiblePreviewChildren(item?: MenuItem | null) {
  return (item?.children || []).filter((child) => child.label.trim());
}

export function flattenVisiblePreviewItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => {
    const children = getVisiblePreviewChildren(item);
    return [item, ...flattenVisiblePreviewItems(children)];
  });
}

export function findFirstPreviewFeature(items: MenuItem[]) {
  const visibleItems = flattenVisiblePreviewItems(items);
  return visibleItems.find((item) => item.image || item.icon) || visibleItems[0];
}

export function getPreviewPromoImage(item?: MenuItem | null) {
  const image = item?.image?.trim() || "";
  const icon = item?.icon?.trim() || "";
  return image && image !== icon ? image : "";
}
