import { isAdmin } from "@/lib/rbac";
import { successResponse } from "@/lib/api/response";
import { AuthorizationError } from "@/lib/api/errors";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { getDashboardData } from "@/lib/admin/dashboard-data";
import { withApi } from "@/lib/api/handler";

/**
 * GET /api/admin/dashboard
 * Returns every dataset rendered by the admin dashboard so the page shell can
 * paint instantly and swap skeletons for real data once this resolves.
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    if (!isAdmin(session.user)) throw new AuthorizationError();

    rateLimitByUser(
      request,
      session.user.id,
      "admin:dashboard",
      "lenient",
      session.user.role,
    );

    const data = await getDashboardData();
    return successResponse(data);
  },
);
