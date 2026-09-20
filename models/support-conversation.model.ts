import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const SUPPORT_SENDER_TYPES = {
  ADMIN: "admin",
  CUSTOMER: "customer",
  VENDOR: "vendor",
  STAFF: "staff",
  GUEST: "guest",
} as const;

export const SUPPORT_CONVERSATION_STATUS = {
  OPEN: "open",
  REPLIED: "replied",
  CLOSED: "closed",
} as const;

export type SupportSenderType =
  (typeof SUPPORT_SENDER_TYPES)[keyof typeof SUPPORT_SENDER_TYPES];

export type SupportConversationStatus =
  (typeof SUPPORT_CONVERSATION_STATUS)[keyof typeof SUPPORT_CONVERSATION_STATUS];

export interface ISupportSenderSnapshot {
  userId?: Types.ObjectId;
  type: SupportSenderType;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  image?: string;
  status?: string;
  profileId?: Types.ObjectId;
}

export interface ISupportMessageEntry {
  senderType: SupportSenderType;
  senderUserId?: Types.ObjectId;
  senderName: string;
  senderEmail?: string;
  senderImage?: string;
  body: string;
  createdAt: Date;
}

export interface ISupportConversation extends Document {
  subject: string;
  sender: ISupportSenderSnapshot;
  messages: ISupportMessageEntry[];
  status: SupportConversationStatus;
  lastMessagePreview: string;
  lastMessageAt: Date;
  lastAdminReplyAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SupportSenderSchema = new Schema<ISupportSenderSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: Object.values(SUPPORT_SENDER_TYPES),
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    image: { type: String },
    status: { type: String },
    profileId: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const SupportMessageEntrySchema = new Schema<ISupportMessageEntry>(
  {
    senderType: {
      type: String,
      enum: Object.values(SUPPORT_SENDER_TYPES),
      required: true,
    },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User" },
    senderName: { type: String, required: true, trim: true, maxlength: 100 },
    senderEmail: { type: String, trim: true, lowercase: true },
    senderImage: { type: String },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const SupportConversationSchema = new Schema<ISupportConversation>(
  {
    subject: { type: String, required: true, trim: true, maxlength: 140 },
    sender: { type: SupportSenderSchema, required: true },
    messages: {
      type: [SupportMessageEntrySchema],
      default: [],
      validate: {
        validator: (messages: ISupportMessageEntry[]) => messages.length > 0,
        message: "A support conversation requires at least one message",
      },
    },
    status: {
      type: String,
      enum: Object.values(SUPPORT_CONVERSATION_STATUS),
      default: SUPPORT_CONVERSATION_STATUS.OPEN,
    },
    lastMessagePreview: { type: String, required: true, trim: true, maxlength: 240 },
    lastMessageAt: { type: Date, default: Date.now },
    lastAdminReplyAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

SupportConversationSchema.index({ lastMessageAt: -1 });
SupportConversationSchema.index({ "sender.userId": 1, lastMessageAt: -1 });
SupportConversationSchema.index({ "sender.email": 1, lastMessageAt: -1 });
SupportConversationSchema.index({ status: 1, lastMessageAt: -1 });

export const SupportConversation: Model<ISupportConversation> =
  mongoose.models.SupportConversation ||
  mongoose.model<ISupportConversation>(
    "SupportConversation",
    SupportConversationSchema,
  );
