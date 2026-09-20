import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import { Category } from "@/models";

export type StorefrontCategory = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  seo?: {
    pageTitle?: string;
    metaDescription?: string;
    tags?: string[];
  };
  parentId?: string | null;
  order: number;
  productCount: number;
  children: StorefrontCategory[];
};

export type StorefrontCategoryListQuery = {
  flat?: boolean;
  page?: number;
  limit?: number;
};

export type StorefrontCategoryListResult = {
  categories: StorefrontCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

const CATEGORY_FIELDS =
  "_id name slug description image icon seo parentId order productCount";

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && (value || 0) > 0 ? Math.floor(value!) : fallback;
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapCategory(category: {
  _id: unknown;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  seo?: {
    pageTitle?: string;
    metaDescription?: string;
    tags?: string[];
  };
  parentId?: unknown | null;
  order?: number;
  productCount?: number;
}): StorefrontCategory {
  return {
    _id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    icon: category.icon,
    seo: category.seo,
    parentId: category.parentId ? String(category.parentId) : null,
    order: typeof category.order === "number" ? category.order : 0,
    productCount:
      typeof category.productCount === "number" ? category.productCount : 0,
    children: [],
  };
}

function sortTree(nodes: StorefrontCategory[]) {
  nodes.sort((a, b) => {
    const orderDiff = a.order - b.order;
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
  nodes.forEach((node) => sortTree(node.children));
}

export const getStorefrontCategories = unstable_cache(
  async (
    query: StorefrontCategoryListQuery = {},
  ): Promise<StorefrontCategoryListResult> => {
    await connectDB();

    const page = normalizePositiveInteger(query.page, 1);
    const limit = Math.min(normalizePositiveInteger(query.limit, 20), 50);
    const categoryQuery = { isActive: true };

    if (query.flat) {
      const skip = (page - 1) * limit;
      const [categories, total] = await Promise.all([
        Category.find(categoryQuery)
          .select(CATEGORY_FIELDS)
          .sort({ order: 1, name: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Category.countDocuments(categoryQuery),
      ]);
      const totalPages = Math.ceil(total / limit);

      return serialize({
        categories: categories.map(mapCategory),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    }

    const categories = await Category.find(categoryQuery)
      .select(CATEGORY_FIELDS)
      .sort({ order: 1, name: 1 })
      .lean();
    const categoryMap = new Map<string, StorefrontCategory>();
    const roots: StorefrontCategory[] = [];

    categories.forEach((category) => {
      const node = mapCategory(category);
      categoryMap.set(node._id, node);
    });

    categoryMap.forEach((node) => {
      if (node.parentId) {
        const parent = categoryMap.get(node.parentId);
        if (parent) {
          parent.children.push(node);
          return;
        }
      }

      roots.push(node);
    });

    sortTree(roots);

    return serialize({
      categories: roots,
      pagination: {
        page: 1,
        limit: roots.length,
        total: roots.length,
        totalPages: roots.length > 0 ? 1 : 0,
        hasNext: false,
        hasPrev: false,
      },
    });
  },
  ["storefront-categories"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.categories, CACHE_TAGS.products],
  },
);

export const getStorefrontCategoryBySlug = unstable_cache(
  async (slug: string): Promise<StorefrontCategory | null> => {
    await connectDB();

    const category = await Category.findOne({ slug, isActive: true })
      .select(CATEGORY_FIELDS)
      .lean();

    return category ? serialize(mapCategory(category)) : null;
  },
  ["storefront-category-detail"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.categories, CACHE_TAGS.products],
  },
);
