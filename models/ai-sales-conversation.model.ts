import { mongoose } from "@/lib/db";

const { Schema, models, model } = mongoose;

const AISalesMessageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system", "tool"],
      required: true,
    },
    content: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const AISalesActionSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "tool_call",
        "product_recommendation",
        "cart_add",
        "checkout_handoff",
        "order_status_lookup",
        "error",
      ],
      required: true,
    },
    name: String,
    payload: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const AISalesConversationSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    locale: { type: String, default: "en", index: true },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      index: true,
    },
    messages: { type: [AISalesMessageSchema], default: [] },
    actions: { type: [AISalesActionSchema], default: [] },
    recommendedProductIds: {
      type: [Schema.Types.ObjectId],
      ref: "Product",
      default: [],
    },
    cartItemCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

AISalesConversationSchema.index({ updatedAt: -1 });
AISalesConversationSchema.index({ sessionId: 1, updatedAt: -1 });

export const AISalesConversation =
  models.AISalesConversation ||
  model("AISalesConversation", AISalesConversationSchema);
