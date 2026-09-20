import { unstable_cache } from "next/cache";
import { PRODUCT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import { getStorefrontProductConstraint } from "@/lib/product-visibility";
import { Category, Collection, Product, Vendor } from "@/models";

export type StorefrontProductFilterOption = {
  name: string;
  slug: string;
};

export type StorefrontProductFilters = {
  categories: StorefrontProductFilterOption[];
  collections: StorefrontProductFilterOption[];
};

export type StorefrontProductFilterQuery = {
  vendor?: string | null;
};

function mapCategory(category: { name: string; slug: string }) {
  return {
    name: category.name,
    slug: category.slug,
  };
}

function mapCollection(collection: { title: string; slug: string }) {
  return {
    name: collection.title,
    slug: collection.slug,
  };
}

export const getStorefrontProductFilters = unstable_cache(
  async (
    query: StorefrontProductFilterQuery = {},
  ): Promise<StorefrontProductFilters> => {
    await connectDB();

    const vendor = typeof query.vendor === "string" ? query.vendor.trim() : "";

    if (vendor) {
      const vendorDoc = await Vendor.findOne({
        ...(vendor.match(/^[0-9a-fA-F]{24}$/)
          ? { _id: vendor }
          : { slug: vendor.toLowerCase() }),
        status: VENDOR_STATUS.APPROVED,
      })
        .select("_id")
        .lean();

      if (!vendorDoc) {
        return { categories: [], collections: [] };
      }

      const productQuery = {
        status: PRODUCT_STATUS.ACTIVE,
        ...(await getStorefrontProductConstraint()),
        vendorId: vendorDoc._id,
      };

      const [categoryIds, collectionIds] = await Promise.all([
        Product.distinct("category", productQuery),
        Product.distinct("collectionIds", {
          ...productQuery,
          collectionIds: { $exists: true, $ne: [] },
        }),
      ]);

      const [dbCategories, dbCollections] = await Promise.all([
        categoryIds.length
          ? Category.find({ _id: { $in: categoryIds }, isActive: true })
              .sort({ order: 1, name: 1 })
              .select("name slug")
              .lean()
          : [],
        collectionIds.length
          ? Collection.find({ _id: { $in: collectionIds }, status: "active" })
              .sort({ position: 1, title: 1 })
              .select("title slug")
              .lean()
          : [],
      ]);

      return {
        categories: dbCategories.map(mapCategory),
        collections: dbCollections.map(mapCollection),
      };
    }

    const [dbCategories, dbCollections] = await Promise.all([
      Category.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .select("name slug")
        .lean(),
      Collection.find({ status: "active" })
        .sort({ position: 1, title: 1 })
        .select("title slug")
        .lean(),
    ]);

    return {
      categories: dbCategories.map(mapCategory),
      collections: dbCollections.map(mapCollection),
    };
  },
  ["storefront-product-filters"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.categories, CACHE_TAGS.collections, CACHE_TAGS.products],
  },
);
