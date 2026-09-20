import { connectDB } from "@/lib/db";
import { User, Vendor } from "@/models";
import { NextRequest } from "next/server";
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { VENDOR_STATUS } from "@/config/app.config";
import { successResponse, createdResponse } from "@/lib/api/response";
import { getSettings } from "@/models/settings.model";
import { z } from "zod";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/validate";
import { USER_ROLES } from "@/config/app.config";
import {
  sendAdminNewVendorApplicationEmail,
  sendVendorApplicationPendingEmail,
} from "@/lib/vendor-emails";
import { notifyAdminVendorApplicationPending } from "@/lib/notifications";
import { normalizeNotificationSettings } from "@/lib/notification-settings";
import { assertStorefrontWriteAllowed } from "@/lib/maintenance";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";
import { withApi } from "@/lib/api/handler";

// Zod validation schema for vendor application
const VendorApplicationSchema = z.object({
  storeName: z
    .string()
    .min(3, "Store name must be at least 3 characters")
    .max(100, "Store name cannot exceed 100 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  logo: z.string().url("Logo must be a valid URL").nullable().optional(),
  banner: z.string().url("Banner must be a valid URL").nullable().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
    })
    .nullable()
    .optional(),
  socialLinks: z
    .object({
      website: z
        .string()
        .url("Website must be a valid URL")
        .nullable()
        .optional(),
      facebook: z
        .string()
        .url("Facebook must be a valid URL")
        .nullable()
        .optional(),
      instagram: z
        .string()
        .url("Instagram must be a valid URL")
        .nullable()
        .optional(),
      twitter: z
        .string()
        .url("Twitter must be a valid URL")
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  bankDetails: z
    .object({
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      bankName: z.string().optional(),
      routingNumber: z.string().optional(),
      swiftCode: z.string().optional(),
    })
    .nullable()
    .optional(),
});

type VendorApplicationInput = z.infer<typeof VendorApplicationSchema>;

/**
 * GET /api/vendor/apply
 * Get current user's vendor application status
 */
export const GET = withApi(
  {
    auth: "user",
    rateLimit: { action: "vendor:apply:status", preset: "lenient" },
  },
  async ({ session }) => {
    const settings = await getSettings();
    assertStorefrontWriteAllowed(settings.maintenance, settings.general?.storeName);
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    // Check if user already has a vendor profile
    const vendor = await Vendor.findOne({ userId: session.user.id }).lean();

    if (vendor) {
      return successResponse({
        hasApplication: true,
        status: vendor.status,
        vendor,
      });
    }

    return successResponse({
      hasApplication: false,
      status: null,
    });
  },
);

/**
 * POST /api/vendor/apply
 * Submit vendor application
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getRegistrationSession({
      headers: await headers(),
    });
    if (!session) throw new AuthenticationError();
    if (
      session.user.emailVerificationStatus === "blocked_pending" &&
      session.user.emailVerificationAudience !== USER_ROLES.VENDOR
    ) {
      throw new AuthenticationError();
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:apply:submit",
      "moderate",
      session.user.role
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    // Check if user already has a vendor profile
    const existingVendor = await Vendor.findOne({ userId: session.user.id });
    if (existingVendor) {
      throw new ValidationError({
        general: ["You already have a vendor application"],
      });
    }

    const validatedData: VendorApplicationInput = await validateBody(
      request,
      VendorApplicationSchema,
    );

    // Generate slug from store name
    const slug = validatedData.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check for existing slug and make it unique
    const existingSlug = await Vendor.findOne({ slug });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    // Clean up social links - remove empty strings and nulls
    const cleanSocialLinks = validatedData.socialLinks
      ? {
          website: validatedData.socialLinks.website || undefined,
          facebook: validatedData.socialLinks.facebook || undefined,
          instagram: validatedData.socialLinks.instagram || undefined,
          twitter: validatedData.socialLinks.twitter || undefined,
        }
      : undefined;

    // Only include social links if at least one is provided
    const hasSocialLinks =
      cleanSocialLinks && Object.values(cleanSocialLinks).some(Boolean);

    // Clean up address - only include if at least one field is provided
    const cleanAddress =
      validatedData.address &&
      Object.values(validatedData.address).some(Boolean)
        ? validatedData.address
        : undefined;

    // Clean up bank details - only include if at least one field is provided
    const cleanBankDetails =
      validatedData.bankDetails &&
      Object.values(validatedData.bankDetails).some(Boolean)
        ? validatedData.bankDetails
        : undefined;

    // Create vendor profile with pending status
    const vendor = await Vendor.create({
      userId: session.user.id,
      storeName: validatedData.storeName.trim(),
      slug: finalSlug,
      description: validatedData.description.trim(),
      logo: validatedData.logo || undefined,
      banner: validatedData.banner || undefined,
      status: VENDOR_STATUS.PENDING,
      commission:
        settings.orders?.commission?.vendorRate ?? DEFAULT_VENDOR_COMMISSION_RATE,
      address: cleanAddress,
      socialLinks: hasSocialLinks ? cleanSocialLinks : undefined,
      bankDetails: cleanBankDetails,
    });
    await User.updateOne(
      { _id: session.user.id },
      {
        $set: {
          emailVerificationAudience: USER_ROLES.VENDOR,
          updatedAt: new Date(),
        },
      },
    );

    const adminUsers = await User.find({
      $or: [{ role: USER_ROLES.ADMIN }, { roles: USER_ROLES.ADMIN }],
    })
      .select("_id email")
      .lean();
    const adminEmails = [
      ...adminUsers.map((user) => String(user.email || "")),
      settings.general?.storeEmail || "",
    ];
    const notificationSettings = normalizeNotificationSettings(
      settings.notifications,
    );
    const adminVendorChannels = notificationSettings.admin.newVendors;
    const vendorApplicationChannels =
      notificationSettings.vendor.applicationStatus;

    await Promise.all([
      vendorApplicationChannels.email && session.user.email
        ? sendVendorApplicationPendingEmail({
            vendorEmail: session.user.email,
            vendorName: session.user.name,
            storeName: vendor.storeName,
            settings,
          })
        : Promise.resolve(false),
      adminVendorChannels.email
        ? sendAdminNewVendorApplicationEmail({
            adminEmails,
            vendorEmail: session.user.email,
            vendorName: session.user.name,
            storeName: vendor.storeName,
            settings,
          })
        : Promise.resolve(false),
      ...adminUsers.map((admin) =>
        notifyAdminVendorApplicationPending(
          String(admin._id),
          {
            vendorId: String(vendor._id),
            storeName: vendor.storeName,
            vendorEmail: session.user.email,
            vendorName: session.user.name,
          },
          { settings, channels: adminVendorChannels },
        ),
      ),
    ]);

    return createdResponse({
      message: "Vendor application submitted successfully",
      vendor,
    });
  } catch (error) {
    console.error("Vendor application error:", error);
    return handleApiError(error);
  }
}
