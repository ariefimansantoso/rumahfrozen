import { unstable_cache } from "next/cache";
import { VENDOR_STATUS } from "@/config/app.config";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { connectDB } from "@/lib/db";
import {
  getExternalVendorFilter,
  isMultiVendorEnabled,
} from "@/lib/multi-vendor";
import { resolveShareSettings, type ShareSettings } from "@/lib/share-config";
import { Vendor } from "@/models";

export type StorefrontVendor = {
  storeName: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  shareSettings: ShareSettings;
};

export const getStorefrontVendorBySlug = unstable_cache(
  async (slug: string): Promise<StorefrontVendor | null> => {
    await connectDB();

    const multiVendorEnabled = await isMultiVendorEnabled();
    if (!multiVendorEnabled) return null;

    const vendor = await Vendor.findOne({
      ...getExternalVendorFilter(),
      slug: slug.toLowerCase(),
      status: VENDOR_STATUS.APPROVED,
    })
      .select("storeName slug description logo banner shareSettings")
      .lean<StorefrontVendor | null>();

    if (!vendor) return null;

    return JSON.parse(
      JSON.stringify({
        ...vendor,
        shareSettings: resolveShareSettings(vendor.shareSettings),
      }),
    );
  },
  ["storefront-vendor-by-slug"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.products, CACHE_TAGS.settings],
  },
);
