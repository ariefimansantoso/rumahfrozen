import { connectDB } from "@/lib/db";
import { PaymentTransaction } from "@/models";
import { paginatedResponse } from "@/lib/api/response";
import { withApi } from "@/lib/api/handler";

export const GET = withApi(
  {
    auth: "admin",
    rateLimit: { action: "admin:payments:transactions:list", preset: "lenient" },
  },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const status = (searchParams.get("status") || "all").trim().toLowerCase();
    const type = (searchParams.get("type") || "all").trim().toLowerCase();
    const provider = (searchParams.get("provider") || "all").trim().toLowerCase();
    const search = (searchParams.get("search") || "").trim();
    const requestedSortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortableFields = new Set(["createdAt", "grossAmount", "netAmount"]);
    const sortBy = sortableFields.has(requestedSortBy)
      ? requestedSortBy
      : "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    const query: Record<string, unknown> = {};
    if (status !== "all") query.status = status;
    if (type !== "all") query.type = type;
    if (provider !== "all") query.provider = provider;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { orderNumber: { $regex: escaped, $options: "i" } },
        { externalId: { $regex: escaped, $options: "i" } },
        { paymentMethod: { $regex: escaped, $options: "i" } },
      ];
    }

    await connectDB();
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentTransaction.countDocuments(query),
    ]);

    return paginatedResponse(transactions as Record<string, unknown>[], page, limit, total);
  },
);
