export type ProductWeightUnit = "g" | "kg" | "lb" | "oz";

export type ProductShippingData = {
  isPhysicalProduct?: boolean;
  weight?: number;
  weightUnit?: ProductWeightUnit;
  countryOfOrigin?: string;
  hsCode?: string;
  customsDescription?: string;
};

export type VariantShippingData = {
  requiresShipping?: boolean;
  weight?: number;
  weightUnit?: ProductWeightUnit;
};

export type OrderItemCustomsSnapshot = {
  countryOfOrigin?: string;
  hsCode?: string;
  description?: string;
  weight?: number;
  weightUnit?: ProductWeightUnit;
};

const GRAMS_PER_UNIT: Record<ProductWeightUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
};

function finiteNonNegative(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function convertWeight(
  weight: number,
  fromUnit: ProductWeightUnit,
  toUnit: ProductWeightUnit,
): number {
  const normalizedWeight = finiteNonNegative(weight);
  if (fromUnit === toUnit) return normalizedWeight;
  return (normalizedWeight * GRAMS_PER_UNIT[fromUnit]) / GRAMS_PER_UNIT[toUnit];
}

export function normalizeCountryOfOrigin(value: unknown): string | undefined {
  const country = String(value || "").trim();
  if (!country) return undefined;
  return country.length === 2 ? country.toUpperCase() : country;
}

export function normalizeHsCode(value: unknown): string | undefined {
  const hsCode = String(value || "").replace(/\D/g, "");
  return hsCode || undefined;
}

export function normalizeCustomsDescription(
  value: unknown,
): string | undefined {
  const description = String(value || "").replace(/\s+/g, " ").trim();
  return description || undefined;
}

export function normalizeProductShippingData(
  shipping: ProductShippingData | undefined,
): ProductShippingData {
  const isPhysicalProduct = shipping?.isPhysicalProduct !== false;
  return {
    isPhysicalProduct,
    weight: finiteNonNegative(shipping?.weight),
    weightUnit: shipping?.weightUnit || "kg",
    countryOfOrigin: normalizeCountryOfOrigin(shipping?.countryOfOrigin),
    hsCode: normalizeHsCode(shipping?.hsCode),
    customsDescription: normalizeCustomsDescription(
      shipping?.customsDescription,
    ),
  };
}

export function resolveItemShipping(params: {
  productShipping?: ProductShippingData;
  variantShipping?: VariantShippingData;
  quantity?: number;
  targetWeightUnit?: ProductWeightUnit;
}) {
  const product = normalizeProductShippingData(params.productShipping);
  const requiresShipping =
    params.variantShipping?.requiresShipping ?? product.isPhysicalProduct ?? true;
  const sourceWeight =
    params.variantShipping?.weight ?? product.weight ?? 0;
  const sourceWeightUnit =
    params.variantShipping?.weightUnit ?? product.weightUnit ?? "kg";
  const weightUnit = params.targetWeightUnit || "kg";
  const quantity = finiteNonNegative(params.quantity ?? 1);
  const unitWeight = requiresShipping
    ? convertWeight(sourceWeight, sourceWeightUnit, weightUnit)
    : 0;

  return {
    requiresShipping,
    unitWeight,
    totalWeight: unitWeight * quantity,
    weightUnit,
  };
}

export function buildOrderItemCustomsSnapshot(params: {
  productShipping?: ProductShippingData;
  variantShipping?: VariantShippingData;
}): OrderItemCustomsSnapshot | undefined {
  const normalized = normalizeProductShippingData(params.productShipping);
  const resolved = resolveItemShipping({
    productShipping: normalized,
    variantShipping: params.variantShipping,
    targetWeightUnit:
      params.variantShipping?.weightUnit || normalized.weightUnit || "kg",
  });
  if (!resolved.requiresShipping) return undefined;

  const snapshot: OrderItemCustomsSnapshot = {
    countryOfOrigin: normalized.countryOfOrigin,
    hsCode: normalized.hsCode,
    description: normalized.customsDescription,
    weight: resolved.unitWeight,
    weightUnit: resolved.weightUnit,
  };

  return Object.values(snapshot).some((value) => value !== undefined)
    ? snapshot
    : undefined;
}
