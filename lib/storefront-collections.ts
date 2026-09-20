import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import { getCollectionProducts } from "@/lib/collections";
import { Collection } from "@/models";
import type { CollectionSortOrder } from "@/types";

export type StorefrontCollectionListQuery = {
  page?: number;
  limit?: number;
  channel?: "onlineStore" | "pointOfSale";
};

export type StorefrontCollectionDetailQuery = StorefrontCollectionListQuery & {
  slug: string;
  sort?: CollectionSortOrder;
};

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && (value || 0) > 0 ? Math.floor(value!) : fallback;
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const getStorefrontCollections = unstable_cache(
  async (query: StorefrontCollectionListQuery = {}) => {
    await connectDB();

    const page = normalizePositiveInteger(query.page, 1);
    const limit = Math.min(normalizePositiveInteger(query.limit, 24), 50);
    const publishingChannel = query.channel || "onlineStore";
    const mongoQuery: Record<string, unknown> = {
      status: "active",
      [`publishing.${publishingChannel}`]: true,
    };
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      Collection.find(mongoQuery)
        .select("title slug handle description image productCount position publishing")
        .sort({ position: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Collection.countDocuments(mongoQuery),
    ]);

    const totalPages = Math.ceil(total / limit);

    return serialize({
      data: collections,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  },
  ["storefront-collections"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.collections],
  },
);

export const getStorefrontCollectionDetail = unstable_cache(
  async (query: StorefrontCollectionDetailQuery) => {
    await connectDB();

    const page = normalizePositiveInteger(query.page, 1);
    const limit = Math.min(normalizePositiveInteger(query.limit, 24), 50);
    const publishingChannel = query.channel || "onlineStore";

    const collection = await Collection.findOne({
      slug: query.slug,
      status: "active",
    }).lean();

    if (!collection || !collection.publishing?.[publishingChannel]) {
      return null;
    }

    const { products, total } = await getCollectionProducts(collection, {
      page,
      limit,
      publishingChannel,
      sortOrder: query.sort,
    });
    const totalPages = Math.ceil(total / limit);

    return serialize({
      collection: {
        _id: collection._id,
        title: collection.title,
        slug: collection.slug,
        handle: collection.handle,
        description: collection.description,
        descriptionHtml: collection.descriptionHtml,
        image: collection.image,
        seo: collection.seo,
        productCount: total,
      },
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  },
  ["storefront-collection-detail"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.collections, CACHE_TAGS.products],
  },
);
