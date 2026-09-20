import { connectDB } from "@/lib/db";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { errorResponse, successResponse } from "@/lib/api/response";
import { validateQuery } from "@/lib/api/validate";
import { AdminListQuerySchema } from "@/lib/validations";
import { Product } from "@/models";
import { getSettings } from "@/models/settings.model";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { hasVendorPermission, isAdmin } from "@/lib/rbac";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import type { IUser } from "@/types";
import {
  importProductsCsv,
  productsCsvResponse,
} from "@/lib/products/import-export";
import { withApi } from "@/lib/api/handler";

function buildVendorProductQuery(params: {
  vendorId: unknown;
  search?: string;
  status?: string;
}) {
  const query: Record<string, unknown> = { vendorId: params.vendorId };

  if (params.search) {
    query.$or = [
      { name: { $regex: params.search, $options: "i" } },
      { sku: { $regex: params.search, $options: "i" } },
    ];
  }

  if (params.status && params.status !== "all") {
    query.status = params.status;
  }

  return query;
}

export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
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
      "vendor:products:export",
      "lenient",
      session.user.role,
    );

    const { search, status, sortBy, sortOrder } = validateQuery(
      request,
      AdminListQuerySchema,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

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

    const products = await Product.find(
      buildVendorProductQuery({ vendorId: vendor._id, search, status }),
    )
      .populate("vendorId", "storeName slug")
      .populate("category", "name slug")
      .populate("brand", "name slug")
      .sort({ [effectiveSortBy]: sortOrder === "asc" ? 1 : -1 })
      .limit(5000)
      .lean();

    return productsCsvResponse(
      products as unknown as Parameters<typeof productsCsvResponse>[0],
      "vendor-products",
    );
  },
);

export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const user = session.user as unknown as IUser;
    const canCreate = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.CREATE_PRODUCTS,
    );
    const canEdit = await hasVendorPermission(
      user,
      VENDOR_PERMISSIONS.EDIT_PRODUCTS,
    );
    if (!canCreate && !canEdit && !isAdmin(user)) {
      throw new AuthorizationError(
        "You do not have permission to import products",
      );
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:products:import",
      "moderate",
      session.user.role,
    );

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    if (!vendor) throw new AuthorizationError("Vendor profile not found");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return errorResponse("CSV file is required.", 400);
    }

    const result = await importProductsCsv(await file.text(), {
      defaultVendorId: String(vendor._id),
      productSource: "vendor",
      forceVendorId: String(vendor._id),
      allowVendorColumn: false,
      allowFeatured: false,
    });

    return successResponse(result);
  },
);
