import { connectDB } from "@/lib/db";
import { getSettings, type ISettings } from "@/models/settings.model";
import { Product, User, Vendor } from "@/models";
import {
  appConfig,
  USER_ROLES,
  VENDOR_STATUS,
  type UserRole,
} from "@/config/app.config";

export const DEFAULT_VENDOR_SLUG = appConfig.defaultVendorSlug;

type DefaultVendorSettings = Pick<ISettings, "general">;

type VendorRecord = {
  _id?: unknown;
  userId?: unknown;
  isDefault?: unknown;
  storeName?: unknown;
  slug?: unknown;
  description?: unknown;
  logo?: unknown;
  status?: unknown;
  commission?: unknown;
  socialLinks?: {
    website?: unknown;
  };
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStoreName(value: unknown): string {
  return normalizeText(value) || appConfig.name;
}

function normalizeOwnerId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    const id = value.toString();
    return id === "[object Object]" ? null : id;
  }
  return null;
}

function buildDefaultVendorProfile(settings: DefaultVendorSettings) {
  const storeName = normalizeStoreName(settings.general?.storeName);
  const description =
    normalizeText(settings.general?.storeDescription) ||
    `Default store for ${storeName}`;
  const logo = normalizeText(settings.general?.logoUrl);
  const website = normalizeText(settings.general?.storeDomain);

  return {
    storeName,
    description,
    logo: logo || undefined,
    website: website || undefined,
  };
}

export function isDefaultVendorRecord(vendor: unknown): boolean {
  if (!vendor || typeof vendor !== "object") return false;
  const record = vendor as VendorRecord;
  return (
    record.isDefault === true ||
    normalizeText(record.slug).toLowerCase() === DEFAULT_VENDOR_SLUG
  );
}

export function getExternalVendorFilter(): Record<string, unknown> {
  return {
    isDefault: { $ne: true },
    slug: { $ne: DEFAULT_VENDOR_SLUG },
  };
}

export async function isMultiVendorEnabled(): Promise<boolean> {
  await connectDB();
  const settings = await getSettings();
  return Boolean(settings.multiVendorMode?.enabled);
}

async function resolveDefaultVendorOwnerId(
  preferredUserId?: string,
): Promise<string | null> {
  if (preferredUserId) {
    const preferredUser = await User.findById(preferredUserId)
      .select("_id role roles")
      .lean<{ _id: unknown; role?: UserRole; roles?: UserRole[] } | null>();

    if (
      preferredUser?.role === USER_ROLES.ADMIN ||
      preferredUser?.roles?.includes(USER_ROLES.ADMIN)
    ) {
      return String(preferredUser._id);
    }
  }

  const adminUser = await User.findOne({
    $or: [{ role: USER_ROLES.ADMIN }, { roles: USER_ROLES.ADMIN }],
  })
    .select("_id")
    .sort({ createdAt: 1 })
    .lean<{ _id: unknown } | null>();

  return adminUser ? String(adminUser._id) : preferredUserId || null;
}

async function findDefaultVendorCandidate(preferredUserId?: string) {
  const byFlag = await Vendor.findOne({ isDefault: true });
  if (byFlag) return byFlag;

  const bySlug = await Vendor.findOne({ slug: DEFAULT_VENDOR_SLUG });
  if (bySlug) return bySlug;

  const adminProductVendorIds = await Product.distinct("vendorId", {
    productSource: "admin",
  });
  const uniqueAdminVendorIds = adminProductVendorIds
    .map((id) => normalizeOwnerId(id))
    .filter((id): id is string => Boolean(id));

  if (uniqueAdminVendorIds.length === 1) {
    const byAdminProducts = await Vendor.findById(uniqueAdminVendorIds[0]);
    if (byAdminProducts) return byAdminProducts;
  }

  if (preferredUserId) {
    return Vendor.findOne({ userId: preferredUserId });
  }

  return null;
}

async function canUseDefaultSlug(vendorId: unknown) {
  const existing = await Vendor.findOne({
    slug: DEFAULT_VENDOR_SLUG,
    _id: { $ne: vendorId },
  })
    .select("_id")
    .lean();

  return !existing;
}

async function syncVendorDocument(
  vendor: VendorRecord & {
    save?: () => Promise<unknown>;
    set?: (path: string, value: unknown) => void;
  },
  settings: DefaultVendorSettings,
  ownerId?: string | null,
) {
  const profile = buildDefaultVendorProfile(settings);
  let changed = false;

  const set = (path: string, value: unknown, current: unknown) => {
    if (current === value) return;
    if (typeof vendor.set === "function") vendor.set(path, value);
    else (vendor as Record<string, unknown>)[path] = value;
    changed = true;
  };

  set("isDefault", true, vendor.isDefault);
  set("storeName", profile.storeName, vendor.storeName);
  set("description", profile.description, vendor.description);
  set("status", VENDOR_STATUS.APPROVED, vendor.status);
  set("commission", 0, vendor.commission);

  if (profile.logo) {
    set("logo", profile.logo, vendor.logo);
  } else if (vendor.logo) {
    set("logo", undefined, vendor.logo);
  }

  const currentWebsite = vendor.socialLinks?.website;
  if (profile.website) {
    set("socialLinks.website", profile.website, currentWebsite);
  } else if (currentWebsite) {
    set("socialLinks.website", undefined, currentWebsite);
  }

  const currentSlug = normalizeText(vendor.slug).toLowerCase();
  if (currentSlug !== DEFAULT_VENDOR_SLUG && (await canUseDefaultSlug(vendor._id))) {
    set("slug", DEFAULT_VENDOR_SLUG, vendor.slug);
  }

  if (!vendor.userId && ownerId) {
    set("userId", ownerId, vendor.userId);
  }

  if (changed && typeof vendor.save === "function") {
    await vendor.save();
  }

  return vendor;
}

async function repairDefaultVendorOwnerRole(ownerId?: string | null) {
  if (!ownerId) return;

  const owner = await User.findById(ownerId)
    .select("role roles")
    .lean<{ role?: UserRole; roles?: UserRole[] } | null>();
  if (!owner) return;

  const roles = Array.isArray(owner.roles) ? owner.roles : [];
  const shouldBeAdmin =
    owner.role === USER_ROLES.ADMIN || roles.includes(USER_ROLES.ADMIN);
  if (!shouldBeAdmin) return;

  const rolesAlreadySynced =
    owner.role === USER_ROLES.ADMIN &&
    roles.length === 1 &&
    roles[0] === USER_ROLES.ADMIN;
  if (rolesAlreadySynced) return;

  await User.updateOne(
    { _id: ownerId },
    {
      $set: {
        role: USER_ROLES.ADMIN,
        roles: [USER_ROLES.ADMIN],
        updatedAt: new Date(),
      },
    },
  );
}

/**
 * Synchronize the internal default vendor with application store settings.
 *
 * Store settings are the source of truth. The default vendor exists only so
 * product/order records can keep a stable vendorId in single-vendor mode.
 */
export async function syncDefaultVendorWithSettings(
  preferredOwnerId?: string,
  providedSettings?: DefaultVendorSettings,
) {
  await connectDB();

  const settings = providedSettings || (await getSettings());
  const ownerId = await resolveDefaultVendorOwnerId(preferredOwnerId);
  let vendor = await findDefaultVendorCandidate(ownerId || preferredOwnerId);

  if (!vendor) {
    if (!ownerId) {
      throw new Error("Unable to resolve an admin owner for the default vendor");
    }

    const profile = buildDefaultVendorProfile(settings);

    try {
      vendor = await Vendor.create({
        userId: ownerId,
        isDefault: true,
        storeName: profile.storeName,
        slug: DEFAULT_VENDOR_SLUG,
        description: profile.description,
        logo: profile.logo,
        socialLinks: profile.website ? { website: profile.website } : undefined,
        status: VENDOR_STATUS.APPROVED,
        commission: 0,
      });
    } catch (err: unknown) {
      const maybeError = err as { code?: number };
      if (maybeError.code !== 11000) throw err;

      vendor = await findDefaultVendorCandidate(ownerId);
      if (!vendor) throw err;
    }
  }

  const syncedVendor = await syncVendorDocument(
    vendor as VendorRecord,
    settings,
    ownerId,
  );
  await repairDefaultVendorOwnerRole(
    ownerId || normalizeOwnerId((syncedVendor as VendorRecord).userId),
  );

  return syncedVendor;
}

/**
 * Get or create the default vendor for single-vendor/admin-owned products.
 */
export async function getOrCreateDefaultVendor(ownerUserId?: string) {
  return syncDefaultVendorWithSettings(ownerUserId);
}

/**
 * Migrate all products to the default vendor when switching
 * from multi-vendor to single-vendor mode.
 *
 * - Preserves product ownership provenance using `productSource`
 * - Keeps active vendor-origin products visible to customers
 * - Does NOT change user roles (vendor users lose access because
 *   vendor routes check settings.multiVendorMode.enabled)
 * - Idempotent: safe to run multiple times
 *
 * @param adminUserId - The admin user who triggered the toggle
 * @returns Migration summary
 */
export async function migrateToSingleVendor(
  adminUserId: string,
): Promise<{
  productsReassigned: number;
  productsHidden: number;
  sourceBackfilled: number;
}> {
  await connectDB();

  const defaultVendor = await getOrCreateDefaultVendor(adminUserId);

  // Backfill provenance for legacy products that don't have productSource.
  // Heuristic: default vendor => admin-origin, non-default vendor => vendor-origin.
  const [adminBackfill, vendorBackfill] = await Promise.all([
    Product.updateMany(
      { productSource: { $exists: false }, vendorId: defaultVendor._id },
      { $set: { productSource: "admin" } },
    ),
    Product.updateMany(
      { productSource: { $exists: false }, vendorId: { $ne: defaultVendor._id } },
      { $set: { productSource: "vendor" } },
    ),
  ]);

  return {
    // Kept for backward compatibility with existing callers/telemetry.
    productsReassigned: 0,
    productsHidden: 0,
    sourceBackfilled:
      (adminBackfill.modifiedCount ?? 0) + (vendorBackfill.modifiedCount ?? 0),
  };
}
