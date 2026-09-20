export type POSLocationInventory = { locationId?: string; quantity?: number };

export type POSProductWithInventory = {
  stock?: number;
  locationInventory?: POSLocationInventory[];
  variants?: POSVariantWithInventory[];
};

export type POSVariantWithInventory = {
  stock?: number;
  locationInventory?: POSLocationInventory[];
};

export type POSStockStatusFilter = "all" | "in_stock" | "out_of_stock";

export function getPOSLocationStock(
  inventory: POSLocationInventory[] | undefined,
  locationId: string,
): number {
  if (!Array.isArray(inventory)) return 0;
  return inventory.find((item) => item.locationId === locationId)?.quantity ?? 0;
}

export function applyPOSLocationStock<TProduct extends POSProductWithInventory>(
  product: TProduct,
  locationId: string,
): TProduct {
  if (!locationId) return product;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const variants = product.variants.map((variant) => ({
      ...variant,
      stock: getPOSLocationStock(variant.locationInventory, locationId),
    }));
    const stock = variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
    return { ...product, variants, stock };
  }

  return {
    ...product,
    stock: getPOSLocationStock(product.locationInventory, locationId),
  };
}

export function getPOSAvailableStock(product: POSProductWithInventory): number {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
  }
  return product.stock || 0;
}

export function matchesPOSStockStatus(
  product: POSProductWithInventory,
  stockStatus: POSStockStatusFilter,
): boolean {
  if (stockStatus === "all") return true;
  const stock = getPOSAvailableStock(product);
  return stockStatus === "in_stock" ? stock > 0 : stock <= 0;
}
