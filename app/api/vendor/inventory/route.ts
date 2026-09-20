import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { InventoryLocation } from "@/models/inventory-location.model";
import { successResponse } from "@/lib/api/response";
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { hasVendorPermission } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { withApi } from "@/lib/api/handler";
import type { BarcodeFormat, BarcodeSource } from "@/lib/barcode/standards";

interface InventoryItem {
  productId: string;
  productName: string;
  productImage: string | null;
  variantId: string | null;
  variantName: string | null;
  sku: string;
  barcode: string;
  barcodeFormat?: BarcodeFormat;
  barcodeSource?: BarcodeSource;
  price: number;
  unavailable: number;
  committed: number;
  available: number;
  onHand: number;
  locationInventory: Array<{
    locationId: string;
    locationName: string;
    quantity: number;
  }>;
}

export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const canView = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.VIEW_PRODUCTS,
    );
    if (!canView) {
      throw new AuthorizationError("You do not have permission to view inventory");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:inventory:list",
      "lenient",
      session.user.role,
    );

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
    );
    const search = searchParams.get("search")?.trim() || "";
    const locationId = searchParams.get("location") || "";
    const stockLevel = searchParams.get("stockLevel") || "all";
    const sortBy = searchParams.get("sortBy") || "";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const query: Record<string, unknown> = { vendorId: vendor._id };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { sku: { $regex: escapedSearch, $options: "i" } },
        { barcode: { $regex: escapedSearch, $options: "i" } },
        { "variants.sku": { $regex: escapedSearch, $options: "i" } },
        { "variants.barcode": { $regex: escapedSearch, $options: "i" } },
        { "variants.name": { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const locations = await InventoryLocation.find({ isActive: true })
      .sort({ isDefault: -1, name: 1 })
      .lean();

    const locationMap = new Map(
      locations.map((loc) => [String(loc._id), loc.name]),
    );

    const products = await Product.find(query)
      .select("name title images media variants sku barcode barcodeFormat barcodeSource price stock")
      .sort({ name: 1 })
      .lean();

    const inventoryItems: InventoryItem[] = [];

    for (const product of products) {
      const productImage = product.media?.[0]?.url || product.images?.[0] || null;
      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      if (hasVariants) {
        for (const variant of product.variants!) {
          const variantLocationInventory = (variant.locationInventory || []).map(
            (loc: { locationId: string; quantity: number }) => ({
              locationId: String(loc.locationId),
              locationName: locationMap.get(String(loc.locationId)) || "Unknown",
              quantity: loc.quantity || 0,
            }),
          );

          const onHand = variant.stock || 0;
          const committed = 0;
          const unavailable = 0;
          const available = Math.max(0, onHand - committed - unavailable);

          if (stockLevel === "low" && available > 10) continue;
          if (stockLevel === "out" && available > 0) continue;

          if (locationId) {
            const hasLocation = variantLocationInventory.some(
              (loc: { locationId: string }) => loc.locationId === locationId,
            );
            if (!hasLocation) continue;
          }

          let variantName = variant.name || "";
          if (!variantName && Array.isArray(variant.optionValues)) {
            variantName = variant.optionValues
              .map((ov: { value: string }) => ov.value)
              .join(" / ");
          }

          inventoryItems.push({
            productId: String(product._id),
            productName: product.title || product.name,
            productImage,
            variantId: String(variant._id),
            variantName,
            sku: variant.sku || product.sku || "",
            barcode: variant.barcode || product.barcode || "",
            barcodeFormat: variant.barcodeFormat || product.barcodeFormat,
            barcodeSource: variant.barcodeSource || product.barcodeSource,
            price: variant.price ?? product.price ?? 0,
            unavailable,
            committed,
            available,
            onHand,
            locationInventory: variantLocationInventory,
          });
        }
      } else {
        const onHand = product.stock || 0;
        const committed = 0;
        const unavailable = 0;
        const available = Math.max(0, onHand - committed - unavailable);

        if (stockLevel === "low" && available > 10) continue;
        if (stockLevel === "out" && available > 0) continue;

        inventoryItems.push({
          productId: String(product._id),
          productName: product.title || product.name,
          productImage,
          variantId: null,
          variantName: null,
          sku: product.sku || "",
          barcode: product.barcode || "",
          barcodeFormat: product.barcodeFormat,
          barcodeSource: product.barcodeSource,
          price: product.price || 0,
          unavailable,
          committed,
          available,
          onHand,
          locationInventory: [],
        });
      }
    }

    const sortSelectors: Record<string, (item: InventoryItem) => string | number> = {
      productName: (item) => item.productName || "",
      sku: (item) => item.sku || "",
      barcode: (item) => item.barcode || "",
      available: (item) => item.available || 0,
      onHand: (item) => item.onHand || 0,
      committed: (item) => item.committed || 0,
      unavailable: (item) => item.unavailable || 0,
    };
    const getSortValue = sortSelectors[sortBy];

    if (getSortValue) {
      inventoryItems.sort((a, b) => {
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
    }

    const skip = (page - 1) * limit;
    const total = inventoryItems.length;
    const paginatedItems = inventoryItems.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    return successResponse({
      items: paginatedItems,
      locations: locations.map((loc) => ({
        _id: String(loc._id),
        name: loc.name,
        isDefault: loc.isDefault,
      })),
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

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();

    const user = session.user as unknown as IUser;
    const canEdit = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
    );
    if (!canEdit) {
      throw new AuthorizationError("You do not have permission to update inventory");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:inventory:update",
      "moderate",
      session.user.role,
    );

    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new ValidationError("Updates array is required");
    }

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);

    const results: Array<{
      success: boolean;
      productId: string;
      variantId?: string;
      error?: string;
    }> = [];

    for (const update of updates) {
      const { productId, variantId, quantity, locationId, adjustment } = update;

      if (!productId) {
        results.push({ success: false, productId: "", error: "productId is required" });
        continue;
      }

      try {
        const product = await Product.findOne({ _id: productId, vendorId: vendor._id });
        if (!product) {
          results.push({ success: false, productId, error: "Product not found" });
          continue;
        }

        if (variantId) {
          const variantIndex = product.variants?.findIndex(
            (v: { _id?: { toString: () => string } }) => String(v._id) === variantId,
          );

          if (variantIndex === undefined || variantIndex === -1) {
            results.push({ success: false, productId, variantId, error: "Variant not found" });
            continue;
          }

          const variant = product.variants![variantIndex];

          if (locationId) {
            const locIndex = (variant.locationInventory || []).findIndex(
              (loc: { locationId: string }) => String(loc.locationId) === locationId,
            );

            const newQuantity = adjustment
              ? (variant.locationInventory?.[locIndex]?.quantity || 0) + quantity
              : quantity;

            if (locIndex >= 0) {
              variant.locationInventory![locIndex].quantity = Math.max(0, newQuantity);
            } else {
              variant.locationInventory = variant.locationInventory || [];
              variant.locationInventory.push({ locationId, quantity: Math.max(0, newQuantity) });
            }

            variant.stock = (variant.locationInventory || []).reduce(
              (sum: number, loc: { quantity: number }) => sum + (loc.quantity || 0),
              0,
            );
          } else {
            variant.stock = adjustment
              ? Math.max(0, (variant.stock || 0) + quantity)
              : Math.max(0, quantity);
          }

          if (variant.inventory) {
            variant.inventory.quantity = variant.stock;
          }
        } else {
          product.stock = adjustment
            ? Math.max(0, (product.stock || 0) + quantity)
            : Math.max(0, quantity);
        }

        await product.save();
        results.push({ success: true, productId, variantId });
      } catch (err) {
        results.push({
          success: false,
          productId,
          variantId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return successResponse({
      results,
      summary: {
        total: results.length,
        success: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
