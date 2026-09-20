"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem } from "@/types";
import { apiClient, ApiClientError } from "@/lib/api/client";

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "_id">) => Promise<void>;
  updateItem: (
    productId: string,
    quantity: number,
    variantId?: string
  ) => Promise<void>;
  removeItem: (productId: string, variantId?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: (silent?: boolean) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate totals
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Fetch cart from API
  const refreshCart = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      const data = await apiClient.get<{ items?: CartItem[] }>("/api/cart");
      setItems(data?.items || []);
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addItem = useCallback(
    async (item: Omit<CartItem, "_id">) => {
      try {
        const data = await apiClient.post<{ items?: CartItem[] }>(
          "/api/cart/items",
          {
            productId: item.productId.toString(),
            variantId: item.variantId?.toString(),
            quantity: item.quantity,
          },
        );
        const nextItems = data?.items;
        if (Array.isArray(nextItems)) {
          setItems(nextItems);
        } else {
          await refreshCart();
        }
        return;
      } catch (error) {
        console.error("Failed to add item:", error);
        throw error;
      }
    },
    [refreshCart]
  );

  const updateItem = useCallback(
    async (productId: string, quantity: number, variantId?: string) => {
      const safeQuantity = Math.max(0, quantity);
      const previousItems = items;

      setItems((currentItems) =>
        currentItems
          .map((item) => {
            const isTargetItem =
              item.productId.toString() === productId &&
              (variantId
                ? item.variantId?.toString() === variantId
                : !item.variantId);

            if (!isTargetItem) {
              return item;
            }

            return {
              ...item,
              quantity: safeQuantity,
            };
          })
          .filter((item) => item.quantity > 0)
      );

      try {
        const itemId = variantId ? `${productId}-${variantId}` : productId;
        await apiClient.put(`/api/cart/items/${itemId}`, {
          quantity: safeQuantity,
        });

        await refreshCart(true);
      } catch (error) {
        setItems(previousItems);
        console.error("Failed to update item:", error);
        throw error;
      }
    },
    [items, refreshCart]
  );

  const removeItem = useCallback(
    async (productId: string, variantId?: string) => {
      try {
        const itemId = variantId ? `${productId}-${variantId}` : productId;
        await apiClient.delete(`/api/cart/items/${itemId}`);
        await refreshCart();
      } catch (error) {
        console.error("Failed to remove item:", error);
        // HTTP failures were previously ignored here; keep that contract.
        if (!(error instanceof ApiClientError)) throw error;
      }
    },
    [refreshCart]
  );

  const clearCart = useCallback(async () => {
    try {
      await apiClient.delete("/api/cart");
      setItems([]);
    } catch (error) {
      console.error("Failed to clear cart:", error);
      // HTTP failures were previously ignored here; keep that contract.
      if (!(error instanceof ApiClientError)) throw error;
    }
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        totalItems,
        subtotal,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
