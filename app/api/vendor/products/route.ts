import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { paginatedResponse, createdResponse } from "@/lib/api/response";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody, validateQuery } from "@/lib/api/validate";
import { AdminListQuerySchema, CreateProductSchema } from "@/lib/validations";
import { auditCreate, createAuditContext } from "@/lib/audit";
import { syncProductCollections } from "@/lib/collections";
import { syncProductCategory } from "@/lib/categories";
import {
  assignMissingProductBarcodes,
  sanitizeOptionsForMongoose,
  sanitizePreorderSettings,
  sanitizeProductLocationInventory,
  sanitizeVariantsForMongoose,
} from "@/lib/products/sanitize";
import {
  assertProductBarcodesAreUnique,
} from "@/lib/products/barcode-validation";
import { assignProductLookupCodes } from "@/lib/products/barcode-normalization";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { withApi } from "@/lib/api/handler";
import {
  releaseProductBarcodeRegistry,
  reserveProductBarcodeRegistry,
  syncProductBarcodeRegistry,
} from "@/lib/products/barcode-registry";

function toHandle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * GET /api/vendor/products
 * Get products for the current vendor
 * Requires: VIEW_PRODUCTS permission
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    // Check RBAC permission
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_PRODUCTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to view products",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:products:list",
      "lenient",
      session.user.role
    );

    const { page, limit, search, status, sortBy, sortOrder } = validateQuery(
      request,
      AdminListQuerySchema,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    // Get vendor for this user
    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const skip = (page - 1) * limit;

    // Build query - admins can see all, vendors see their own
    const query: Record<string, unknown> = { vendorId: vendor._id };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const allowedSortFields = new Set([
      "createdAt",
      "updatedAt",
      "name",
      "price",
      "stock",
      "status",
    ]);
    const effectiveSortBy =
      sortBy && allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const direction = sortOrder === "asc" ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("category", "name slug")
        .sort({ [effectiveSortBy]: direction })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    return paginatedResponse(products, page, limit, total);
  },
);

/**
 * POST /api/vendor/products
 * Create a new product for the current vendor
 * Requires: CREATE_PRODUCTS permission
 */
export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    // Check RBAC permission
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to create products",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:products:create",
      "moderate",
      session.user.role
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    // Get vendor for this user
    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

    const body = await validateBody(request, CreateProductSchema);

    const title =
      typeof body.title === "string" && body.title.trim().length
        ? body.title.trim()
        : String(body.name || "").trim();

    const baseHandle =
      typeof body?.seo?.handle === "string" && body.seo.handle.trim()
        ? body.seo.handle.trim()
        : title;

    const slug = toHandle(baseHandle);

    // Sanitize embedded arrays — same helper used by admin POST/PUT.
    const cleanedVariants = sanitizeVariantsForMongoose(body.variants);
    const cleanedOptions = sanitizeOptionsForMongoose(
      (body as unknown as Record<string, unknown>).options,
    );
    const cleanedLocationInventory = sanitizeProductLocationInventory(
      (body as unknown as Record<string, unknown>).locationInventory,
    );
    const cleanedPreorder = sanitizePreorderSettings(
      (body as unknown as Record<string, unknown>).preorder,
    );

    const existingProduct = await Product.findOne({
      slug,
      vendorId: vendor._id,
    });
    const finalSlug = existingProduct ? `${slug}-${Date.now()}` : slug;
    const normalizedProductData = {
      ...(body as unknown as Record<string, unknown>),
      variants: cleanedVariants,
    };
    assignMissingProductBarcodes(normalizedProductData);
    assignProductLookupCodes(
      normalizedProductData as Record<string, unknown> & {
        variants?: Record<string, unknown>[];
      },
    );
    await assertProductBarcodesAreUnique(
      Product,
      normalizedProductData as Record<string, unknown> & {
        variants?: Record<string, unknown>[];
      },
    );

    const product = new Product({
      ...normalizedProductData,
      name: title,
      title,
      vendorId: vendor._id,
      productSource: "vendor",
      slug: finalSlug,
      handle: finalSlug,
      seo: { ...(body.seo || {}), handle: finalSlug },
      options: cleanedOptions,
      ...(cleanedPreorder !== undefined ? { preorder: cleanedPreorder } : {}),
      ...(cleanedLocationInventory !== undefined
        ? { locationInventory: cleanedLocationInventory }
        : {}),
    });
    await product.validate();
    try {
      await reserveProductBarcodeRegistry(
        String(product._id),
        product.toObject() as unknown as Record<string, unknown>,
      );
      await product.save();
      await syncProductBarcodeRegistry(
        String(product._id),
        product.toObject() as unknown as Record<string, unknown>,
      );
    } catch (error) {
      await releaseProductBarcodeRegistry(String(product._id));
      throw error;
    }

    // Sync collection memberships
    const newCollectionIds = (product.collectionIds || []).map(String);
    if (newCollectionIds.length > 0) {
      await syncProductCollections(product._id.toString(), [], newCollectionIds);
    }

    // Update category product count
    if (product.category) {
      await syncProductCategory(null, String(product.category));
    }

    const auditContext = createAuditContext(request, session);
    await auditCreate(
      auditContext,
      "product",
      String(product._id),
      product.toObject() as unknown as Record<string, unknown>,
    );

    revalidateProductContent({ slugs: [product.slug] });

    return createdResponse(product);
  },
);
