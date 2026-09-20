import { connectDB } from "@/lib/db";
import { Collection } from "@/models";
import { paginatedResponse, createdResponse } from "@/lib/api/response";
import { validateQuery, validateBody } from "@/lib/api/validate";
import {
  CollectionListQuerySchema,
  CreateCollectionSchema,
} from "@/lib/validations";
import { normalizeCollectionConditions, updateCollectionProductCount } from "@/lib/collections";
import { revalidateCollectionContent } from "@/lib/cache-invalidation";
import { withApi } from "@/lib/api/handler";

function toHandle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * GET /api/admin/collections
 * Get all collections for admin
 */
export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:collections:list", preset: "lenient" },
  },
  async ({ request }) => {
    const { page, limit, search, status, type, channel, sortOrder } =
      validateQuery(request, CollectionListQuerySchema);

    await connectDB();

    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (type) {
      query.collectionType = type;
    }

    if (channel) {
      query[`publishing.${channel}`] = true;
    }

    const [collections, total] = await Promise.all([
      Collection.find(query)
        .sort({ position: 1, createdAt: sortOrder === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Collection.countDocuments(query),
    ]);

    return paginatedResponse(collections, page, limit, total);
  },
);

/**
 * POST /api/admin/collections
 * Create a new collection
 */
export const POST = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:collections:create", preset: "moderate" },
  },
  async ({ request }) => {
    const body = await validateBody(request, CreateCollectionSchema);

    const baseHandle =
      typeof body?.seo?.handle === "string" && body.seo.handle.trim()
        ? body.seo.handle.trim()
        : body.title;

    const slug = toHandle(baseHandle);

    const existingCollection = await Collection.findOne({ slug });
    const finalSlug = existingCollection ? `${slug}-${Date.now()}` : slug;

    const normalizedConditions =
      body.collectionType === "automated" && Array.isArray(body.conditions) && body.conditions.length > 0
        ? await normalizeCollectionConditions(body.conditions)
        : body.conditions;

    const collectionData = {
      ...body,
      conditions: normalizedConditions,
      slug: finalSlug,
      handle: finalSlug,
      seo: { ...(body.seo || {}), handle: finalSlug },
    };

    const collection = await Collection.create(collectionData);

    // Update product count
    await updateCollectionProductCount(collection._id.toString());

    // Fetch the updated collection
    const updatedCollection = await Collection.findById(collection._id).lean();

    revalidateCollectionContent({ slugs: [updatedCollection?.slug] });

    return createdResponse(updatedCollection);
  },
);
