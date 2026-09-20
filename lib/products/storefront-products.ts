import { unstable_cache } from "next/cache";
import { PRODUCT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB, mongoose } from "@/lib/db";
import { STOREFRONT_BRAND_FILTER } from "@/lib/brands";
import { getStorefrontProductConstraint } from "@/lib/product-visibility";
import { PRODUCT_CARD_SELECT } from "@/lib/products/storefront-product-cards";
import { buildProductSearchQuery } from "@/lib/products/search";
import { Brand, Category, Collection, Product, Vendor } from "@/models";

export type StorefrontProductsQuery = {
  page?: number | string | null;
  limit?: number | string | null;
  vendor?: string | null;
  tag?: string | null;
  search?: string | null;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  status?: string | null;
  featured?: boolean | string | null;
  preorder?: boolean | string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
  category?: string | string[] | null;
  collection?: string | string[] | null;
  brand?: string | string[] | null;
  onSale?: boolean | string | null;
  ids?: string | string[] | null;
  minRating?: number | string | null;
  inStock?: boolean | string | null;
  /**
   * When true, only the fields needed to render a product card are fetched
   * (see PRODUCT_CARD_SELECT). Storefront grids set this to avoid pulling the
   * full document (description, seo, shipping, etc.). The public API leaves it
   * off so its response contract stays complete.
   */
  cardFieldsOnly?: boolean | null;
};

export type StorefrontProductsResult<T = unknown> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type NormalizedStorefrontProductsQuery = {
  page: number;
  limit: number;
  vendor?: string;
  tag?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  status: string;
  featured?: boolean;
  preorder?: boolean;
  sortBy: string;
  sortOrder?: string;
  categoryValues: string[];
  collectionValues: string[];
  brandValues: string[];
  onSale?: boolean;
  ids?: string[];
  minRating?: string;
  inStock?: boolean;
  cardFieldsOnly: boolean;
};

function buildPreorderExpression(now: Date) {
  const preorderOpenExpr = (path: string) => ({
    $and: [
      { $eq: [`$${path}.enabled`, true] },
      {
        $or: [
          { $eq: [`$${path}.autoConvert`, false] },
          { $eq: [{ $ifNull: [`$${path}.releaseDate`, null] }, null] },
          { $gte: [`$${path}.releaseDate`, now] },
        ],
      },
      {
        $or: [
          { $lte: [{ $ifNull: [`$${path}.limit`, 0] }, 0] },
          {
            $lt: [
              { $ifNull: [`$${path}.reservedQuantity`, 0] },
              { $ifNull: [`$${path}.limit`, 0] },
            ],
          },
        ],
      },
    ],
  });

  const variantPreorderOpenExpr = {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ["$variants", []] },
        as: "variant",
        in: {
          $and: [
            { $eq: ["$$variant.preorder.enabled", true] },
            {
              $or: [
                { $eq: ["$$variant.preorder.autoConvert", false] },
                {
                  $eq: [
                    { $ifNull: ["$$variant.preorder.releaseDate", null] },
                    null,
                  ],
                },
                { $gte: ["$$variant.preorder.releaseDate", now] },
              ],
            },
            {
              $or: [
                {
                  $lte: [
                    { $ifNull: ["$$variant.preorder.limit", 0] },
                    0,
                  ],
                },
                {
                  $lt: [
                    {
                      $ifNull: ["$$variant.preorder.reservedQuantity", 0],
                    },
                    { $ifNull: ["$$variant.preorder.limit", 0] },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  };

  return {
    $or: [preorderOpenExpr("preorder"), variantPreorderOpenExpr],
  };
}

function parsePositiveInteger(
  value: number | string | null | undefined,
  fallback: number,
) {
  const parsed =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeBoolean(value: boolean | string | null | undefined) {
  return value === true || value === "true";
}

function normalizeOptionalString(value: number | string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeValues(value: string | string[] | null | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeQuery(
  query: StorefrontProductsQuery = {},
): NormalizedStorefrontProductsQuery {
  const ids =
    query.ids === null || query.ids === undefined
      ? undefined
      : normalizeValues(query.ids);

  return {
    page: parsePositiveInteger(query.page, 1),
    limit: parsePositiveInteger(query.limit, 12),
    vendor: normalizeOptionalString(query.vendor),
    tag: normalizeOptionalString(query.tag),
    search: normalizeOptionalString(query.search),
    minPrice: normalizeOptionalString(query.minPrice),
    maxPrice: normalizeOptionalString(query.maxPrice),
    status: normalizeOptionalString(query.status) || PRODUCT_STATUS.ACTIVE,
    featured: normalizeBoolean(query.featured) || undefined,
    preorder: normalizeBoolean(query.preorder) || undefined,
    sortBy: normalizeOptionalString(query.sortBy) || "createdAt",
    sortOrder: normalizeOptionalString(query.sortOrder),
    categoryValues: normalizeValues(query.category),
    collectionValues: normalizeValues(query.collection),
    brandValues: normalizeValues(query.brand),
    onSale: normalizeBoolean(query.onSale) || undefined,
    ids,
    minRating: normalizeOptionalString(query.minRating),
    inStock: normalizeBoolean(query.inStock) || undefined,
    cardFieldsOnly: normalizeBoolean(query.cardFieldsOnly),
  };
}

function buildSort(
  query: NormalizedStorefrontProductsQuery,
): Record<string, 1 | -1> {
  const sort: Record<string, 1 | -1> = {};

  if (query.sortBy === "price-asc") sort.price = 1;
  else if (query.sortBy === "price-desc") sort.price = -1;
  else if (query.sortBy === "rating") {
    sort.rating = -1;
    sort.reviewCount = -1;
  } else if (query.sortBy === "popular") {
    sort.reviewCount = -1;
    sort.rating = -1;
    sort.createdAt = -1;
  } else if (query.sortBy === "preorder-release") {
    sort["preorder.releaseDate"] = query.sortOrder === "desc" ? -1 : 1;
    sort.createdAt = -1;
  } else if (query.sortBy === "preorder-reserved") {
    sort["preorder.reservedQuantity"] = -1;
    sort.createdAt = -1;
  } else if (query.sortBy === "price") {
    sort.price = query.sortOrder === "asc" ? 1 : -1;
  } else if (query.sortBy === "createdAt") {
    sort.createdAt = query.sortOrder === "asc" ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }

  return sort;
}

function emptyResult<T = unknown>(
  page: number,
  limit: number,
): StorefrontProductsResult<T> {
  return {
    data: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: page > 1,
    },
  };
}

function serializeResult<T>(
  result: StorefrontProductsResult<T>,
): StorefrontProductsResult<T> {
  return JSON.parse(JSON.stringify(result)) as StorefrontProductsResult<T>;
}

function splitObjectIdsAndSlugs(values: string[]) {
  const ids: string[] = [];
  const slugs: string[] = [];

  for (const value of values) {
    if (mongoose.isValidObjectId(value)) {
      ids.push(value);
    } else {
      slugs.push(value.toLowerCase());
    }
  }

  return { ids, slugs };
}

async function resolveCategoryIds(values: string[]) {
  const { ids, slugs } = splitObjectIdsAndSlugs(values);
  const docs =
    slugs.length > 0
      ? await Category.find({ slug: { $in: slugs } }).select("_id").lean()
      : [];

  return [...ids, ...docs.map((doc) => String(doc._id))];
}

async function resolveCollectionIds(values: string[]) {
  const { ids, slugs } = splitObjectIdsAndSlugs(values);
  const docs =
    slugs.length > 0
      ? await Collection.find({ slug: { $in: slugs }, status: "active" })
          .select("_id")
          .lean()
      : [];

  return [...ids, ...docs.map((doc) => String(doc._id))];
}

async function resolveBrandIds(values: string[]) {
  const { ids, slugs } = splitObjectIdsAndSlugs(values);
  const docs =
    slugs.length > 0
      ? await Brand.find({ slug: { $in: slugs }, ...STOREFRONT_BRAND_FILTER })
          .select("_id")
          .lean()
      : [];

  return [...ids, ...docs.map((doc) => String(doc._id))];
}

const getStorefrontProductsCached = unstable_cache(
  async (
    query: NormalizedStorefrontProductsQuery,
  ): Promise<StorefrontProductsResult> => {
    await connectDB();

    const skip = (query.page - 1) * query.limit;
    const sort = buildSort(query);
    const mongoQuery: Record<string, unknown> = {
      status: query.status,
      ...(await getStorefrontProductConstraint()),
    };

    if (query.categoryValues.length > 0) {
      const categoryIds = await resolveCategoryIds(query.categoryValues);

      if (categoryIds.length === 0) {
        return emptyResult(query.page, query.limit);
      }

      mongoQuery.category = { $in: categoryIds };
    }

    if (query.collectionValues.length > 0) {
      const collectionIds = await resolveCollectionIds(query.collectionValues);

      if (collectionIds.length === 0) {
        return emptyResult(query.page, query.limit);
      }

      mongoQuery.collectionIds = { $in: collectionIds };
    }

    if (query.brandValues.length > 0) {
      const brandIds = await resolveBrandIds(query.brandValues);

      if (brandIds.length === 0) {
        return emptyResult(query.page, query.limit);
      }

      mongoQuery.brand = { $in: brandIds };
    }

    if (query.vendor) {
      const vendorQuery = mongoose.isValidObjectId(query.vendor)
        ? { _id: query.vendor, status: VENDOR_STATUS.APPROVED }
        : { slug: query.vendor.toLowerCase(), status: VENDOR_STATUS.APPROVED };

      const vendorDoc = await Vendor.findOne(vendorQuery).select("_id").lean();

      if (!vendorDoc) {
        return emptyResult(query.page, query.limit);
      }

      mongoQuery.vendorId = vendorDoc._id;
    }

    if (query.tag) {
      mongoQuery.tags = query.tag;
    }

    const searchQuery = buildProductSearchQuery(query.search);
    if (searchQuery) {
      mongoQuery.$and = [
        ...((mongoQuery.$and as Record<string, unknown>[]) || []),
        searchQuery,
      ];
    }

    if (query.minPrice || query.maxPrice) {
      const parsedMinPrice = query.minPrice
        ? parseFloat(query.minPrice)
        : undefined;
      const parsedMaxPrice = query.maxPrice
        ? parseFloat(query.maxPrice)
        : undefined;
      const productPriceCondition: Record<string, number> = {};
      const variantPriceCondition: Record<string, number> = {};

      if (
        typeof parsedMinPrice === "number" &&
        Number.isFinite(parsedMinPrice)
      ) {
        productPriceCondition.$gte = parsedMinPrice;
        variantPriceCondition.$gte = parsedMinPrice;
      }
      if (
        typeof parsedMaxPrice === "number" &&
        Number.isFinite(parsedMaxPrice)
      ) {
        productPriceCondition.$lte = parsedMaxPrice;
        variantPriceCondition.$lte = parsedMaxPrice;
      }

      if (Object.keys(productPriceCondition).length > 0) {
        mongoQuery.$and = [
          ...((mongoQuery.$and as Record<string, unknown>[]) || []),
          {
            $or: [
              { variants: { $elemMatch: { price: variantPriceCondition } } },
              {
                $and: [
                  {
                    $or: [
                      { variants: { $exists: false } },
                      { variants: { $size: 0 } },
                    ],
                  },
                  { price: productPriceCondition },
                ],
              },
            ],
          },
        ];
      }
    }

    if (query.featured) {
      mongoQuery.featured = true;
    }

    if (query.preorder) {
      mongoQuery.$and = [
        ...((mongoQuery.$and as Record<string, unknown>[]) || []),
        { $expr: buildPreorderExpression(new Date()) },
      ];
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
                    as: "v",
                    in: { $gt: ["$$v.comparePrice", "$$v.price"] },
                  },
                },
              },
            ],
          },
        },
      ];
    }

    if (query.ids !== undefined) {
      const ids = query.ids.filter((value) => mongoose.isValidObjectId(value));

      if (ids.length === 0) {
        return emptyResult(query.page, query.limit);
      }

      mongoQuery._id = { $in: ids };
    }

    if (query.minRating) {
      mongoQuery.rating = { $gte: parseFloat(query.minRating) };
    }

    if (query.inStock) {
      mongoQuery.stock = { $gt: 0 };
    }

    const productsQuery = Product.find(mongoQuery)
      .populate("vendorId", "storeName slug logo")
      .populate("category", "name slug");

    if (query.cardFieldsOnly) {
      // Card grids never render brand, so we both skip the projection field and
      // the populate. (Populating an unselected path makes Mongoose re-add it to
      // the projection and still run the brand lookup — wasteful here.)
      productsQuery.select(PRODUCT_CARD_SELECT);
    } else {
      productsQuery.populate("brand", "name slug logo");
    }

    const [products, total] = await Promise.all([
      productsQuery.sort(sort).skip(skip).limit(query.limit).lean(),
      Product.countDocuments(mongoQuery),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return serializeResult({
      data: products,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    });
  },
  ["storefront-products"],
  {
    revalidate: 60,
    tags: [
      CACHE_TAGS.products,
      CACHE_TAGS.categories,
      CACHE_TAGS.collections,
      CACHE_TAGS.brands,
    ],
  },
);

export function getStorefrontProducts<T = unknown>(
  query: StorefrontProductsQuery = {},
) {
  return getStorefrontProductsCached(
    normalizeQuery(query),
  ) as Promise<StorefrontProductsResult<T>>;
}
