import { paginatedResponse } from "@/lib/api/response";
import { withApi } from "@/lib/api/handler";
import { isValidObjectId, validateQuery } from "@/lib/api/validate";
import { AdminReturnListQuerySchema } from "@/lib/validations";
import { ReturnRequest } from "@/models";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";

export const GET = withApi(
  {
    auth: "admin-or-staff",
    staffPermissions: [STAFF_PERMISSIONS.VIEW_ORDERS],
    rateLimit: { action: "admin:returns:list", preset: "lenient" },
  },
  async ({ request }) => {
    const { page, limit, search, status, sortBy, sortOrder, orderId } = validateQuery(
      request,
      AdminReturnListQuerySchema,
    );

    const andConditions: Record<string, unknown>[] = [
      { $or: [{ ownerType: "admin" }, { ownerType: { $exists: false } }] },
    ];
    if (status && status !== "all") {
      andConditions.push({ status });
    }
    if (orderId) {
      andConditions.push(isValidObjectId(orderId) ? { orderId } : { _id: null });
    }
    if (search) {
      andConditions.push({
        $or: [
          { returnNumber: { $regex: search, $options: "i" } },
          { orderNumber: { $regex: search, $options: "i" } },
        ],
      });
    }

    const query = andConditions.length ? { $and: andConditions } : {};
    const allowedSortFields = new Set(["createdAt", "returnNumber", "status"]);
    const effectiveSortBy =
      sortBy && allowedSortFields.has(sortBy) ? sortBy : "createdAt";
    const sort: Record<string, 1 | -1> = {
      [effectiveSortBy]: sortOrder === "asc" ? 1 : -1,
    };
    const skip = (page - 1) * limit;

    const [returns, total] = await Promise.all([
      ReturnRequest.find(query)
        .populate("customerId", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ReturnRequest.countDocuments(query),
    ]);

    return paginatedResponse(returns, page, limit, total);
  },
);
