import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import type { StaffPermission } from "@/config/permissions.config";
import {
  assertAdminOrStaffPermissions,
} from "@/lib/staff-authz";
import type { StaffAccessScope } from "@/lib/staff-scope";
import {
  rateLimitByIP,
  rateLimitByUser,
  type RateLimitPreset,
} from "@/lib/api/rate-limit-middleware";
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/api/errors";

/**
 * Route-handler wrapper that owns the boilerplate every API route repeats:
 * DB connection, session loading, role gating, rate limiting, awaiting
 * dynamic route params, and the try/catch that funnels errors through
 * `handleApiError`.
 *
 * ```ts
 * export const GET = withApi({ auth: "optional" }, async ({ request, session }) => {
 *   ...
 *   return successResponse(data);
 * });
 *
 * export const PUT = withApi<{ id: string }>(
 *   {
 *     auth: "admin",
 *     rateLimit: { action: "admin:coupons:update", preset: "moderate" },
 *   },
 *   async ({ request, params, session }) => {
 *     // session is non-null here; params.id is typed
 *     return successResponse(await update(params.id));
 *   },
 * );
 * ```
 *
 * Auth modes:
 * - undefined        — public route; the session is not loaded.
 * - "optional"       — session is loaded but may be null (public routes
 *                      that render more for admins).
 * - "user"           — any authenticated session required.
 * - "admin"          — authenticated admin required.
 * - "admin-or-staff" — admin, or an active staff member holding
 *                      `staffPermissions` (checked in `staffMode`);
 *                      the staff grants land in `ctx.staff`.
 */

export type ApiSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export interface StaffGrants {
  /** Set for staff callers; undefined when the caller is a full admin. */
  permissions?: StaffPermission[];
  scope?: StaffAccessScope;
}

export interface ApiContext<TParams> {
  request: NextRequest;
  /** Awaited dynamic route params (empty object for static routes). */
  params: TParams;
  session: ApiSession | null;
  /** Present only for auth: "admin-or-staff". */
  staff?: StaffGrants;
}

export interface AuthedApiContext<TParams> extends ApiContext<TParams> {
  session: ApiSession;
}

interface WithApiOptions {
  auth?: "optional" | "user" | "admin" | "admin-or-staff";
  /** Permissions required for staff callers (auth: "admin-or-staff"). */
  staffPermissions?: StaffPermission[];
  /** Whether staff need any (default) or all of `staffPermissions`. */
  staffMode?: "any" | "all";
  /**
   * Per-user rate limit (per-IP when the route is public / the caller is
   * anonymous). `action` names the bucket, e.g. "admin:coupons:list".
   */
  rateLimit?: { action: string; preset?: RateLimitPreset };
  /** Set false for routes that never touch Mongoose. Defaults to true. */
  db?: boolean;
}

type RouteHandler<TParams> = (
  request: NextRequest,
  context: { params: Promise<TParams> },
) => Promise<NextResponse | Response>;

export function withApi<TParams = Record<string, never>>(
  options: WithApiOptions & { auth: "user" | "admin" | "admin-or-staff" },
  handler: (ctx: AuthedApiContext<TParams>) => Promise<NextResponse | Response>,
): RouteHandler<TParams>;
export function withApi<TParams = Record<string, never>>(
  options: WithApiOptions & { auth?: "optional" },
  handler: (ctx: ApiContext<TParams>) => Promise<NextResponse | Response>,
): RouteHandler<TParams>;
export function withApi<TParams = Record<string, never>>(
  options: WithApiOptions,
  handler: (ctx: AuthedApiContext<TParams>) => Promise<NextResponse | Response>,
): RouteHandler<TParams> {
  return async (request, context) => {
    try {
      let session: ApiSession | null = null;
      let staff: StaffGrants | undefined;

      if (options.auth) {
        session = await auth.api.getSession({ headers: await headers() });
        if (options.auth !== "optional") {
          if (!session) throw new AuthenticationError();
          if (options.auth === "admin" && !isAdmin(session.user)) {
            throw new AuthorizationError();
          }
          if (options.auth === "admin-or-staff") {
            const grants = await assertAdminOrStaffPermissions(
              session as unknown as { user: { id: string; role: string } },
              options.staffPermissions,
              options.staffMode,
            );
            staff = {
              permissions: grants.staffPermissions,
              scope: grants.staffScope,
            };
          }
        }
      }

      if (options.rateLimit) {
        const preset = options.rateLimit.preset ?? "lenient";
        if (session) {
          rateLimitByUser(
            request,
            session.user.id,
            options.rateLimit.action,
            preset,
            session.user.role,
          );
        } else {
          rateLimitByIP(request, preset);
        }
      }

      if (options.db !== false) await connectDB();

      const params = context?.params
        ? await context.params
        : ({} as TParams);

      // The overloads guarantee handlers only see a non-null session when
      // they declared auth: "user" | "admin" | "admin-or-staff"; the cast
      // reflects that.
      return await handler({
        request,
        params,
        session: session as ApiSession,
        staff,
      });
    } catch (error) {
      return handleApiError(error);
    }
  };
}
