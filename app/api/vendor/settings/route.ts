import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Vendor, User } from "@/models";
import { getSettings } from "@/models/settings.model";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from "@/lib/api/errors";
import { successResponse } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validate";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { DEFAULT_VENDOR_SLUG } from "@/lib/multi-vendor";
import { withApi } from "@/lib/api/handler";
import { resolveShareSettings, type ShareSettings } from "@/lib/share-config";
import {
  PROFILE_DEMO_MODE_MESSAGE,
  isDemoModeEnabled,
} from "@/lib/demo-mode";

const OptionalUrlSchema = z
  .union([z.string().url("Must be a valid URL"), z.literal(""), z.null()])
  .optional();

const StoreSettingsSchema = z.object({
  storeName: z.string().min(3).max(100).optional(),
  slug: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  logo: OptionalUrlSchema,
  banner: OptionalUrlSchema,
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  socialLinks: z
    .object({
      website: OptionalUrlSchema,
      facebook: OptionalUrlSchema,
      instagram: OptionalUrlSchema,
      twitter: OptionalUrlSchema,
    })
    .optional(),
});

const PaymentSettingsSchema = z.object({
  bankDetails: z
    .object({
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      bankName: z.string().optional(),
      routingNumber: z.string().optional(),
      swiftCode: z.string().optional(),
    })
    .optional(),
  payoutSettings: z
    .object({
      schedule: z.enum(["weekly", "biweekly", "monthly"]).optional(),
      minimumAmount: z.number().min(0).optional(),
    })
    .optional(),
});

const NotificationSettingsSchema = z.object({
  notificationPreferences: z
    .object({
      newOrders: z.boolean().optional(),
      orderUpdates: z.boolean().optional(),
      lowStock: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
});

const ShareSettingsSchema = z.object({
  shareSettings: z
    .object({
      enabled: z.boolean().optional(),
      copyLink: z.boolean().optional(),
      facebook: z.boolean().optional(),
      twitter: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      telegram: z.boolean().optional(),
      pinterest: z.boolean().optional(),
      linkedin: z.boolean().optional(),
      email: z.boolean().optional(),
      custom: z
        .array(
          z.object({
            id: z.string().max(80).optional(),
            label: z.string().max(60).optional(),
            urlTemplate: z.string().max(500).optional(),
            enabled: z.boolean().optional(),
            icon: OptionalUrlSchema,
          }),
        )
        .max(12)
        .optional(),
    })
    .optional(),
});

const AccountSettingsSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.union([z.string(), z.literal(""), z.null()]).optional(),
  image: OptionalUrlSchema,
});

const VendorShippingRateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["flat", "free_over", "subtotal_range", "weight_range"]),
  price: z.number().min(0).default(0),
  freeOver: z.number().min(0).optional(),
  minSubtotal: z.number().min(0).optional(),
  maxSubtotal: z.number().min(0).optional(),
  minWeight: z.number().min(0).optional(),
  maxWeight: z.number().min(0).optional(),
  pricePerWeightUnit: z.number().min(0).optional(),
  minDays: z.number().min(0).optional(),
  maxDays: z.number().min(0).optional(),
  active: z.boolean().default(true),
});

const VendorShippingProfileSchema = z.object({
  enabled: z.boolean().default(false),
  weightUnit: z.enum(["kg", "lb"]).default("kg"),
  delivery: z
    .object({
      processingDaysMin: z.number().min(0).default(0),
      processingDaysMax: z.number().min(0).default(0),
      showEstimatedDelivery: z.boolean().default(true),
    })
    .optional(),
  zones: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        countries: z.array(z.string()).default([]),
        regions: z.array(z.string()).default([]),
        rates: z.array(VendorShippingRateSchema).default([]),
      }),
    )
    .default([]),
  fallbackRate: z
    .object({
      enabled: z.boolean().default(false),
      name: z.string().default("Standard"),
      price: z.number().min(0).default(0),
      minDays: z.number().min(0).optional(),
      maxDays: z.number().min(0).optional(),
    })
    .optional(),
  localPickup: z
    .object({
      enabled: z.boolean().default(false),
      pickupAddress: z.string().optional(),
      instructions: z.string().optional(),
      readyInDaysMin: z.number().min(0).optional(),
      readyInDaysMax: z.number().min(0).optional(),
    })
    .optional(),
});

const ShippingSettingsSchema = z.object({
  shipping: VendorShippingProfileSchema,
});

const VendorSettingsUpdateSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("store"), data: StoreSettingsSchema }),
  z.object({ section: z.literal("payment"), data: PaymentSettingsSchema }),
  z.object({
    section: z.literal("notifications"),
    data: NotificationSettingsSchema,
  }),
  z.object({ section: z.literal("share"), data: ShareSettingsSchema }),
  z.object({ section: z.literal("account"), data: AccountSettingsSchema }),
  z.object({ section: z.literal("shipping"), data: ShippingSettingsSchema }),
]);

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSlug(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug.length > 0 ? slug : undefined;
}

function normalizeOptionalUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeShareSettings(value: unknown): ShareSettings {
  const share = resolveShareSettings(value);
  return {
    ...share,
    custom: share.custom
      .map((item, index) => ({
        id: normalizeOptionalString(item.id) || `custom-${index + 1}`,
        label: normalizeOptionalString(item.label) || "",
        urlTemplate: normalizeOptionalString(item.urlTemplate) || "",
        enabled: item.enabled,
        icon: normalizeOptionalUrl(item.icon),
      }))
      .filter((item) => item.label && item.urlTemplate)
      .slice(0, 12),
  };
}

function buildSettingsPayload(vendor: {
  storeName?: string;
  description?: string;
  logo?: string;
  banner?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  socialLinks?: {
    website?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    routingNumber?: string;
    swiftCode?: string;
  };
  notificationPreferences?: {
    newOrders?: boolean;
    orderUpdates?: boolean;
    lowStock?: boolean;
    marketing?: boolean;
  };
  payoutSettings?: {
    schedule?: "weekly" | "biweekly" | "monthly";
    minimumAmount?: number;
  };
  shipping?: Record<string, unknown>;
  shareSettings?: unknown;
  slug?: string;
}) {
  return {
    shipping: vendor.shipping ?? null,
    storeName: vendor.storeName || "",
    slug: vendor.slug || "",
    description: vendor.description || "",
    logo: vendor.logo || "",
    banner: vendor.banner || "",
    address: {
      street: vendor.address?.street || "",
      city: vendor.address?.city || "",
      state: vendor.address?.state || "",
      postalCode: vendor.address?.postalCode || "",
      country: vendor.address?.country || "",
      phone: vendor.address?.phone || "",
    },
    socialLinks: {
      website: vendor.socialLinks?.website || "",
      facebook: vendor.socialLinks?.facebook || "",
      instagram: vendor.socialLinks?.instagram || "",
      twitter: vendor.socialLinks?.twitter || "",
    },
    bankDetails: {
      accountName: vendor.bankDetails?.accountName || "",
      accountNumber: vendor.bankDetails?.accountNumber || "",
      bankName: vendor.bankDetails?.bankName || "",
      routingNumber: vendor.bankDetails?.routingNumber || "",
      swiftCode: vendor.bankDetails?.swiftCode || "",
    },
    notificationPreferences: {
      newOrders: vendor.notificationPreferences?.newOrders ?? true,
      orderUpdates: vendor.notificationPreferences?.orderUpdates ?? true,
      lowStock: vendor.notificationPreferences?.lowStock ?? true,
      marketing: vendor.notificationPreferences?.marketing ?? false,
    },
    payoutSettings: {
      schedule: vendor.payoutSettings?.schedule || "weekly",
      minimumAmount: vendor.payoutSettings?.minimumAmount ?? 0,
    },
    shareSettings: normalizeShareSettings(vendor.shareSettings),
  };
}

export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_STORE_SETTINGS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to view store settings",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:settings:read",
      "lenient",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const userRecord = await User.findById(session.user.id)
      .select("name email phone image")
      .lean();

    if (!userRecord) {
      throw new NotFoundError("User");
    }

    return successResponse({
      demoMode: {
        enabled: isDemoModeEnabled(),
        message: PROFILE_DEMO_MODE_MESSAGE,
      },
      vendor: buildSettingsPayload(vendor),
      user: {
        name: userRecord.name || "",
        email: userRecord.email || "",
        phone: userRecord.phone || "",
        image: userRecord.image || "",
      },
      // Whether the store administrator has enabled per-vendor shipping. The
      // Settings form uses this to show/hide the Shipping tab.
      vendorShippingEnabled: Boolean(settings.shipping?.vendorShipping?.enabled),
    });
  },
);

export const PUT = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_STORE_SETTINGS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to update store settings",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:settings:update",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const body = await validateBody(request, VendorSettingsUpdateSchema);

    if (body.section === "store") {
      const nextStoreName = normalizeOptionalString(body.data.storeName);
      if (body.data.storeName !== undefined && !nextStoreName) {
        throw new ValidationError({
          storeName: ["Store name is required"],
        });
      }

      const cleanAddress = {
        street: normalizeOptionalString(body.data.address?.street),
        city: normalizeOptionalString(body.data.address?.city),
        state: normalizeOptionalString(body.data.address?.state),
        postalCode: normalizeOptionalString(body.data.address?.postalCode),
        country: normalizeOptionalString(body.data.address?.country),
        phone: normalizeOptionalString(body.data.address?.phone),
      };
      const hasAddress = Object.values(cleanAddress).some(Boolean);

      const cleanSocialLinks = {
        website: normalizeOptionalUrl(body.data.socialLinks?.website),
        facebook: normalizeOptionalUrl(body.data.socialLinks?.facebook),
        instagram: normalizeOptionalUrl(body.data.socialLinks?.instagram),
        twitter: normalizeOptionalUrl(body.data.socialLinks?.twitter),
      };
      const hasSocialLinks = Object.values(cleanSocialLinks).some(Boolean);

      const normalizedLogo = normalizeOptionalUrl(body.data.logo);
      const normalizedBanner = normalizeOptionalUrl(body.data.banner);

      const update: Record<string, unknown> = {
        description: normalizeOptionalString(body.data.description),
        logo: normalizedLogo,
        banner: normalizedBanner,
        address: hasAddress ? cleanAddress : undefined,
        socialLinks: hasSocialLinks ? cleanSocialLinks : undefined,
      };

      if (nextStoreName) {
        update.storeName = nextStoreName;
      }

      if (body.data.slug !== undefined) {
        const nextSlug = normalizeSlug(body.data.slug);
        if (!nextSlug || nextSlug.length < 2) {
          throw new ValidationError({ slug: ["Store slug is required"] });
        }
        if (nextSlug === DEFAULT_VENDOR_SLUG) {
          throw new ValidationError({
            slug: ["This store slug is reserved for the default store"],
          });
        }

        const existingSlug = await Vendor.findOne({
          slug: nextSlug,
          _id: { $ne: vendor._id },
        })
          .select("_id")
          .lean();

        if (existingSlug) {
          throw new ValidationError({ slug: ["Store slug already exists"] });
        }

        update.slug = nextSlug;
      }

      const unset: Record<string, "" | 1> = {};
      if (body.data.logo !== undefined && !normalizedLogo) {
        unset.logo = "";
      }
      if (body.data.banner !== undefined && !normalizedBanner) {
        unset.banner = "";
      }

      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: update,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      });
    }

    if (body.section === "payment") {
      const cleanBankDetails = {
        accountName: normalizeOptionalString(body.data.bankDetails?.accountName),
        accountNumber: normalizeOptionalString(
          body.data.bankDetails?.accountNumber,
        ),
        bankName: normalizeOptionalString(body.data.bankDetails?.bankName),
        routingNumber: normalizeOptionalString(
          body.data.bankDetails?.routingNumber,
        ),
        swiftCode: normalizeOptionalString(body.data.bankDetails?.swiftCode),
      };
      const hasBankDetails = Object.values(cleanBankDetails).some(Boolean);

      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          bankDetails: hasBankDetails ? cleanBankDetails : undefined,
          payoutSettings: {
            ...(body.data.payoutSettings || {}),
            minimumAmount: body.data.payoutSettings?.minimumAmount ?? 0,
          },
        },
      });
    }

    if (body.section === "notifications") {
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          notificationPreferences: {
            newOrders: body.data.notificationPreferences?.newOrders ?? true,
            orderUpdates: body.data.notificationPreferences?.orderUpdates ?? true,
            lowStock: body.data.notificationPreferences?.lowStock ?? true,
            marketing: body.data.notificationPreferences?.marketing ?? false,
          },
        },
      });
    }

    if (body.section === "share") {
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          shareSettings: normalizeShareSettings(body.data.shareSettings),
        },
      });
    }

    if (body.section === "shipping") {
      if (!settings.shipping?.vendorShipping?.enabled) {
        throw new AuthorizationError(
          "Per-vendor shipping is not enabled by the store administrator",
        );
      }
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: { shipping: body.data.shipping },
      });
    }

    if (body.section === "account") {
      const fullName = normalizeOptionalString(body.data.name);
      if (!fullName) {
        throw new ValidationError({ name: ["Name is required"] });
      }

      const normalizedImage = normalizeOptionalUrl(body.data.image);
      const accountUnset: Record<string, ""> = {};
      if (body.data.image !== undefined && !normalizedImage) {
        accountUnset.image = "";
      }

      await User.findByIdAndUpdate(session.user.id, {
        $set: {
          name: fullName,
          phone: normalizeOptionalString(body.data.phone),
          ...(normalizedImage ? { image: normalizedImage } : {}),
          updatedAt: new Date(),
        },
        ...(Object.keys(accountUnset).length
          ? { $unset: accountUnset }
          : {}),
      });
    }

    const updatedVendor = await Vendor.findById(vendor._id).lean();
    if (!updatedVendor) throw new AuthorizationError("Vendor profile not found");

    const updatedUser = await User.findById(session.user.id)
      .select("name email phone image")
      .lean();
    if (!updatedUser) throw new NotFoundError("User");

    if (body.section === "store" || body.section === "share") {
      revalidateProductContent();
    }

    return successResponse({
      vendor: buildSettingsPayload(updatedVendor),
      user: {
        name: updatedUser.name || "",
        email: updatedUser.email || "",
        phone: updatedUser.phone || "",
        image: updatedUser.image || "",
      },
      vendorShippingEnabled: Boolean(settings.shipping?.vendorShipping?.enabled),
    });
  },
);
