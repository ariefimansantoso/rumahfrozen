import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Brand, Product } from "@/models";
import { successResponse, createdResponse } from "@/lib/api/response";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { hasVendorPermission } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import {
  slugifyBrand,
  getRequestedBrandSlug,
  normalizeBrandSeo,
  BRAND_APPROVAL_STATUS,
  APPROVED_BRAND_CONDITION,
} from "@/lib/brands";
import type { IUser } from "@/types";
import { withApi } from "@/lib/api/handler";

interface VendorBrandRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  featured: boolean;
  productCount: number;
  approvalStatus: "approved" | "pending" | "rejected";
  rejectionReason?: string;
  // True when this brand is owned by the requesting vendor (editable by them).
  isOwn: boolean;
}

/**
 * GET /api/vendor/brands
 * Read-only brand catalog for vendors. Lists every brand in the store with the
 * count of the current vendor's products assigned to each brand. Gated behind
 * the VIEW_BRANDS vendor permission.
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const canView = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_BRANDS,
    );
    if (!canView) {
      throw new AuthorizationError("You do not have permission to view brands");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:brands:list",
      "lenient",
      session.user.role,
    );

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const vendorId = new mongoose.Types.ObjectId(String(vendor._id));

    const grouped = await Product.aggregate<{
      _id: mongoose.Types.ObjectId;
      productCount: number;
    }>([
      { $match: { vendorId, brand: { $ne: null } } },
      { $group: { _id: "$brand", productCount: { $sum: 1 } } },
    ]);
    const countByBrand = new Map(
      grouped.map((item) => [String(item._id), item.productCount]),
    );

    // Vendors see the shared catalog of approved brands plus every brand they
    // own (including pending/rejected ones still in moderation). Soft-deleted
    // brands are always hidden.
    const brandQuery: Record<string, unknown> = {
      deletedAt: null,
      $or: [
        { approvalStatus: APPROVED_BRAND_CONDITION },
        { ownerVendorId: vendorId },
      ],
    };
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      brandQuery.name = { $regex: escapedSearch, $options: "i" };
    }
    if (status === "active") brandQuery.isActive = true;
    if (status === "inactive") brandQuery.isActive = false;
    if (status === "featured") brandQuery.featured = true;
    if (status === "pending")
      brandQuery.approvalStatus = BRAND_APPROVAL_STATUS.PENDING;

    const brands = await Brand.find(brandQuery)
      .select(
        "name slug description logo website isActive featured ownerVendorId approvalStatus rejectionReason",
      )
      .lean();

    const rows: VendorBrandRow[] = brands.map((brand) => ({
      _id: String(brand._id),
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logo: brand.logo,
      website: brand.website,
      isActive: Boolean(brand.isActive),
      featured: Boolean(brand.featured),
      productCount: countByBrand.get(String(brand._id)) || 0,
      approvalStatus: brand.approvalStatus || BRAND_APPROVAL_STATUS.APPROVED,
      rejectionReason: brand.rejectionReason,
      isOwn: brand.ownerVendorId
        ? String(brand.ownerVendorId) === String(vendorId)
        : false,
    }));

    const sortSelectors: Record<
      string,
      (row: VendorBrandRow) => string | number | boolean
    > = {
      name: (row) => row.name,
      productCount: (row) => row.productCount,
      status: (row) => row.isActive,
      createdAt: (row) => row.name,
      updatedAt: (row) => row.name,
    };
    const getSortValue = sortSelectors[sortBy] || sortSelectors.name;
    rows.sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
      const compare = String(aValue).localeCompare(String(bValue), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return sortOrder === "asc" ? compare : -compare;
    });

    const total = rows.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    return successResponse({
      data: rows.slice(skip, skip + limit),
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
);

/**
 * POST /api/vendor/brands
 * Create a brand. Gated behind the CREATE_BRANDS vendor permission and only
 * available while multi-vendor mode is enabled.
 */
export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const canCreate = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.CREATE_BRANDS,
    );
    if (!canCreate) {
      throw new AuthorizationError(
        "You do not have permission to create brands",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:brands:create",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    // Ensures the caller is an approved vendor before allowing writes.
    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const body = await request.json();

    const requestedSlug = getRequestedBrandSlug(body);
    const slug = requestedSlug || slugifyBrand(String(body.name || ""));
    const seo = normalizeBrandSeo(body);

    const existing = await Brand.findOne({ slug });
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    // Vendor-created brands enter the moderation queue: owned by this vendor,
    // pending review, hidden from the storefront until an admin approves.
    // Privileged fields (status/featured) are not vendor-controllable.
    const brand = await Brand.create({
      name: body.name,
      description: body.description,
      logo: body.logo,
      website: body.website,
      ...(seo ? { seo } : {}),
      slug: finalSlug,
      order: body.displayOrder || 0,
      ownerVendorId: vendor._id,
      approvalStatus: BRAND_APPROVAL_STATUS.PENDING,
      isActive: false,
      featured: false,
    });

    return createdResponse(brand);
  },
);
