/**
 * Login Attempts Model
 * Track login attempts for rate limiting and account lockout
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILoginAttempt extends Document {
  identifier: string; // email or IP address
  attempts: number;
  lastAttempt: Date;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>(
  {
    identifier: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttempt: {
      type: Date,
      default: Date.now,
    },
    lockedUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// TTL index to auto-delete old records after 24 hours
LoginAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

// Methods
LoginAttemptSchema.methods.isLocked = function (): boolean {
  if (!this.lockedUntil) return false;
  return new Date() < this.lockedUntil;
};

LoginAttemptSchema.methods.incrementAttempts = async function (
  maxAttempts: number,
  lockoutMinutes: number,
): Promise<void> {
  this.attempts += 1;
  this.lastAttempt = new Date();

  if (this.attempts >= maxAttempts) {
    this.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
  }

  await this.save();
};

LoginAttemptSchema.methods.resetAttempts = async function (): Promise<void> {
  this.attempts = 0;
  this.lockedUntil = undefined;
  await this.save();
};

// Static methods
LoginAttemptSchema.statics.findOrCreate = async function (
  identifier: string,
): Promise<ILoginAttempt> {
  let attempt = await this.findOne({ identifier });
  if (!attempt) {
    attempt = await this.create({ identifier });
  }
  return attempt;
};

export const LoginAttempt: Model<ILoginAttempt> =
  mongoose.models.LoginAttempt ||
  mongoose.model<ILoginAttempt>("LoginAttempt", LoginAttemptSchema);
