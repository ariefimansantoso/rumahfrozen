import { unstable_cache } from "next/cache";
import { PRODUCT_STATUS } from "@/config/app.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import { getStorefrontProductConstraint } from "@/lib/product-visibility";
import { Product } from "@/models";

export const getStorefrontProductBySlug = unstable_cache(
  async (slug: string) => {
    await connectDB();

    const product = await Product.findOne({
      slug,
      status: PRODUCT_STATUS.ACTIVE,
      ...(await getStorefrontProductConstraint()),
    })
      .populate("vendorId", "storeName slug logo description rating")
      .populate("category", "name slug")
      .populate("brand", "name slug logo")
      .lean();

    return product ? JSON.parse(JSON.stringify(product)) : null;
  },
  ["storefront-product-detail"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.brands],
  },
);
