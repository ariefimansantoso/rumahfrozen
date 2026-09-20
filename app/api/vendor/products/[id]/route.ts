import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { USER_ROLES } from "@/config/app.config";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { isValidObjectId, validateBody } from "@/lib/api/validate";
import { UpdateProductSchema } from "@/lib/validations";
import { auditDelete, auditUpdate, createAuditContext } from "@/lib/audit";
import { syncProductCollections, removeProductFromAllCollections, updateAllCollectionProductCounts } from "@/lib/collections";
import { syncProductCategory } from "@/lib/categories";
import { syncVariantAggregates } from "@/models/product.model";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import {
  assignMissingProductBarcodes,
  sanitizeOptionsForMongoose,
  sanitizePreorderSettings,
  sanitizeProductLocationInventory,
  sanitizeVariantsForMongoose,
} from "@/lib/products/sanitize";
import { assignProductLookupCodes } from "@/lib/products/barcode-normalization";
import {
  assertProductBarcodesAreUnique,
  buildBarcodeValidationPayload,
} from "@/lib/products/barcode-validation";
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
 * GET /api/vendor/products/[id]
 * Get a single product by ID (vendor must own it)
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    if (
      session.user.role !== USER_ROLES.VENDOR &&
      session.user.role !== USER_ROLES.ADMIN
    ) {
      throw new AuthorizationError();
    }
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
      "vendor:products:read",
      "lenient",
      session.user.role
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Product");
    const product = await Product.findOne({ _id: id, vendorId: vendor._id })
      .populate("category", "name slug")
      .populate("brand", "name slug logo")
      .lean();

    if (!product) {
      return notFoundResponse("Product");
    }

    return successResponse(product);
  },
);

/**
 * PUT /api/vendor/products/[id]
 * Update a product (vendor must own it)
 */
export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    if (
      session.user.role !== USER_ROLES.VENDOR &&
      session.user.role !== USER_ROLES.ADMIN
    ) {
      throw new AuthorizationError();
    }
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to edit products",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:products:update",
      "moderate",
      session.user.role
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Product");

    const body = await validateBody(request, UpdateProductSchema);

    delete (body as Record<string, unknown>).featured;

    const existing = await Product.findOne({ _id: id, vendorId: vendor._id })
      .select("slug collectionIds category status sku barcode barcodeFormat barcodeSource variants")
      .lean();
    if (!existing) {
      return notFoundResponse("Product");
    }

    const oldCollectionIds = (existing.collectionIds || []).map(String);
    const oldCategoryId = existing.category ? String(existing.category) : null;

    const updateSet: Record<string, unknown> = { ...(body as unknown as Record<string, unknown>) };

    // Sanitize embedded arrays for safe Mongoose write — same helper used
    // by admin POST/PUT and vendor POST.
    if ("variants" in updateSet) {
      updateSet.variants = sanitizeVariantsForMongoose(updateSet.variants);
    }
    if ("options" in updateSet) {
      updateSet.options = sanitizeOptionsForMongoose(updateSet.options);
    }
    if ("locationInventory" in updateSet) {
      const cleaned = sanitizeProductLocationInventory(
        updateSet.locationInventory,
      );
      if (cleaned === undefined) delete updateSet.locationInventory;
      else updateSet.locationInventory = cleaned;
    }
    if ("preorder" in updateSet) {
      const cleaned = sanitizePreorderSettings(updateSet.preorder);
      if (cleaned === undefined) delete updateSet.preorder;
      else updateSet.preorder = cleaned;
    }

    const hasVariantPayload =
      Array.isArray(updateSet.variants) && updateSet.variants.length > 0;
    const hasBarcodePayload = Object.prototype.hasOwnProperty.call(
      updateSet,
      "barcode",
    );
    if (hasVariantPayload || hasBarcodePayload) {
      assignMissingProductBarcodes(updateSet);
    }
    assignProductLookupCodes(
      updateSet as Record<string, unknown> & {
        variants?: Record<string, unknown>[];
      },
    );

    // Normalize category payload when frontend sends populated object shape.
    if (Object.prototype.hasOwnProperty.call(updateSet, "category")) {
      const categoryValue = updateSet.category;
      if (
        categoryValue &&
        typeof categoryValue === "object" &&
        !Array.isArray(categoryValue)
      ) {
        const categoryObj = categoryValue as { _id?: unknown; id?: unknown };
        const candidate = categoryObj._id ?? categoryObj.id;
        if (candidate) {
          updateSet.category = String(candidate);
        } else {
          throw new ValidationError("Invalid category value");
        }
      } else if (
        typeof categoryValue === "string" &&
        categoryValue.trim() === "[object Object]"
      ) {
        throw new ValidationError("Invalid category value");
      }
    }

    const nextTitle =
      typeof body.title === "string" && body.title.trim().length
        ? body.title.trim()
        : typeof body.name === "string" && body.name.trim().length
          ? body.name.trim()
          : undefined;
    if (nextTitle) {
      updateSet.title = nextTitle;
      updateSet.name = nextTitle;
    }

    const nextBarcodePayload = buildBarcodeValidationPayload(
      existing as unknown as Record<string, unknown> & {
        variants?: Record<string, unknown>[];
      },
      updateSet as Record<string, unknown> & {
        variants?: Record<string, unknown>[];
      },
    );
    await assertProductBarcodesAreUnique(
      Product,
      nextBarcodePayload,
      { excludeProductId: id },
    );

    const rawHandle =
      typeof body?.seo?.handle === "string" && body.seo.handle.trim()
        ? body.seo.handle.trim()
        : undefined;

    if (rawHandle) {
      const nextSlug = toHandle(rawHandle);
      if (nextSlug && nextSlug !== existing.slug) {
        const conflict = await Product.exists({
          vendorId: vendor._id,
          slug: nextSlug,
          _id: { $ne: id },
        });
        if (conflict) {
          updateSet.slug = `${nextSlug}-${Date.now()}`;
        } else {
          updateSet.slug = nextSlug;
        }
      }

      updateSet.handle = updateSet.slug || toHandle(rawHandle);
      updateSet.seo = { ...(body.seo || {}), handle: updateSet.handle };
    }

    let product;
    try {
      await reserveProductBarcodeRegistry(id, nextBarcodePayload);
      product = await Product.findOneAndUpdate(
        { _id: id, vendorId: vendor._id },
        { $set: updateSet },
        { new: true, runValidators: true }
      )
        .populate("category", "name slug")
        .lean();
    } catch (error) {
      await syncProductBarcodeRegistry(
        id,
        existing as unknown as Record<string, unknown>,
      );
      throw error;
    }

    if (!product) {
      await syncProductBarcodeRegistry(
        id,
        existing as unknown as Record<string, unknown>,
      );
      return notFoundResponse("Product");
    }
    await syncProductBarcodeRegistry(
      id,
      product as unknown as Record<string, unknown>,
    );

    // Sync variant price/stock aggregates (pre-save hook doesn't run with findOneAndUpdate)
    if (updateSet.variants) {
      await syncVariantAggregates(id);
    }

    // Sync collection memberships
    const newCollectionIds = (product.collectionIds || []).map(String);
    await syncProductCollections(id, oldCollectionIds, newCollectionIds);

    // Sync category product counts
    const populatedCategory = product.category as { _id?: unknown } | string | null;
    const newCategoryId = populatedCategory
      ? typeof populatedCategory === "object" && populatedCategory._id
        ? String(populatedCategory._id)
        : String(populatedCategory)
      : null;
    await syncProductCategory(oldCategoryId, newCategoryId);

    // Recount automated collections when product status changes
    const oldStatus = (existing as Record<string, unknown>).status;
    if (updateSet.status && updateSet.status !== oldStatus) {
      updateAllCollectionProductCounts().catch((err) =>
        console.error("Failed to update collection counts:", err)
      );
    }

    const auditContext = createAuditContext(request, session);
    await auditUpdate(
      auditContext,
      "product",
      id,
      existing as unknown as Record<string, unknown>,
      product as unknown as Record<string, unknown>,
    );

    revalidateProductContent({
      slugs: [existing.slug, product.slug],
    });

    return successResponse(product);
  },
);

/**
 * DELETE /api/vendor/products/[id]
 * Delete a product (vendor must own it)
 */
export const DELETE = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    if (
      session.user.role !== USER_ROLES.VENDOR &&
      session.user.role !== USER_ROLES.ADMIN
    ) {
      throw new AuthorizationError();
    }
    const user = session.user as unknown as IUser;
    const hasPermission = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.DELETE_PRODUCTS,
    );
    if (!hasPermission && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to delete products",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:products:delete",
      "moderate",
      session.user.role
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Product");

    const before = await Product.findOne({ _id: id, vendorId: vendor._id }).lean();
    const product = await Product.findOneAndDelete({
      _id: id,
      vendorId: vendor._id,
    });

    if (!product) {
      return notFoundResponse("Product");
    }

    await releaseProductBarcodeRegistry(id);

    // Remove from all collections and update counts
    await removeProductFromAllCollections(id);

    // Update category product count
    if (before?.category) {
      await syncProductCategory(String(before.category), null);
    }

    const auditContext = createAuditContext(request, session);
    await auditDelete(
      auditContext,
      "product",
      id,
      (before || product.toObject()) as unknown as Record<string, unknown>,
    );

    revalidateProductContent({ slugs: [before?.slug, product.slug] });

    return successResponse({ message: "Product deleted successfully" });
  },
);
