import { Product } from "@/models";
import { connectDB } from "@/lib/db";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { UpdateProductSchema } from "@/lib/validations";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody, isValidObjectId } from "@/lib/api/validate";
import { successResponse, notFoundResponse } from "@/lib/api/response";
import { auditDelete, auditUpdate, createAuditContext } from "@/lib/audit";
import { syncProductCollections, removeProductFromAllCollections, updateAllCollectionProductCounts } from "@/lib/collections";
import { syncProductCategory } from "@/lib/categories";
import { syncVariantAggregates } from "@/models/product.model";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";
import {
  buildStaffProductScopeFilter,
  hasStaffScope,
  mergeScopeFilter,
} from "@/lib/staff-scope";
import { USER_ROLES } from "@/config/app.config";
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
 * GET /api/admin/products/[id]
 * Get a single product by ID
 */
export const GET = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [STAFF_PERMISSIONS.VIEW_PRODUCTS],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:products:read",
      "lenient",
      session.user.role
    );

    await connectDB();

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Product");

    const product = await Product.findOne(
      mergeScopeFilter({ _id: id }, buildStaffProductScopeFilter(access.staffScope)),
    )
      .populate("vendorId", "storeName slug")
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
 * PUT /api/admin/products/[id]
 * Update a product
 */
export const PUT = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [
        STAFF_PERMISSIONS.EDIT_PRODUCTS,
        STAFF_PERMISSIONS.MANAGE_PRODUCTS,
      ],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:products:update",
      "moderate",
      session.user.role
    );

    await connectDB();

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Product");

    const body = await validateBody(request, UpdateProductSchema);

    const existing = await Product.findOne(
      mergeScopeFilter({ _id: id }, buildStaffProductScopeFilter(access.staffScope)),
    ).select("vendorId slug collectionIds category status sku barcode barcodeFormat barcodeSource variants").lean();
    if (!existing) {
      return notFoundResponse("Product");
    }

    const oldCollectionIds = (existing.collectionIds || []).map(String);
    const oldCategoryId = existing.category ? String(existing.category) : null;

    const updateSet: Record<string, unknown> = { ...(body as unknown as Record<string, unknown>) };

    // Apply the same sanitization the create route does so update writes
    // can never produce CastErrors on embedded subdocs. Critically this:
    // - strips client UUID _id from variants (Mongoose expects ObjectId)
    // - coerces variant.optionValues entries to objects (string → object)
    // - drops empty-string fields that should be unset
    // - normalizes locationInventory shape
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

    if (
      session.user.role !== USER_ROLES.ADMIN &&
      hasStaffScope(access.staffScope) &&
      updateSet.vendorId !== undefined &&
      !access.staffScope?.vendorIds.includes(String(updateSet.vendorId))
    ) {
      return notFoundResponse("Product");
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
          vendorId: existing.vendorId,
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
        mergeScopeFilter({ _id: id }, buildStaffProductScopeFilter(access.staffScope)),
        { $set: updateSet },
        { new: true, runValidators: true }
      )
        .populate("vendorId", "storeName slug")
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

    // Sync variant price/stock aggregates (pre-save hook doesn't run with findByIdAndUpdate)
    if (updateSet.variants) {
      await syncVariantAggregates(id);
    }

    // Sync collection memberships
    const newCollectionIds = (product.collectionIds || []).map(String);
    await syncProductCollections(id, oldCollectionIds, newCollectionIds);

    // Sync category product counts
    // Note: product.category is populated, so we need to get the _id from the object
    const populatedCategory = product.category as { _id?: unknown } | string | null;
    const newCategoryId = populatedCategory
      ? typeof populatedCategory === "object" && populatedCategory._id
        ? String(populatedCategory._id)
        : String(populatedCategory)
      : null;
    await syncProductCategory(oldCategoryId, newCategoryId);

    // Recount automated collections when product status changes (affects which products match)
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
 * DELETE /api/admin/products/[id]
 * Delete a product
 */
export const DELETE = withApi<{ id: string }>(
  { auth: "user" },
  async ({ request, params, session }) => {
    const access = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      [
        STAFF_PERMISSIONS.DELETE_PRODUCTS,
        STAFF_PERMISSIONS.MANAGE_PRODUCTS,
      ],
    );

    rateLimitByUser(
      request,
      session.user.id,
      "admin:products:delete",
      "strict",
      session.user.role
    );

    await connectDB();

    const { id } = params;
    if (!isValidObjectId(id)) return notFoundResponse("Product");

    const scopeQuery = mergeScopeFilter(
      { _id: id },
      buildStaffProductScopeFilter(access.staffScope),
    );
    const before = await Product.findOne(scopeQuery).lean();
    const product = await Product.findOneAndDelete(scopeQuery);

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
      (before || product.toObject?.() || product) as unknown as Record<string, unknown>,
    );

    revalidateProductContent({ slugs: [before?.slug, product.slug] });

    return successResponse({ message: "Product deleted successfully" });
  },
);
