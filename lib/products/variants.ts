export type ProductOptionInput = {
  name: string;
  values: string[];
};

export type VariantDraft = {
  key: string;
  name: string;
  optionValues: string[];
  sku: string;
  barcode?: string;
  price: number;
  comparePrice?: number;
  cost?: number;
  stock: number;
  taxable?: boolean;
  requiresShipping?: boolean;
  weight?: number;
  weightUnit?: "g" | "kg" | "lb" | "oz";
  mediaId?: string;
};

export function normalizeOptions(options: ProductOptionInput[]) {
  const cleaned = options
    .map((o) => ({
      name: String(o.name || "").trim(),
      values: Array.isArray(o.values)
        ? o.values
            .map((v) => String(v || "").trim())
            .filter(Boolean)
        : [],
    }))
    .filter((o) => o.name.length > 0);

  return cleaned.map((o) => ({
    ...o,
    values: Array.from(new Set(o.values)),
  }));
}

export function variantKey(optionValues: string[]) {
  return optionValues.map((v) => v.trim()).join("||");
}

export function computeVariantName(optionValues: string[]) {
  const parts = optionValues.map((v) => v.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Default Title";
}

export function generateVariantCombinations(
  optionsInput: ProductOptionInput[]
) {
  const options = normalizeOptions(optionsInput);
  if (options.length === 0 || options.every((o) => o.values.length === 0)) {
    return [{ optionValues: [], key: variantKey([]), name: "Default Title" }];
  }

  const nonEmpty = options.filter((o) => o.values.length > 0);
  const allValues = nonEmpty.map((o) => o.values);

  const cartesian = allValues.reduce<string[][]>(
    (acc, values) => {
      const next: string[][] = [];
      for (const prev of acc) {
        for (const v of values) {
          next.push([...prev, v]);
        }
      }
      return next;
    },
    [[]]
  );

  return cartesian.map((optionValues) => ({
    optionValues,
    key: variantKey(optionValues),
    name: computeVariantName(optionValues),
  }));
}

export function mergeVariantDrafts(params: {
  existing: VariantDraft[];
  nextBase: Omit<VariantDraft, "key" | "name" | "optionValues">;
  combinations: { key: string; name: string; optionValues: string[] }[];
}) {
  const existingMap = new Map(params.existing.map((v) => [v.key, v]));
  const next: VariantDraft[] = [];

  for (const c of params.combinations) {
    const prev = existingMap.get(c.key);
    if (prev) {
      next.push({ ...params.nextBase, ...prev, key: c.key, name: c.name, optionValues: c.optionValues });
    } else {
      next.push({ ...params.nextBase, key: c.key, name: c.name, optionValues: c.optionValues });
    }
  }

  return next;
}

