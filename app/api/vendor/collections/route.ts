import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Collection, Product } from "@/models";
import { successResponse } from "@/lib/api/response";
import { AuthorizationError, NotFoundError } from "@/lib/api/errors";
import { getSettings } from "@/models/settings.model";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { hasVendorPermission } from "@/lib/rbac";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import type { IUser } from "@/types";
import { withApi } from "@/lib/api/handler";

interface VendorCollectionRow {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  image?: { url: string; alt?: string };
  collectionType: "manual" | "automated";
  status: "active" | "draft";
  productCount: number;
  publishing: {
    onlineStore: boolean;
    pointOfSale: boolean;
  };
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
      throw new AuthorizationError("You do not have permission to view collections");
    }

    rateLimitByUser(
      request,
      session.user.id,
      "vendor:collections:list",
      "lenient",
      session.user.role,
    );

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    await connectDB();
    const settings = await getSettings();
    if (!settings.multiVendorMode?.enabled) throw new NotFoundError("Vendor");

    const vendor = await requireApprovedVendorByUserId(session.user.id);
    const vendorId = new mongoose.Types.ObjectId(String(vendor._id));

    const grouped = await Product.aggregate<{ _id: mongoose.Types.ObjectId; productCount: number }>([
      { $match: { vendorId, collectionIds: { $exists: true, $ne: [] } } },
      { $unwind: "$collectionIds" },
      { $group: { _id: "$collectionIds", productCount: { $sum: 1 } } },
    ]);

    const countByCollection = new Map(grouped.map((item) => [String(item._id), item.productCount]));
    const collectionIds = grouped.map((item) => item._id);

    const collectionQuery: Record<string, unknown> = { _id: { $in: collectionIds } };
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      collectionQuery.title = { $regex: escapedSearch, $options: "i" };
    }
    if (status === "active" || status === "draft") collectionQuery.status = status;
    if (type === "manual" || type === "automated") collectionQuery.collectionType = type;

    const collections = await Collection.find(collectionQuery)
      .select("title slug description image collectionType status publishing createdAt updatedAt")
      .lean();

    const rows: VendorCollectionRow[] = collections.map((collection) => ({
      _id: String(collection._id),
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      image: collection.image,
      collectionType: collection.collectionType,
      status: collection.status,
      productCount: countByCollection.get(String(collection._id)) || 0,
      publishing: {
        onlineStore: Boolean(collection.publishing?.onlineStore),
        pointOfSale: Boolean(collection.publishing?.pointOfSale),
      },
    }));

    const sortSelectors: Record<string, (row: VendorCollectionRow) => string | number> = {
      title: (row) => row.title,
      productCount: (row) => row.productCount,
      status: (row) => row.status,
      collectionType: (row) => row.collectionType,
      createdAt: (row) => row.title,
      updatedAt: (row) => row.title,
    };
    const getSortValue = sortSelectors[sortBy] || sortSelectors.title;
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
