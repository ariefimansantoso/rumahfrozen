/**
 * Audit Log Model
 * Tracks critical administrative actions for security, compliance, and debugging
 */

import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Types of actions that can be audited
 */
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "PASSWORD_CHANGE"
  | "PASSWORD_RESET"
  | "SETTINGS_CHANGE"
  | "STATUS_CHANGE"
  | "ROLE_CHANGE"
  | "PERMISSION_CHANGE"
  | "APPROVAL"
  | "REJECTION"
  | "SUSPENSION"
  | "REFUND"
  | "EXPORT"
  | "BULK_ACTION";

/**
 * Types of resources that can be audited
 */
export type AuditResource =
  | "user"
  | "vendor"
  | "product"
  | "order"
  | "coupon"
  | "category"
  | "settings"
  | "session"
  | "payment"
  | "refund"
  | "inventory"
  | "location"
  | "collection"
  | "review";

/**
 * Audit log document interface
 */
export interface IAuditLog extends Document {
  /** The type of action performed */
  action: AuditAction;

  /** The type of resource affected */
  resource: AuditResource;

  /** The ID of the affected resource (if applicable) */
  resourceId?: string;

  /** Human-readable description of the resource */
  resourceName?: string;

  /** The user who performed the action */
  userId?: Types.ObjectId;

  /** Email of the user who performed the action */
  userEmail?: string;

  /** Role of the user at the time of action */
  userRole?: string;

  /** Details of what changed */
  changes?: {
    /** State before the change */
    before?: Record<string, unknown>;
    /** State after the change */
    after?: Record<string, unknown>;
    /** List of fields that changed */
    fields?: string[];
    /** Summary description of the change */
    summary?: string;
  };

  /** Additional metadata about the request */
  metadata?: {
    /** Client IP address */
    ip?: string;
    /** User agent string */
    userAgent?: string;
    /** Unique request identifier */
    requestId?: string;
    /** HTTP method used */
    method?: string;
    /** Request path */
    path?: string;
    /** Additional context */
    [key: string]: unknown;
  };

  /** Whether the action was successful */
  success: boolean;

  /** Error message if action failed */
  errorMessage?: string;

  /** Timestamp of the action */
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "LOGIN_FAILED",
        "PASSWORD_CHANGE",
        "PASSWORD_RESET",
        "SETTINGS_CHANGE",
        "STATUS_CHANGE",
        "ROLE_CHANGE",
        "PERMISSION_CHANGE",
        "APPROVAL",
        "REJECTION",
        "SUSPENSION",
        "REFUND",
        "EXPORT",
        "BULK_ACTION",
      ],
    },
    resource: {
      type: String,
      required: true,
      enum: [
        "user",
        "vendor",
        "product",
        "order",
        "coupon",
        "category",
        "settings",
        "session",
        "payment",
        "refund",
        "inventory",
        "location",
        "collection",
      ],
    },
    resourceId: {
      type: String,
    },
    resourceName: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    userEmail: {
      type: String,
    },
    userRole: {
      type: String,
    },
    changes: {
      before: {
        type: Schema.Types.Mixed,
      },
      after: {
        type: Schema.Types.Mixed,
      },
      fields: [String],
      summary: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    success: {
      type: Boolean,
      default: true,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "audit_logs",
  }
);

// Compound indexes for common query patterns
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, action: 1, createdAt: -1 });
AuditLogSchema.index({ success: 1, createdAt: -1 });

// TTL index - auto-delete logs after 90 days (configurable via MongoDB)
// To change retention, drop and recreate the index with different expireAfterSeconds
AuditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days
);

// Virtual for formatted timestamp
AuditLogSchema.virtual("formattedDate").get(function () {
  return this.createdAt?.toISOString();
});

// Ensure virtuals are included in JSON output
AuditLogSchema.set("toJSON", { virtuals: true });
AuditLogSchema.set("toObject", { virtuals: true });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
