import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-invalidation";
import { mongoose } from "@/lib/db";

export type StorefrontProductSource = "admin" | "vendor";

export async function isStorefrontMultiVendorEnabled(): Promise<boolean> {
  const { getSettings } = await import("@/models/settings.model");
  const settings = await getSettings();
  return Boolean(settings.multiVendorMode?.enabled);
}

/**
 * Cached list of approved vendor ids as hex strings.
 *
 * Previously this query ran on every storefront cache miss (i.e. on every
 * revalidation of every product/brand/collection listing). Caching it here
 * collapses that to a single lookup per refresh window.
 *
 * `unstable_cache` serializes its result to JSON, so this intentionally returns
 * strings rather than ObjectId instances — callers rebuild ObjectIds. It is
 * tagged with `products` because vendor status changes already invalidate that
 * tag via `revalidateProductContent()`, so the list refreshes immediately on
 * approve/suspend; the 60s revalidate is just a safety net.
 */
const getApprovedVendorIds = unstable_cache(
  async (): Promise<string[]> => {
    const [{ Vendor }, { VENDOR_STATUS }] = await Promise.all([
      import("@/models"),
      import("@/config/app.config"),
    ]);

    const approvedVendors = await Vendor.find({
      status: VENDOR_STATUS.APPROVED,
    })
      .select("_id")
      .lean();

    return approvedVendors.map((vendor) => String(vendor._id));
  },
  ["storefront-approved-vendor-ids"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.products],
  },
);

export async function getStorefrontProductConstraint(): Promise<
  Record<string, unknown>
> {
  // Note: we intentionally keep the approved-vendor filter on in every mode
  // rather than short-circuiting it in single-vendor stores. Skipping it would
  // expose active products belonging to suspended/rejected vendors that can
  // linger after a multi-vendor -> single-vendor switch. The single-element
  // $in in single-vendor mode is cheap and selective, so the only real cost
  // (the repeated vendor lookup) is removed by the cache above.
  const ids = await getApprovedVendorIds();

  // find() would auto-cast string ids inside $in, but aggregation $match (used
  // for brand/collection product counts) does not, so cast to ObjectId here so
  // every consumer behaves identically.
  const objectIds = ids
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  return {
    vendorId: { $in: objectIds },
  };
}

export function isStorefrontProductSourceAllowed(
  productSource: unknown,
  isMultiVendorEnabled: boolean,
): boolean {
  void productSource;
  void isMultiVendorEnabled;
  return true;
}
