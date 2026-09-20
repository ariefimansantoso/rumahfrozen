import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import {
  CustomerProfile,
  SupportConversation,
  User,
} from "@/models";
import { getSettings } from "@/models/settings.model";
import {
  SUPPORT_CONVERSATION_STATUS,
  SUPPORT_SENDER_TYPES,
  type ISupportConversation,
  type ISupportMessageEntry,
  type ISupportSenderSnapshot,
  type SupportSenderType,
} from "@/models/support-conversation.model";
import { NotificationType } from "@/models/notification.model";
import { USER_ACCOUNT_STATUS, USER_ROLES } from "@/config/app.config";
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_STORE_NAME,
} from "@/config/branding.config";

export type SupportConversationDTO = {
  _id: string;
  subject: string;
  sender: {
    userId?: string;
    type: SupportSenderType;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    image?: string;
    status?: string;
    profileId?: string;
  };
  messages: Array<{
    _id?: string;
    senderType: SupportSenderType;
    senderUserId?: string;
    senderName: string;
    senderEmail?: string;
    senderImage?: string;
    body: string;
    createdAt: string;
  }>;
  status: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastAdminReplyAt?: string;
  createdAt: string;
  updatedAt: string;
};

type LeanUser = {
  _id: unknown;
  name?: string;
  email?: string;
  image?: string;
  role?: string;
  roles?: string[];
  status?: string;
};

type SubmittedContactMessage = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
};

const SUPPORT_INBOX_LINK = "/admin/inbox";
const CUSTOMER_INBOX_LINK = "/account/inbox";

export function getSupportInboxLink(conversationId?: string) {
  return conversationId
    ? `${SUPPORT_INBOX_LINK}?conversation=${conversationId}`
    : SUPPORT_INBOX_LINK;
}

function getIdString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const maybeObject = value as {
    _id?: unknown;
    toHexString?: () => string;
    toString?: () => string;
  };
  if (typeof maybeObject.toHexString === "function") {
    return maybeObject.toHexString();
  }
  if (typeof maybeObject.toString === "function") {
    const text = maybeObject.toString();
    if (text && text !== "[object Object]") return text;
  }
  if (maybeObject._id && maybeObject._id !== value) {
    return getIdString(maybeObject._id);
  }
  return "";
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function toObjectId(value?: string) {
  return value && Types.ObjectId.isValid(value)
    ? new Types.ObjectId(value)
    : undefined;
}

function getPrimarySenderType(user?: LeanUser | null): SupportSenderType {
  if (!user) return SUPPORT_SENDER_TYPES.GUEST;

  const roles = new Set([user?.role, ...(user?.roles || [])].filter(Boolean));
  if (roles.has(USER_ROLES.CUSTOMER)) return SUPPORT_SENDER_TYPES.CUSTOMER;
  return SUPPORT_SENDER_TYPES.GUEST;
}

function isCustomerUser(user?: LeanUser | null) {
  const roles = new Set([user?.role, ...(user?.roles || [])].filter(Boolean));
  return roles.has(USER_ROLES.CUSTOMER);
}

export async function resolveSupportSenderSnapshot(params: {
  sessionUserId?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
}): Promise<ISupportSenderSnapshot> {
  await connectDB();

  const email = params.email.trim().toLowerCase();
  const sessionUser = params.sessionUserId
    ? await User.findById(params.sessionUserId)
        .select("_id name email image role roles status")
        .lean<LeanUser | null>()
    : null;
  const user = isCustomerUser(sessionUser) ? sessionUser : null;

  const userId = getIdString(user?._id);
  const senderType = getPrimarySenderType(user);
  const status = user?.status;
  let profileId: Types.ObjectId | undefined;

  if (userId) {
    const customerProfile = await CustomerProfile.findOne({ userId })
      .select("_id")
      .lean<{ _id: unknown } | null>();
    profileId = toObjectId(getIdString(customerProfile?._id));
  }

  return {
    userId: toObjectId(userId),
    type: senderType,
    name: user?.name?.trim() || params.name.trim(),
    email: user?.email?.trim().toLowerCase() || email,
    phone: params.phone?.trim() || undefined,
    company: params.company?.trim() || undefined,
    image: user?.image || undefined,
    status: status || undefined,
    profileId,
  };
}

function serializeConversation(
  conversation: ISupportConversation | Record<string, unknown>,
): SupportConversationDTO {
  const doc = conversation as ISupportConversation & {
    _id: unknown;
  };
  const messages = (doc.messages || []) as Array<
    ISupportMessageEntry & { _id?: unknown }
  >;

  return {
    _id: getIdString(doc._id),
    subject: doc.subject,
    sender: {
      userId: getIdString(doc.sender.userId) || undefined,
      type: doc.sender.type,
      name: doc.sender.name,
      email: doc.sender.email,
      phone: doc.sender.phone,
      company: doc.sender.company,
      image: doc.sender.image,
      status: doc.sender.status,
      profileId: getIdString(doc.sender.profileId) || undefined,
    },
    messages: messages.map((message) => ({
      _id: getIdString(message._id) || undefined,
      senderType: message.senderType,
      senderUserId: getIdString(message.senderUserId) || undefined,
      senderName: message.senderName,
      senderEmail: message.senderEmail,
      senderImage: message.senderImage,
      body: message.body,
      createdAt: new Date(message.createdAt).toISOString(),
    })),
    status: doc.status,
    lastMessagePreview: doc.lastMessagePreview,
    lastMessageAt: new Date(doc.lastMessageAt).toISOString(),
    lastAdminReplyAt: doc.lastAdminReplyAt
      ? new Date(doc.lastAdminReplyAt).toISOString()
      : undefined,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function listSupportConversations() {
  await connectDB();
  const conversations = await SupportConversation.find({
    $or: [
      {
        "sender.type": {
          $in: [SUPPORT_SENDER_TYPES.CUSTOMER, SUPPORT_SENDER_TYPES.GUEST],
        },
      },
      { "sender.status": SUPPORT_SENDER_TYPES.GUEST },
    ],
  })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean();

  return conversations.map((conversation) => serializeConversation(conversation));
}

export async function listCustomerSupportConversations(userId: string) {
  await connectDB();
  const conversations = await SupportConversation.find({
    "sender.userId": toObjectId(userId),
    "sender.type": SUPPORT_SENDER_TYPES.CUSTOMER,
  })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .lean();

  return conversations.map((conversation) => serializeConversation(conversation));
}

export async function createSupportConversationFromContact(params: {
  data: SubmittedContactMessage;
  sessionUserId?: string;
}) {
  await connectDB();

  const sender = await resolveSupportSenderSnapshot({
    sessionUserId: params.sessionUserId,
    name: params.data.name,
    email: params.data.email,
    phone: params.data.phone,
    company: params.data.company,
  });
  const messageBody = params.data.message.trim();
  const now = new Date();

  const conversation = await SupportConversation.create({
    subject: params.data.subject.trim(),
    sender,
    messages: [
      {
        senderType: sender.type,
        senderUserId: sender.userId,
        senderName: sender.name,
        senderEmail: sender.email,
        senderImage: sender.image,
        body: messageBody,
        createdAt: now,
      },
    ],
    status: SUPPORT_CONVERSATION_STATUS.OPEN,
    lastMessagePreview: truncateText(messageBody, 240),
    lastMessageAt: now,
  });

  await notifyAdminsAboutSupportMessage(conversation).catch((error) => {
    console.error("Failed to notify admins about support message:", error);
  });

  return conversation;
}

export async function appendAdminSupportReply(params: {
  conversationId: string;
  admin: {
    userId: string;
    name: string;
    email?: string;
    image?: string;
  };
  message: string;
}) {
  await connectDB();

  const conversation = await SupportConversation.findById(params.conversationId);
  if (!conversation) return null;

  const body = params.message.trim();
  const now = new Date();
  conversation.messages.push({
    senderType: SUPPORT_SENDER_TYPES.ADMIN,
    senderUserId: toObjectId(params.admin.userId),
    senderName: params.admin.name,
    senderEmail: params.admin.email,
    senderImage: params.admin.image,
    body,
    createdAt: now,
  });
  conversation.status = SUPPORT_CONVERSATION_STATUS.REPLIED;
  conversation.lastMessagePreview = truncateText(body, 240);
  conversation.lastMessageAt = now;
  conversation.lastAdminReplyAt = now;

  await conversation.save();
  await notifySupportRequesterAboutReply(conversation, body).catch((error) => {
    console.error("Failed to notify support requester:", error);
  });
  await sendSupportReplyEmail(conversation, body, params.admin.email).catch(
    (error) => {
      console.error("Failed to email support requester:", error);
    },
  );

  return serializeConversation(conversation);
}

export async function appendCustomerSupportReply(params: {
  conversationId: string;
  customer: {
    userId: string;
    name: string;
    email?: string;
    image?: string;
  };
  message: string;
}) {
  await connectDB();

  const conversation = await SupportConversation.findOne({
    _id: params.conversationId,
    "sender.userId": toObjectId(params.customer.userId),
    "sender.type": SUPPORT_SENDER_TYPES.CUSTOMER,
  });
  if (!conversation) return null;

  const body = params.message.trim();
  const now = new Date();
  conversation.messages.push({
    senderType: SUPPORT_SENDER_TYPES.CUSTOMER,
    senderUserId: toObjectId(params.customer.userId),
    senderName: params.customer.name,
    senderEmail: params.customer.email,
    senderImage: params.customer.image,
    body,
    createdAt: now,
  });
  conversation.status = SUPPORT_CONVERSATION_STATUS.OPEN;
  conversation.lastMessagePreview = truncateText(body, 240);
  conversation.lastMessageAt = now;

  await conversation.save();
  await notifyAdminsAboutSupportMessage(conversation, {
    titlePrefix: "Customer replied",
  }).catch((error) => {
    console.error("Failed to notify admins about customer reply:", error);
  });

  return serializeConversation(conversation);
}

async function notifyAdminsAboutSupportMessage(
  conversation: ISupportConversation,
  options: { titlePrefix?: string } = {},
) {
  const admins = await User.find({
    $or: [{ role: USER_ROLES.ADMIN }, { roles: USER_ROLES.ADMIN }],
    status: { $ne: USER_ACCOUNT_STATUS.BANNED },
  })
    .select("_id")
    .lean<Array<{ _id: unknown }>>();

  const conversationId = getIdString(conversation._id);
  const senderLabel = conversation.sender.name || conversation.sender.email;
  const senderType =
    conversation.sender.type === SUPPORT_SENDER_TYPES.GUEST
      ? SUPPORT_SENDER_TYPES.GUEST
      : SUPPORT_SENDER_TYPES.CUSTOMER;
  const title = truncateText(
    `${options.titlePrefix || `New ${senderType} message`} from ${senderLabel}`,
    100,
  );
  const message = truncateText(
    `${conversation.subject}: ${conversation.lastMessagePreview}`,
    500,
  );

  await Promise.allSettled(
    admins.map((admin) => {
      const adminUserId = getIdString(admin._id);
      if (!adminUserId) return Promise.resolve();

      return createNotification({
        userId: adminUserId,
        type: NotificationType.SUPPORT_MESSAGE,
        title,
        message,
        link: getSupportInboxLink(conversationId),
        data: {
          conversationId,
          senderUserId: getIdString(conversation.sender.userId) || undefined,
          senderName: conversation.sender.name,
          senderEmail: conversation.sender.email,
          senderType,
          senderStatus: conversation.sender.status,
          recipientRole: USER_ROLES.ADMIN,
        },
      });
    }),
  );
}

function getCustomerInboxLink(conversationId?: string) {
  return conversationId
    ? `${CUSTOMER_INBOX_LINK}?conversation=${conversationId}`
    : CUSTOMER_INBOX_LINK;
}

async function notifySupportRequesterAboutReply(
  conversation: ISupportConversation,
  body: string,
) {
  const requesterUserId = getIdString(conversation.sender.userId);
  if (!requesterUserId) return;

  const conversationId = getIdString(conversation._id);
  await createNotification({
    userId: requesterUserId,
    type: NotificationType.SUPPORT_MESSAGE,
    title: "Support replied to your message",
    message: truncateText(`${conversation.subject}: ${body}`, 500),
    link: getCustomerInboxLink(conversationId),
    data: {
      conversationId,
      senderType: SUPPORT_SENDER_TYPES.ADMIN,
      recipientRole: USER_ROLES.CUSTOMER,
    },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendSupportReplyEmail(
  conversation: ISupportConversation,
  body: string,
  replyTo?: string,
) {
  const settings = await getSettings();
  if (!settings.email?.enabled || !conversation.sender.email) return false;

  const storeName = settings.general?.storeName || DEFAULT_STORE_NAME;
  const safeName = escapeHtml(conversation.sender.name || "there");
  const safeSubject = escapeHtml(conversation.subject);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br />");

  return sendEmail({
    to: conversation.sender.email,
    replyTo,
    subject: `Re: ${conversation.subject}`,
    settings,
    html: `
      <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#111827;">
        <div style="max-width:640px;margin:0 auto;padding:28px;">
          <div style="border-radius:10px;background:#ffffff;overflow:hidden;border:1px solid #e5e7eb;">
            <div style="background:${DEFAULT_PRIMARY_COLOR};padding:20px 24px;color:#ffffff;">
              <p style="margin:0 0 6px;font-size:13px;opacity:.9;">${escapeHtml(storeName)} support replied</p>
              <h1 style="margin:0;font-size:21px;line-height:1.35;">${safeSubject}</h1>
            </div>
            <div style="padding:24px;">
              <p style="margin:0 0 14px;font-size:14px;color:#4b5563;">Hi ${safeName},</p>
              <p style="margin:0;font-size:15px;line-height:1.7;">${safeBody}</p>
              <div style="border-top:1px solid #e5e7eb;margin-top:22px;padding-top:16px;color:#6b7280;font-size:13px;line-height:1.6;">
                You can also view and reply from your account inbox.
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    text: [
      `${storeName} support replied`,
      `Subject: ${conversation.subject}`,
      "",
      body,
      "",
      "You can also view and reply from your account inbox.",
    ].join("\n"),
  });
}
