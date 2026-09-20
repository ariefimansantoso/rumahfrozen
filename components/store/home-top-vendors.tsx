import { getTranslations } from "next-intl/server";
import { unstable_cache } from "next/cache";
import { connectDB, mongoose } from "@/lib/db";
import { Product, Vendor } from "@/models";
import { type Locale } from "@/config/i18n.config";
import { VENDOR_STATUS, PRODUCT_STATUS } from "@/config/app.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import {
  getExternalVendorFilter,
  isMultiVendorEnabled,
} from "@/lib/multi-vendor";
import {
  HomeTopVendorsCarousel,
  type TopVendorCard,
  type TopVendorsLabels,
} from "@/components/store/home-top-vendors-carousel";

interface HomeTopVendorsProps {
  locale: Locale;
  title: string;
  limit: number;
}

function priceTier(avgPrice: number | null | undefined): string {
  if (!avgPrice || !Number.isFinite(avgPrice) || avgPrice <= 0) return "$";
  if (avgPrice < 50) return "$";
  if (avgPrice < 200) return "$$";
  return "$$$";
}

const fetchTopVendors = unstable_cache(
  async (limit: number): Promise<TopVendorCard[]> => {
    try {
      await connectDB();

      const enabled = await isMultiVendorEnabled();
      if (!enabled) return [];

      const vendors = await Vendor.find({
        ...getExternalVendorFilter(),
        status: VENDOR_STATUS.APPROVED,
      })
        .select("storeName slug description logo banner rating totalSales")
        .sort({ rating: -1, totalSales: -1, createdAt: -1 })
        .limit(limit)
        .lean<
          {
            _id: mongoose.Types.ObjectId;
            storeName: string;
            slug: string;
            description?: string;
            logo?: string;
            banner?: string;
            rating?: number;
            totalSales?: number;
          }[]
        >();

      if (vendors.length === 0) return [];

      const vendorIds = vendors.map((v) => v._id);

      const aggregates = await Product.aggregate<{
        _id: mongoose.Types.ObjectId;
        avgPrice: number;
        productCount: number;
      }>([
        {
          $match: {
            vendorId: { $in: vendorIds },
            status: PRODUCT_STATUS.ACTIVE,
          },
        },
        {
          $group: {
            _id: "$vendorId",
            avgPrice: { $avg: "$price" },
            productCount: { $sum: 1 },
          },
        },
      ]);

      const aggregateMap = new Map<
        string,
        { avgPrice: number; productCount: number }
      >();
      for (const item of aggregates) {
        aggregateMap.set(String(item._id), {
          avgPrice: item.avgPrice,
          productCount: item.productCount,
        });
      }

      return vendors.map((vendor) => {
        const stats = aggregateMap.get(String(vendor._id));
        return {
          id: String(vendor._id),
          storeName: vendor.storeName,
          slug: vendor.slug,
          tagline: vendor.description?.trim() || "",
          logo: vendor.logo || "",
          banner: vendor.banner || "",
          rating: typeof vendor.rating === "number" ? vendor.rating : 0,
          totalSales:
            typeof vendor.totalSales === "number" ? vendor.totalSales : 0,
          priceTier: priceTier(stats?.avgPrice),
        };
      });
    } catch {
      return [];
    }
  },
  ["home-top-vendors"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.products, CACHE_TAGS.settings],
  },
);

async function getLabels(locale: Locale): Promise<TopVendorsLabels> {
  const tHome = await getTranslations({ locale, namespace: "home" });
  const safe = (
    key:
      | "topVendorsRating"
      | "topVendorsSold"
      | "topVendorsPrice"
      | "topVendorsGoToShop",
    fallback: string,
  ) => {
    try {
      return tHome(key);
    } catch {
      return fallback;
    }
  };

  return {
    rating: safe("topVendorsRating", "rating"),
    sold: safe("topVendorsSold", "sold"),
    price: safe("topVendorsPrice", "Price"),
    goToShop: safe("topVendorsGoToShop", "Go to Shop"),
    scrollLeft: "Scroll left",
    scrollRight: "Scroll right",
  };
}

export async function HomeTopVendors({
  locale,
  title,
  limit,
}: HomeTopVendorsProps) {
  const [vendors, labels] = await Promise.all([
    fetchTopVendors(limit),
    getLabels(locale),
  ]);

  if (vendors.length === 0) return null;

  return (
    <HomeTopVendorsCarousel
      locale={locale}
      title={title}
      vendors={vendors}
      labels={labels}
    />
  );
}
