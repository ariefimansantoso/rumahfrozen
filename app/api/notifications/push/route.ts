import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { successResponse } from "@/lib/api/response";
import {
  AuthenticationError,
  ValidationError,
  handleApiError,
} from "@/lib/api/errors";
import { PushSubscription } from "@/models";
import { getWebPushStatus } from "@/lib/push-notifications";
import { withApi } from "@/lib/api/handler";

type BrowserSubscriptionBody = {
  subscription?: {
    endpoint?: unknown;
    expirationTime?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };
  locale?: unknown;
};

function parseSubscription(body: BrowserSubscriptionBody) {
  const subscription = body.subscription;

  if (!subscription || typeof subscription !== "object") {
    throw new ValidationError("Push subscription is required");
  }

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const authSecret = subscription.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    !endpoint ||
    typeof p256dh !== "string" ||
    !p256dh ||
    typeof authSecret !== "string" ||
    !authSecret
  ) {
    throw new ValidationError("Invalid push subscription");
  }

  return {
    endpoint,
    expirationTime:
      typeof subscription.expirationTime === "number"
        ? subscription.expirationTime
        : null,
    keys: {
      p256dh,
      auth: authSecret,
    },
  };
}

export const GET = withApi(
  { auth: "user" },
  async ({ session }) => {
    const [activeSubscriptions, inactiveSubscriptions] = await Promise.all([
      PushSubscription.countDocuments({
        userId: session.user.id,
        isActive: true,
      }),
      PushSubscription.countDocuments({
        userId: session.user.id,
        isActive: false,
      }),
    ]);

    return successResponse({
      ...getWebPushStatus(),
      activeSubscriptions,
      inactiveSubscriptions,
    });
  },
);

export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const status = getWebPushStatus();
    if (!status.configured) {
      throw new ValidationError(
        "Browser push is not configured. Add WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY.",
      );
    }

    const body = (await request.json()) as BrowserSubscriptionBody;
    const subscription = parseSubscription(body);
    const userAgent = request.headers.get("user-agent") || undefined;
    const locale = typeof body.locale === "string" ? body.locale : undefined;

    await connectDB();

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId: session.user.id,
          role:
            typeof session.user.role === "string"
              ? session.user.role
              : undefined,
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: subscription.keys,
          locale,
          userAgent,
          isActive: true,
          lastSeenAt: new Date(),
          failedAt: undefined,
          failureReason: undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const activeSubscriptions = await PushSubscription.countDocuments({
      userId: session.user.id,
      isActive: true,
    });

    return successResponse({
      ...status,
      activeSubscriptions,
    });
  },
);

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();

    let endpoint: unknown;
    try {
      const body = (await request.json()) as { endpoint?: unknown };
      endpoint = body.endpoint;
    } catch {
      endpoint = undefined;
    }

    await connectDB();

    const query =
      typeof endpoint === "string" && endpoint
        ? { userId: session.user.id, endpoint }
        : { userId: session.user.id };

    await PushSubscription.updateMany(query, {
      $set: {
        isActive: false,
        failedAt: new Date(),
        failureReason: "Disabled by user",
      },
    });

    const activeSubscriptions = await PushSubscription.countDocuments({
      userId: session.user.id,
      isActive: true,
    });

    return successResponse({
      ...getWebPushStatus(),
      activeSubscriptions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
