"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppImage } from "@/components/ui/app-image";
import { useState, useEffect, useCallback } from "react";
import { Search, X, GripVertical, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/providers/currency-provider";
import type { ProductPickerItem as Product } from "@/types/product-list";


interface CollectionProductSelectorProps {
  selectedProducts: string[];
  onChange: (productIds: string[]) => void;
  title?: string;
}

export function CollectionProductSelector({
  selectedProducts,
  onChange,
  title = "Products in Collection",
}: CollectionProductSelectorProps) {
  const { formatPrice } = useCurrency();
  const [searchValue, setSearchValue] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch product details for selected products
  useEffect(() => {
    if (selectedProducts.length === 0) {
      setSelectedProductDetails([]);
      return;
    }

    async function fetchSelectedProducts() {
      setIsLoading(true);
      try {
        // Fetch details for all selected products
        const details: Product[] = [];
        for (const productId of selectedProducts) {
          const res = await fetch(`/api/admin/products/${productId}`);
          const data = await res.json();
          if (data.success && data.data) {
            details.push(data.data);
          }
        }
        setSelectedProductDetails(details);
      } catch (error) {
        console.error("Failed to fetch selected products:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSelectedProducts();
  }, [selectedProducts]);

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setProducts([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("search", query);
      params.set("limit", "20");
      params.set("status", "active");

      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const list =
          Array.isArray(data?.data?.data) ? data.data.data :
          Array.isArray(data?.data) ? data.data :
          Array.isArray(data) ? data :
          [];
        setProducts(list);
      }
    } catch (error) {
      console.error("Failed to search products:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, searchProducts]);

  const toggleProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      onChange(selectedProducts.filter((id) => id !== productId));
    } else {
      onChange([...selectedProducts, productId]);
    }
  };

  const removeProduct = (productId: string) => {
    onChange(selectedProducts.filter((id) => id !== productId));
  };

  const moveProduct = (fromIndex: number, toIndex: number) => {
    const newOrder = [...selectedProducts];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    onChange(newOrder);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Products */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products to add..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Search Results */}
        {searchValue && (
          <div className="border rounded-md">
            <div className="h-[200px] overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Searching...
                </div>
              ) : products.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No products found
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {products.map((product) => {
                    const isSelected = selectedProducts.includes(product._id);
                    return (
                      <div
                        key={product._id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                        onClick={() => toggleProduct(product._id)}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                          {product.images?.[0] ? (
                            <AppImage
                              src={product.images[0]}
                              alt={product.title || product.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {product.title || product.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatPrice(product.price)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Products */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Selected Products ({selectedProducts.length})
            </span>
            {selectedProducts.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
              >
                Clear all
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
              Loading products...
            </div>
          ) : selectedProducts.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
              No products selected. Search and add products above.
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {selectedProducts.map((productId, index) => {
                const product = selectedProductDetails.find(
                  (p) => p._id === productId
                );

                return (
                  <div
                    key={productId}
                    className="flex items-center gap-3 p-2 group"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                    <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {product?.images?.[0] ? (
                        <AppImage
                          src={product.images[0]}
                          alt={product.title || product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {product ? (
                        <>
                          <div className="font-medium truncate">
                            {product.title || product.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatPrice(product.price)}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Loading...
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveProduct(index, index - 1)}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          Up
                        </Button>
                      )}
                      {index < selectedProducts.length - 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveProduct(index, index + 1)}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          Down
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeProduct(productId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
