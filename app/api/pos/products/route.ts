import { connectDB } from "@/lib/db";
import { Product, Category, Vendor } from "@/models";
import { successResponse } from "@/lib/api/response";
import { AuthorizationError } from "@/lib/api/errors";
import { canAccessPOS } from "@/lib/rbac";
import { isValidObjectId, sanitizeSearchString } from "@/lib/api/validate";
import { PRODUCT_STATUS, USER_ROLES, VENDOR_STATUS } from "@/config/app.config";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { withApi } from "@/lib/api/handler";
import {
  applyPOSLocationStock,
  matchesPOSStockStatus,
  type POSProductWithInventory,
  type POSStockStatusFilter,
} from "@/lib/pos/product-stock";

type StockStatusFilter = POSStockStatusFilter;

/**
 * GET /api/pos/products
 * Search products available for POS
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    if (!(await canAccessPOS(session.user))) throw new AuthorizationError();

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("category") || "";
    const locationId = searchParams.get("locationId") || "";
    const stockStatusParam = searchParams.get("stockStatus") || "all";
    const stockStatus: StockStatusFilter =
      stockStatusParam === "in_stock" || stockStatusParam === "out_of_stock"
        ? stockStatusParam
        : "all";
    const vendorId = searchParams.get("vendorId") || "";
    const source = searchParams.get("source") || "all";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const query: Record<string, unknown> = {
      status: PRODUCT_STATUS.ACTIVE,
    };

    if (session.user.role === USER_ROLES.VENDOR) {
      const vendor = await requireApprovedVendorByUserId(session.user.id);
      query.vendorId = vendor._id;
    } else {
      query["publishing.pointOfSale"] = true;

      if (vendorId && vendorId !== "all" && isValidObjectId(vendorId)) {
        query.vendorId = vendorId;
      }

      if (source === "vendor") {
        query.productSource = "vendor";
      } else if (source === "admin") {
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
    }

    if (categoryId) {
      query.category = categoryId;
    }

    if (search) {
      // Escape for the regex fields only; barcode fields stay exact-match.
      const escapedSearch = sanitizeSearchString(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { sku: { $regex: escapedSearch, $options: "i" } },
        { barcode: search },
        { "variants.barcode": search },
        { "variants.sku": { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const rawProducts = await Product.find(query)
      .select(
        "name price comparePrice images media sku skuNormalized barcode barcodeNormalized stock locationInventory variants category vendorId productSource options"
      )
      .limit(stockStatus === "all" ? limit : 100)
      .lean();

    const products = rawProducts
      .map((product) =>
        applyPOSLocationStock(
          product as typeof product & POSProductWithInventory,
          locationId,
        ),
      )
      .filter((product) => matchesPOSStockStatus(product, stockStatus))
      .slice(0, limit);

    // Also fetch categories for filtering
    const categories = await Category.find({ isActive: true })
      .select("name slug image")
      .sort({ order: 1 })
      .lean();

    const vendors =
      session.user.role === USER_ROLES.VENDOR
        ? []
        : await Vendor.find({ status: VENDOR_STATUS.APPROVED })
            .select("storeName slug")
            .sort({ storeName: 1 })
            .lean();

    return successResponse({
      products,
      categories,
      filters: {
        vendors: vendors.map((vendor) => ({
          _id: String(vendor._id),
          storeName: vendor.storeName,
          slug: vendor.slug,
        })),
      },
    });
  },
);
