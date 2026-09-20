/**
 * Wishlist Store
 * Zustand store for managing wishlist state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistItem {
  productId: string;
  product: {
    _id: string;
    name: string;
    slug: string;
    price: number;
    images?: string[];
    stock: number;
    status: string;
  };
  addedAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  isSynced: boolean;

  // Actions
  fetchWishlist: () => Promise<void>;
  addToWishlist: (productId: string) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<boolean>;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isSynced: false,

      fetchWishlist: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch("/api/wishlist");
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              set({ items: data.data.items, isSynced: true });
            }
          }
        } catch (error) {
          console.error("Failed to fetch wishlist:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      addToWishlist: async (productId: string) => {
        try {
          const res = await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          });

          if (res.ok) {
            // Refetch to get populated product data
            await get().fetchWishlist();
            return true;
          }
          return false;
        } catch (error) {
          console.error("Failed to add to wishlist:", error);
          return false;
        }
      },

      removeFromWishlist: async (productId: string) => {
        try {
          const res = await fetch(`/api/wishlist?productId=${productId}`, {
            method: "DELETE",
          });

          if (res.ok) {
            set((state) => ({
              items: state.items.filter((item) => item.productId !== productId),
            }));
            return true;
          }
          return false;
        } catch (error) {
          console.error("Failed to remove from wishlist:", error);
          return false;
        }
      },

      isInWishlist: (productId: string) => {
        return get().items.some((item) => item.productId === productId);
      },

      clearWishlist: () => {
        set({ items: [], isSynced: false });
      },
    }),
    {
      name: "wishlist-storage",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
