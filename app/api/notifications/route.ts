import { Notification } from "@/models";
import { successResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import { parsePageLimit } from "@/lib/api/list-query";

type NotificationTab = "all" | "unread" | "archived";
type NotificationAction = "read" | "unread" | "archive" | "unarchive";

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

/**
 * GET /api/notifications
 * Get current user's notifications
 */
export const GET = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = parsePageLimit(searchParams, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const unreadOnly = searchParams.get("unread") === "true";
    const tabParam = searchParams.get("tab");
    const tab: NotificationTab =
      tabParam === "unread" || tabParam === "archived" ? tabParam : "all";

    const query = unreadOnly
      ? getTabQuery("unread", session.user.id)
      : getTabQuery(tab, session.user.id);

    const [notifications, total, counts] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      getNotificationCounts(session.user.id),
    ]);

    return successResponse({
      notifications,
      unreadCount: counts.unread,
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

/**
 * PUT /api/notifications
 * Mark notifications as read
 */
export const PUT = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const body = await request.json();
    const { ids, markAll, action } = body as {
      ids?: unknown;
      markAll?: unknown;
      action?: unknown;
    };
    const notificationAction: NotificationAction =
      action === "unread" ||
      action === "archive" ||
      action === "unarchive" ||
      action === "read"
        ? action
        : "read";

    const updateByAction: Record<NotificationAction, Record<string, unknown>> = {
      read: { isRead: true },
      unread: { isRead: false },
      archive: { isArchived: true, isRead: true },
      unarchive: { isArchived: false },
    };

    if (markAll) {
      await Notification.updateMany(
        { userId: session.user.id, isRead: false, isArchived: { $ne: true } },
        { $set: { isRead: true } },
      );
    } else if (ids && Array.isArray(ids)) {
      await Notification.updateMany(
        { _id: { $in: ids }, userId: session.user.id },
        { $set: updateByAction[notificationAction] },
      );
    } else {
      throw new ValidationError("Notification ids are required");
    }

    const counts = await getNotificationCounts(session.user.id);

    return successResponse({ unreadCount: counts.unread, counts });
  },
);

/**
 * DELETE /api/notifications
 * Delete notifications
 */
export const DELETE = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const notificationId = request.nextUrl.searchParams.get("id");
    const deleteAll = request.nextUrl.searchParams.get("all") === "true";

    if (deleteAll) {
      await Notification.deleteMany({ userId: session.user.id });
    } else if (notificationId) {
      await Notification.deleteOne({
        _id: notificationId,
        userId: session.user.id,
      });
    }

    const counts = await getNotificationCounts(session.user.id);

    return successResponse({
      message: "Notifications deleted",
      unreadCount: counts.unread,
      counts,
    });
  },
);
