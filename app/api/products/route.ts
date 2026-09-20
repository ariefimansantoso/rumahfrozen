import { paginatedResponse } from "@/lib/api/response";
import { rateLimitByIP } from "@/lib/api/rate-limit-middleware";
import { getStorefrontProducts } from "@/lib/products/storefront-products";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/products
 * Fetch products with filtering, sorting, and pagination.
 */
export const GET = withApi(
  {},
  async ({ request }) => {
    rateLimitByIP(request, "lenient");

    const searchParams = request.nextUrl.searchParams;
    const result = await getStorefrontProducts({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      vendor: searchParams.get("vendor"),
      tag: searchParams.get("tag"),
      search: searchParams.get("search"),
      minPrice: searchParams.get("minPrice"),
      maxPrice: searchParams.get("maxPrice"),
      status: searchParams.get("status"),
      featured: searchParams.get("featured"),
      preorder: searchParams.get("preorder"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
      category: searchParams.getAll("category"),
      collection: searchParams.getAll("collection"),
      brand: searchParams.getAll("brand"),
      onSale: searchParams.get("onSale"),
      ids: searchParams.get("ids"),
      minRating: searchParams.get("minRating"),
      inStock: searchParams.get("inStock"),
    });

    return paginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
    );
  },
);
