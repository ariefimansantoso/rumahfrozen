/**
 * Wishlist Model
 * Stores user's saved products
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWishlistItem {
  productId: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface IWishlist extends Document {
  userId: string;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const WishlistItemSchema = new Schema<IWishlistItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const WishlistSchema = new Schema<IWishlist>(
  {
    userId: {
      type: String,
      required: true,
    },
    items: {
      type: [WishlistItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster queries
WishlistSchema.index({ userId: 1, "items.productId": 1 });

export const Wishlist: Model<IWishlist> =
  mongoose.models.Wishlist ||
  mongoose.model<IWishlist>("Wishlist", WishlistSchema);
