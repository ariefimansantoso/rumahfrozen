import { Brand } from "@/models";
import { createdResponse } from "@/lib/api/response";
import { withApi } from "@/lib/api/handler";
import {
  parseListQuery,
  runListQuery,
  listResponse,
} from "@/lib/api/list-query";
import { isAdmin } from "@/lib/rbac";
import {
  slugifyBrand,
  getRequestedBrandSlug,
  normalizeBrandSeo,
  BRAND_APPROVAL_STATUS,
  STOREFRONT_BRAND_FILTER,
} from "@/lib/brands";
import { revalidateBrandContent } from "@/lib/cache-invalidation";

/**
 * GET /api/brands
 * Fetch brands with optional pagination/search/status filters.
 *
 * - `assignable=true` returns only brands that can be attached to a product
 *   (approved, active, not archived) regardless of caller role. Used by the
 *   product form brand selector.
 * - Admins otherwise see all non-archived brands and can filter by moderation
 *   state (`status=pending|rejected|archived`).
 * - Everyone else only sees the public storefront set.
 */
export const GET = withApi({ auth: "optional" }, async ({ request, session }) => {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const featured = searchParams.get("featured");
  const assignable = searchParams.get("assignable") === "true";
  const admin = isAdmin(session?.user);

  const query: Record<string, unknown> = {};

  if (assignable || !admin) {
    // Public / assignment view: only approved, live, non-archived brands.
    Object.assign(query, STOREFRONT_BRAND_FILTER);
  } else {
    // Admin moderation view.
    if (status === "archived") {
      query.deletedAt = { $ne: null };
    } else {
      query.deletedAt = null;
      if (status === "active") {
        query.isActive = true;
      } else if (status === "inactive") {
        query.isActive = false;
      } else if (status === "featured") {
        query.featured = true;
      } else if (status === "pending") {
        query.approvalStatus = BRAND_APPROVAL_STATUS.PENDING;
      } else if (status === "rejected") {
        query.approvalStatus = BRAND_APPROVAL_STATUS.REJECTED;
      }
    }
  }

  if (featured === "true") {
    query.featured = true;
  } else if (featured === "false") {
    query.featured = { $ne: true };
  }

  const listQuery = parseListQuery(request, {
    allowedSortFields: ["name", "productCount", "createdAt", "updatedAt", "order"],
    defaultSort: { order: 1, name: 1 },
    tieBreaker: { name: 1 },
  });

  if (listQuery.search) {
    const pattern = { $regex: listQuery.search, $options: "i" };
    query.$or = [{ name: pattern }, { slug: pattern }];
  }

  return listResponse(await runListQuery(Brand, query, listQuery), listQuery);
});

/**
 * POST /api/brands
 * Create a new brand (Admin only)
 */
export const POST = withApi({ auth: "admin" }, async ({ request }) => {
  const body = await request.json();

  const requestedSlug = getRequestedBrandSlug(body);
  const slug = requestedSlug || slugifyBrand(body.name);
  const seo = normalizeBrandSeo(body);
  if (seo) {
    body.seo = seo;
  } else {
    delete body.seo;
  }

  const existing = await Brand.findOne({ slug });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  // Admin-created brands are platform-owned and auto-approved.
  const brand = await Brand.create({
    ...body,
    slug: finalSlug,
    order: body.displayOrder || 0,
    ownerVendorId: null,
    approvalStatus: BRAND_APPROVAL_STATUS.APPROVED,
  });

  revalidateBrandContent({ slugs: [brand.slug] });

  return createdResponse(brand);
});
