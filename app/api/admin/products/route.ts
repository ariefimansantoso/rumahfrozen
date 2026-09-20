import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Product, Vendor } from "@/models";
import {
  createdResponse,
  successResponse,
} from "@/lib/api/response";
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PRODUCT_STATUS, USER_ROLES } from "@/config/app.config";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { validateQuery, validateBody } from "@/lib/api/validate";
import { ProductListQuerySchema, CreateProductSchema } from "@/lib/validations";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { syncProductCollections } from "@/lib/collections";
import { syncProductCategory } from "@/lib/categories";
import {
  getOrCreateDefaultVendor,
  syncDefaultVendorWithSettings,
} from "@/lib/multi-vendor";
import { getSettings } from "@/models/settings.model";
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
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffProductScopeFilter,
  hasStaffScope,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import { revalidateProductContent } from "@/lib/cache-invalidation";
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
 * GET /api/admin/products
 * Get all products for admin
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin auth
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_PRODUCTS],
    );

    // Rate limiting
    rateLimitByUser(
      request,
      session.user.id,
      "admin:products:list",
      "lenient",
      session.user.role
    );

    // Validate query params (search is auto-sanitized for regex safety)
    const { page, limit, search, status, vendor, source, sortOrder } = validateQuery(
      request,
      ProductListQuerySchema
    );

    await connectDB();
    const settings = await getSettings();
    const isMultiVendor = Boolean(settings.multiVendorMode?.enabled);
    await syncDefaultVendorWithSettings(
      session.user.role === USER_ROLES.ADMIN ? session.user.id : undefined,
      settings,
    );

    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    // Search is now sanitized by the schema
    if (search) {
      const matchingVendors = isMultiVendor
        ? await Vendor.find({
            storeName: { $regex: search, $options: "i" },
          })
            .select("_id")
            .lean()
        : [];
      const matchingVendorIds = matchingVendors.map((item) => item._id);

      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        ...(matchingVendorIds.length
          ? [{ vendorId: { $in: matchingVendorIds } }]
          : []),
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (isMultiVendor && vendor) {
      query.vendorId = vendor;
    }

    if (isMultiVendor && source === "vendor") {
      query.productSource = "vendor";
    } else if (isMultiVendor && source === "admin") {
      query.$and = [
        ...((query.$and as Record<string, unknown>[]) || []),
        {
          $or: [
            { productSource: "admin" },
            { productSource: { $exists: false } },
          ],
        },
      ];
    }

    const scopedQuery = mergeScopeFilter(
      query,
      buildStaffProductScopeFilter(access.staffScope),
    );

    const [products, total, vendorIds] = await Promise.all([
      Product.find(scopedQuery)
        // List/selector views never render these heavy fields; excluding them
        // keeps the payload small without breaking any column or filter.
        .select("-description -shortDescription -seo -attributes")
        .populate("vendorId", "storeName slug")
        .populate("category", "name slug")
        .sort({ createdAt: sortOrder === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(scopedQuery),
      isMultiVendor ? Product.distinct("vendorId", scopedQuery) : Promise.resolve([]),
    ]);

    const totalPages = Math.ceil(total / limit);

    const vendors = await Vendor.find({ _id: { $in: vendorIds } })
      .select("storeName slug")
      .sort({ storeName: 1 })
      .lean();

    return successResponse({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        vendors: vendors.map((item) => ({
          label: item.storeName,
          value: String(item._id),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/products
 * Create a new product (admin can assign to any vendor)
 * In single-vendor mode, auto-assigns to default vendor
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();
    let createStaffVendorIds: string[] | undefined;
    if (session.user.role !== USER_ROLES.ADMIN) {
      const access = await assertAdminOrStaffPermissions(
        session as unknown as { user: { id: string; role: string } },
        [
          STAFF_PERMISSIONS.CREATE_PRODUCTS,
          STAFF_PERMISSIONS.MANAGE_PRODUCTS,
        ],
      );
      createStaffVendorIds = access.staffScope?.vendorIds;
      if (hasStaffScope(access.staffScope) && !access.staffScope?.vendorIds.length) {
        throw new AuthorizationError(
          "Staff must be assigned to a vendor before creating products",
        );
      }
    }

    // Rate limiting for product creation
    rateLimitByUser(
      request,
      session.user.id,
      "admin:products:create",
      "moderate",
      session.user.role
    );

    await connectDB();
    const body = await validateBody(request, CreateProductSchema);
    const productData = body;

    // Admin products belong to the default store vendor. Scoped staff create
    // under their first assigned vendor; unrestricted legacy staff fall back
    // to the default vendor for backward compatibility.
    const vendorId = createStaffVendorIds?.[0]
      ? createStaffVendorIds[0]
      : (await getOrCreateDefaultVendor(session.user.id))._id;

    const title =
      typeof productData.title === "string" && productData.title.trim().length
        ? productData.title.trim()
        : String(productData.name || "").trim();

    const baseHandle =
      typeof productData?.seo?.handle === "string" &&
      productData.seo.handle.trim()
        ? productData.seo.handle.trim()
        : title;

    const slug = toHandle(baseHandle);

    // Sanitize collections for Mongoose: strip client UUIDs, coerce
    // optionValue strings → objects, drop empty fields. Same helper used by
    // PUT to keep create + update paths consistent.
    const cleanedVariants = sanitizeVariantsForMongoose(productData.variants);
    const cleanedOptions = sanitizeOptionsForMongoose(productData.options);
    const cleanedLocationInventory = sanitizeProductLocationInventory(
      (productData as unknown as Record<string, unknown>).locationInventory,
    );
    const cleanedPreorder = sanitizePreorderSettings(
      (productData as unknown as Record<string, unknown>).preorder,
    );

    const normalizedProductData = {
      ...productData,
      name: title,
      title,
      slug,
      handle: slug,
      seo: { ...(productData.seo || {}), handle: slug },
      status: productData.status || PRODUCT_STATUS.DRAFT,
      variants: cleanedVariants,
      options: cleanedOptions,
      ...(cleanedPreorder !== undefined ? { preorder: cleanedPreorder } : {}),
      ...(cleanedLocationInventory !== undefined
        ? { locationInventory: cleanedLocationInventory }
        : {}),
    };
    assignMissingProductBarcodes(
      normalizedProductData as unknown as Record<string, unknown>,
    );
    assignProductLookupCodes(
      normalizedProductData as unknown as Record<string, unknown> & {
        variants?: Record<string, unknown>[];
      },
    );
    await assertProductBarcodesAreUnique(
      Product,
      normalizedProductData as unknown as Record<string, unknown> & {
        variants?: Record<string, unknown>[];
      },
    );

    const existingProduct = await Product.findOne({ slug, vendorId });
    const finalSlug = existingProduct ? `${slug}-${Date.now()}` : slug;

    const product = new Product({
      ...normalizedProductData,
      vendorId,
      productSource: "admin",
      slug: finalSlug,
      handle: finalSlug,
      seo: { ...(normalizedProductData.seo || {}), handle: finalSlug },
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

    revalidateProductContent({ slugs: [product.slug] });

    return createdResponse(product);
  } catch (error) {
    return handleApiError(error);
  }
}
