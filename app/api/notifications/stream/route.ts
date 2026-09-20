import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models";
import { handleApiError, AuthenticationError } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NotificationTab = "all" | "unread" | "archived";

type LeanNotification = {
  _id: unknown;
  type: string;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
  isRead?: boolean;
  isArchived?: boolean;
  createdAt?: Date | string;
};

function getTabQuery(tab: NotificationTab, userId: string) {
  const query: Record<string, unknown> = { userId };

  if (tab === "archived") {
    query.isArchived = true;
    return query;
  }

  query.isArchived = { $ne: true };
  if (tab === "unread") query.isRead = false;

  return query;
}

async function getNotificationCounts(userId: string) {
  const [all, unread, archived] = await Promise.all([
    Notification.countDocuments({ userId, isArchived: { $ne: true } }),
    Notification.countDocuments({
      userId,
      isRead: false,
      isArchived: { $ne: true },
    }),
    Notification.countDocuments({ userId, isArchived: true }),
  ]);

  return { all, unread, archived };
}

function parseTab(value: string | null): NotificationTab {
  return value === "unread" || value === "archived" ? value : "all";
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "20", 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 50);
}

function serializeNotification(notification: LeanNotification) {
  const createdAtDate = notification.createdAt
    ? new Date(notification.createdAt)
    : new Date();
  const createdAt = Number.isNaN(createdAtDate.getTime())
    ? new Date().toISOString()
    : createdAtDate.toISOString();

  return {
    _id: String(notification._id),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    data: notification.data,
    isRead: Boolean(notification.isRead),
    isArchived: Boolean(notification.isArchived),
    createdAt,
  };
}

async function getNotificationSnapshot(
  userId: string,
  tab: NotificationTab,
  limit: number,
) {
  await connectDB();

  const [notifications, recentUnreadNotifications, counts] = await Promise.all([
    Notification.find(getTabQuery(tab, userId))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Notification.find({
      userId,
      isRead: false,
      isArchived: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    getNotificationCounts(userId),
  ]);

  return {
    notifications: (notifications as unknown as LeanNotification[]).map(
      serializeNotification,
    ),
    recentUnreadNotifications: (
      recentUnreadNotifications as unknown as LeanNotification[]
    ).map(serializeNotification),
    counts,
    unreadCount: counts.unread,
    serverTime: new Date().toISOString(),
  };
}

function createSnapshotSignature(snapshot: Awaited<
  ReturnType<typeof getNotificationSnapshot>
>) {
  return JSON.stringify({
    counts: snapshot.counts,
    notifications: snapshot.notifications.map((notification) => [
      notification._id,
      notification.isRead,
      notification.isArchived,
    ]),
    recentUnreadNotifications: snapshot.recentUnreadNotifications.map(
      (notification) => notification._id,
    ),
  });
}

const encoder = new TextEncoder();

function encodeEvent(event: string, data: unknown) {
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

function encodeComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

/**
 * GET /api/notifications/stream
 * Live notification snapshots for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();

    const searchParams = request.nextUrl.searchParams;
    const tab = parseTab(searchParams.get("tab"));
    const limit = parseLimit(searchParams.get("limit"));
    const userId = session.user.id;

    await connectDB();

    let closed = false;
    let snapshotTimer: ReturnType<typeof setInterval> | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    const closeStream = () => {
      closed = true;
      if (snapshotTimer) clearInterval(snapshotTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
    request.signal.addEventListener("abort", closeStream, { once: true });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let inFlight = false;
        let lastSignature = "";

        const enqueue = (chunk: Uint8Array) => {
          if (closed) return;
          try {
            controller.enqueue(chunk);
          } catch {
            closeStream();
          }
        };

        const sendSnapshot = async () => {
          if (closed || inFlight) return;
          inFlight = true;

          try {
            const snapshot = await getNotificationSnapshot(userId, tab, limit);
            const signature = createSnapshotSignature(snapshot);

            if (signature !== lastSignature) {
              lastSignature = signature;
              enqueue(encodeEvent("snapshot", snapshot));
            }
          } catch (error) {
            console.error("Notification stream snapshot failed:", error);
            enqueue(
              encodeEvent("stream-error", {
                message: "Notification stream temporarily unavailable",
              }),
            );
          } finally {
            inFlight = false;
          }
        };

        enqueue(encodeComment("connected"));
        void sendSnapshot();
        snapshotTimer = setInterval(() => void sendSnapshot(), 3000);
        heartbeatTimer = setInterval(
          () => enqueue(encodeComment(`keep-alive ${Date.now()}`)),
          25000,
        );
      },
      cancel() {
        closeStream();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
