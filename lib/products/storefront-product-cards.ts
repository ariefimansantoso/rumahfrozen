import { unstable_cache } from "next/cache";
import { PRODUCT_STATUS } from "@/config/app.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB, mongoose } from "@/lib/db";
import { getStorefrontProductConstraint } from "@/lib/product-visibility";
import { Product } from "@/models";
import type { ModernProduct } from "@/components/products/modern-product-card";

type SortableProductCardField = "createdAt" | "price" | "rating" | "reviewCount";

export type StorefrontProductCardQuery = {
  limit?: number;
  ids?: string[];
  categoryIds?: string[];
  excludeIds?: string[];
  featured?: boolean;
  onSale?: boolean;
  status?: string;
  sortBy?: SortableProductCardField;
  sortOrder?: "asc" | "desc";
};

type ProductCardCategory = {
  _id?: string;
  name?: string;
  slug?: string;
};

export type StorefrontProductCard = ModernProduct & {
  category?: string | ProductCardCategory;
};

export const PRODUCT_CARD_SELECT = [
  "name",
  "title",
  "slug",
  "price",
  "comparePrice",
  "priceRange",
  "compareAtPriceRange",
  "images",
  "media",
  "rating",
  "reviewCount",
  "stock",
  "preorder",
  "featured",
  "status",
  "options",
  "variants",
  "createdAt",
  "vendorId",
  "category",
].join(" ");

function clampLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return 12;
  return Math.min(Math.max(Math.floor(limit || 12), 1), 48);
}

function buildSort(query: StorefrontProductCardQuery): Record<string, 1 | -1> {
  const direction = query.sortOrder === "asc" ? 1 : -1;

  if (query.sortBy === "price") return { price: direction };
  if (query.sortBy === "rating") return { rating: direction, reviewCount: -1 };
  if (query.sortBy === "reviewCount") {
    return { reviewCount: direction, rating: -1, createdAt: -1 };
  }

  return { createdAt: direction };
}

function serializeProducts(products: unknown[]): StorefrontProductCard[] {
  // Single JSON pass converts ObjectIds/Dates (including those nested in
  // variants/options/media) to JSON-safe primitives. The replacer drops the
  // `category` key when it serialized to null (unpopulated reference), avoiding
  // a second full mapping pass over the result.
  return JSON.parse(
    JSON.stringify(products, (key, value) =>
      key === "category" && value === null ? undefined : value,
    ),
  ) as StorefrontProductCard[];
}

export const getStorefrontProductCards = unstable_cache(
  async (
    query: StorefrontProductCardQuery = {},
  ): Promise<StorefrontProductCard[]> => {
    await connectDB();

    const limit = clampLimit(query.limit);
    const mongoQuery: Record<string, unknown> = {
      status: query.status || PRODUCT_STATUS.ACTIVE,
      ...(await getStorefrontProductConstraint()),
    };

    if (query.featured) {
      mongoQuery.featured = true;
    }

    if (query.onSale) {
      mongoQuery.$and = [
        ...((mongoQuery.$and as Record<string, unknown>[]) || []),
        {
          $expr: {
            $or: [
              { $gt: ["$comparePrice", "$price"] },
              {
                $anyElementTrue: {
                  $map: {
                    input: { $ifNull: ["$variants", []] },
                    as: "variant",
                    in: { $gt: ["$$variant.comparePrice", "$$variant.price"] },
                  },
                },
              },
            ],
          },
        },
      ];
    }

    if (query.ids !== undefined) {
      const ids = query.ids
        .map((value) => value.trim())
        .filter((value) => mongoose.isValidObjectId(value));

      if (ids.length === 0) return [];

      mongoQuery._id = { $in: ids };
    }

    if (query.categoryIds !== undefined) {
      const categoryIds = query.categoryIds
        .map((value) => value.trim())
        .filter((value) => mongoose.isValidObjectId(value));

      if (categoryIds.length === 0) return [];

      mongoQuery.category = { $in: categoryIds };
    }

    if (query.excludeIds?.length) {
      const excludeIds = query.excludeIds
        .map((value) => value.trim())
        .filter((value) => mongoose.isValidObjectId(value));

      if (excludeIds.length > 0) {
        const existingIdFilter =
          typeof mongoQuery._id === "object" && mongoQuery._id !== null
            ? (mongoQuery._id as Record<string, unknown>)
            : {};
        mongoQuery._id = { ...existingIdFilter, $nin: excludeIds };
      }
    }

    const products = await Product.find(mongoQuery)
      .select(PRODUCT_CARD_SELECT)
      .populate("vendorId", "storeName slug")
      .populate("category", "name slug")
      .sort(buildSort(query))
      .limit(limit)
      .lean();

    const serialized = serializeProducts(products);

    if (!query.ids?.length) return serialized;

    const order = new Map(query.ids.map((id, index) => [id, index]));
    return serialized.sort(
      (a, b) =>
        (order.get(a._id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b._id) ?? Number.MAX_SAFE_INTEGER),
    );
  },
  ["storefront-product-cards"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.products],
  },
);
