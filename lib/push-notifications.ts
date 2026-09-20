import * as webpush from "web-push";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { PushSubscription } from "@/models";
import { locales, defaultLocale, type Locale } from "@/config/i18n.config";

export interface BrowserPushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  type?: string;
  notificationId?: string;
}

type StoredPushSubscription = {
  _id: Types.ObjectId | string;
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  locale?: string;
};

let vapidInitialized = false;

function getVapidPublicKey() {
  return (
    process.env.WEB_PUSH_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ||
    ""
  ).trim();
}

function getVapidPrivateKey() {
  return (process.env.WEB_PUSH_PRIVATE_KEY || "").trim();
}

function normalizeVapidSubject(value: string | undefined) {
  const subject = (value || "").trim();
  if (subject.startsWith("mailto:") || subject.startsWith("https://")) {
    return subject;
  }
  if (subject.includes("@")) return `mailto:${subject}`;
  return "mailto:admin@example.com";
}

export function getWebPushStatus() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();

  return {
    configured: Boolean(publicKey && privateKey),
    publicKey: publicKey || null,
  };
}

function configureWebPush() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return false;

  if (!vapidInitialized) {
    webpush.setVapidDetails(
      normalizeVapidSubject(
        process.env.WEB_PUSH_SUBJECT || process.env.NEXT_PUBLIC_APP_URL,
      ),
      publicKey,
      privateKey,
    );
    vapidInitialized = true;
  }

  return true;
}

function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

function withLocalePrefix(url: string | undefined, locale: string | undefined) {
  const fallbackLocale = isLocale(locale) ? locale : defaultLocale;
  const target = url && url.trim() ? url.trim() : `/${fallbackLocale}`;

  if (/^https?:\/\//i.test(target)) return target;
  if (!target.startsWith("/")) return `/${fallbackLocale}/${target}`;

  const firstSegment = target.split("/").filter(Boolean)[0];
  if (isLocale(firstSegment)) return target;

  return `/${fallbackLocale}${target === "/" ? "" : target}`;
}

function toWebPushSubscription(subscription: StoredPushSubscription) {
  if (!subscription.keys?.p256dh || !subscription.keys?.auth) return null;

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  } satisfies webpush.PushSubscription;
}

async function deactivateSubscription(
  subscriptionId: Types.ObjectId | string,
  failureReason: string,
) {
  await PushSubscription.updateOne(
    { _id: subscriptionId },
    {
      $set: {
        isActive: false,
        failedAt: new Date(),
        failureReason,
      },
    },
  );
}

export async function sendBrowserPushToUser(
  userId: string,
  payload: BrowserPushPayload,
) {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  await connectDB();

  const subscriptions = (await PushSubscription.find({
    userId,
    isActive: true,
  })
    .select("_id endpoint expirationTime keys locale")
    .lean()) as StoredPushSubscription[];

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const webPushSubscription = toWebPushSubscription(subscription);
      if (!webPushSubscription) {
        failed += 1;
        await deactivateSubscription(subscription._id, "Invalid push keys");
        return;
      }

      const localizedPayload: BrowserPushPayload = {
        ...payload,
        icon: payload.icon || "/pwa/icon.svg",
        badge: payload.badge || "/pwa/badge.svg",
        url: withLocalePrefix(payload.url, subscription.locale),
      };

      try {
        await webpush.sendNotification(
          webPushSubscription,
          JSON.stringify(localizedPayload),
          {
            TTL: 60 * 60 * 24,
            urgency: "normal",
          },
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode =
          error instanceof webpush.WebPushError ? error.statusCode : undefined;
        const message =
          error instanceof Error ? error.message : "Push delivery failed";

        if (statusCode === 404 || statusCode === 410) {
          await deactivateSubscription(subscription._id, message);
          return;
        }

        await PushSubscription.updateOne(
          { _id: subscription._id },
          {
            $set: {
              failedAt: new Date(),
              failureReason: message.slice(0, 500),
            },
          },
        );
      }
    }),
  );

  return { sent, failed, skipped: false };
}
