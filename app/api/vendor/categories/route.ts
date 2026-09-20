import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Category, Product } from "@/models";
import { successResponse } from "@/lib/api/response";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { hasVendorPermission } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { withApi } from "@/lib/api/handler";

interface VendorCategoryRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  parentName?: string | null;
  isActive: boolean;
  productCount: number;
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
      throw new AuthorizationError("You do not have permission to view categories");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:categories:list",
      "lenient",
      session.user.role,
    );

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const vendorId = new mongoose.Types.ObjectId(String(vendor._id));

    const grouped = await Product.aggregate<{ _id: mongoose.Types.ObjectId; productCount: number }>([
      { $match: { vendorId, category: { $ne: null } } },
      { $group: { _id: "$category", productCount: { $sum: 1 } } },
    ]);

    const countByCategory = new Map(grouped.map((item) => [String(item._id), item.productCount]));
    const categoryIds = grouped.map((item) => item._id);

    const categoryQuery: Record<string, unknown> = { _id: { $in: categoryIds } };
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      categoryQuery.name = { $regex: escapedSearch, $options: "i" };
    }
    if (status === "active") categoryQuery.isActive = true;
    if (status === "inactive") categoryQuery.isActive = false;

    const categories = await Category.find(categoryQuery)
      .select("name slug description image parentId isActive")
      .lean();

    const parentIds = Array.from(
      new Set(categories.map((category) => category.parentId).filter(Boolean).map(String)),
    );
    const parents = parentIds.length
      ? await Category.find({ _id: { $in: parentIds } }).select("name").lean()
      : [];
    const parentNameById = new Map(parents.map((parent) => [String(parent._id), parent.name]));

    const rows: VendorCategoryRow[] = categories.map((category) => ({
      _id: String(category._id),
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      parentId: category.parentId ? String(category.parentId) : null,
      parentName: category.parentId ? parentNameById.get(String(category.parentId)) || null : null,
      isActive: category.isActive,
      productCount: countByCategory.get(String(category._id)) || 0,
    }));

    const sortSelectors: Record<string, (row: VendorCategoryRow) => string | number | boolean> = {
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
