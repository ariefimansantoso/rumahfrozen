import { Vendor } from "@/models";
import {
  calculateShipping,
  calculateShippingByVendor,
  estimateCustomsDuty,
  type ShippingSettings,
  type ShippingRateOption,
  type ShippingCalculationResult,
  type CustomsEstimate,
} from "@/lib/shipping";

/**
 * Shared shipping resolution used by every checkout path (online checkout,
 * Stripe PaymentIntent, Stripe Checkout Session finalize, and the
 * shipping-rates endpoint). Centralising it here is what keeps those paths in
 * parity — there is exactly one place that decides cost, selected method,
 * per-vendor allocation, and duties.
 */

export type ResolvedShippingMethod = {
  name?: string;
  optionId?: string;
  minDays?: number;
  maxDays?: number;
};

export type VendorRateGroup = {
  vendorId: string;
  vendorName?: string;
  options: ShippingRateOption[];
  selectedOptionId?: string;
  cost: number;
  method: ResolvedShippingMethod;
};

export type ResolvedCheckoutShipping = {
  available: boolean;
  mode: "single" | "vendor";
  shippingCost: number;
  selectedShippingMethod?: ResolvedShippingMethod;
  // vendorId -> selected cost + method, used to allocate shipping per sub-order
  vendorShippingCosts: Map<string, { cost: number; method: ResolvedShippingMethod }>;
  // selectable options for the single-shipment case (UI)
  singleOptions: ShippingRateOption[];
  // selectable options grouped per vendor (UI)
  vendorGroups: VendorRateGroup[];
  customs: CustomsEstimate;
};

export type VendorAggregate = Map<
  string,
  {
    subtotal: number;
    shippableSubtotal?: number;
    weight: number;
    shippableItemCount?: number;
  }
>;

function methodFromResult(
  result: ShippingCalculationResult,
): ResolvedShippingMethod {
  return {
    name: result.options.find((o) => o.id === result.selectedOptionId)?.name,
    optionId: result.selectedOptionId,
    minDays: result.deliveryDays?.min,
    maxDays: result.deliveryDays?.max,
  };
}

export async function resolveCheckoutShipping(params: {
  subtotal: number;
  totalWeight: number;
  vendorAgg: VendorAggregate;
  destination: { country?: string; state?: string };
  platformShipping?: ShippingSettings;
  orders?: { freeShippingThreshold?: number; defaultShippingCost?: number };
  isMultiVendorEnabled: boolean;
  selectedShippingOptionId?: string;
  vendorShippingSelections?: Record<string, string>;
}): Promise<ResolvedCheckoutShipping> {
  const {
    totalWeight,
    vendorAgg,
    destination,
    platformShipping,
    orders,
  } = params;

  const shippableSubtotal = Array.from(vendorAgg.values()).reduce(
    (sum, aggregate) =>
      sum +
      (aggregate.shippableItemCount === 0
        ? 0
        : (aggregate.shippableSubtotal ?? aggregate.subtotal)),
    0,
  );
  const customs = estimateCustomsDuty({
    subtotal: shippableSubtotal,
    destination,
    originCountry: platformShipping?.origin?.country,
    customs: platformShipping?.customs,
  });

  // Per-vendor shipping applies only when the admin enabled it, multi-vendor is
  // on, and the cart actually spans more than one vendor.
  const shippableVendorIds = Array.from(vendorAgg.entries())
    .filter(([, aggregate]) => aggregate.shippableItemCount !== 0)
    .map(([vendorId]) => vendorId);
  const hasShippableItems = shippableVendorIds.length > 0;

  if (!hasShippableItems) {
    return {
      available: true,
      mode: "single",
      shippingCost: 0,
      vendorShippingCosts: new Map(),
      singleOptions: [],
      vendorGroups: [],
      customs: { ...customs, dutyAmount: 0, collectedAtCheckout: false },
    };
  }

  const vendorShippingEnabled =
    params.isMultiVendorEnabled &&
    Boolean(platformShipping?.vendorShipping?.enabled) &&
    vendorAgg.size > 1;

  if (vendorShippingEnabled) {
    const vendorIds = shippableVendorIds;
    const vendorDocs = await Vendor.find({ _id: { $in: vendorIds } })
      .select("shipping storeName")
      .lean<
        Array<{
          _id: { toString: () => string };
          storeName?: string;
          shipping?: ShippingSettings;
        }>
      >();
    const vendorProfiles = new Map<string, ShippingSettings | undefined>(
      vendorDocs.map((v) => [v._id.toString(), v.shipping]),
    );
    const vendorNames = new Map<string, string | undefined>(
      vendorDocs.map((v) => [v._id.toString(), v.storeName]),
    );

    const multi = calculateShippingByVendor({
      groups: vendorIds.map((vendorId) => {
        const agg = vendorAgg.get(vendorId)!;
        return {
          vendorId,
          subtotal: agg.shippableSubtotal ?? agg.subtotal,
          totalWeight: agg.weight,
          totalWeightUnit: "kg",
          shipping: vendorProfiles.get(vendorId),
          selectedOptionId: params.vendorShippingSelections?.[vendorId],
        };
      }),
      destination,
      platformShipping,
      orders,
    });

    const vendorShippingCosts = new Map<
      string,
      { cost: number; method: ResolvedShippingMethod }
    >();
    const vendorGroups: VendorRateGroup[] = multi.perVendor.map((v) => {
      const method = methodFromResult(v.result);
      vendorShippingCosts.set(v.vendorId, { cost: v.result.shippingCost, method });
      return {
        vendorId: v.vendorId,
        vendorName: vendorNames.get(v.vendorId),
        options: v.result.options,
        selectedOptionId: v.result.selectedOptionId,
        cost: v.result.shippingCost,
        method,
      };
    });

    return {
      available: multi.available,
      mode: "vendor",
      shippingCost: multi.totalShippingCost,
      vendorShippingCosts,
      singleOptions: [],
      vendorGroups,
      customs,
    };
  }

  const result = calculateShipping({
    subtotal: shippableSubtotal,
    totalWeight,
    totalWeightUnit: "kg",
    destination,
    shipping: platformShipping,
    orders,
    selectedOptionId: params.selectedShippingOptionId,
  });

  return {
    available: result.available,
    mode: "single",
    shippingCost: result.shippingCost,
    selectedShippingMethod: methodFromResult(result),
    vendorShippingCosts: new Map(),
    singleOptions: result.options,
    vendorGroups: [],
    customs,
  };
}

// ============================================================
// Stripe metadata (de)serialization — keeps the PaymentIntent /
// Checkout Session metadata compact and the finalize step in parity.
// ============================================================

export type ShippingMetadata = {
  shipping: string; // total shipping cost
  shippingMethod: string; // JSON ResolvedShippingMethod | ""
  customsDuty: string; // duty amount
  customs: string; // JSON customs estimate | ""
  vendorShipping: string; // JSON { [vendorId]: { c, n, oid, mn, mx } } | ""
};

export function buildShippingMetadata(
  resolution: ResolvedCheckoutShipping,
): ShippingMetadata {
  const vendorShipping: Record<
    string,
    { c: number; n?: string; oid?: string; mn?: number; mx?: number }
  > = {};
  for (const [vendorId, entry] of resolution.vendorShippingCosts.entries()) {
    vendorShipping[vendorId] = {
      c: entry.cost,
      n: entry.method.name,
      oid: entry.method.optionId,
      mn: entry.method.minDays,
      mx: entry.method.maxDays,
    };
  }

  return {
    shipping: String(resolution.shippingCost),
    shippingMethod: resolution.selectedShippingMethod
      ? JSON.stringify(resolution.selectedShippingMethod)
      : "",
    customsDuty: String(resolution.customs.dutyAmount || 0),
    customs: JSON.stringify(resolution.customs),
    vendorShipping:
      Object.keys(vendorShipping).length > 0
        ? JSON.stringify(vendorShipping)
        : "",
  };
}

export type ParsedShippingMetadata = {
  shippingMethod?: ResolvedShippingMethod;
  customs?: {
    dutyAmount: number;
    dutyMode?: "DDP" | "DDU";
    international?: boolean;
    collectedAtCheckout?: boolean;
  };
  // vendorId -> { cost, method }
  vendorShippingCosts: Map<string, { cost: number; method: ResolvedShippingMethod }>;
};

function safeParse<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function parseShippingMetadata(
  metadata: Record<string, string | undefined>,
): ParsedShippingMetadata {
  const shippingMethod = safeParse<ResolvedShippingMethod>(
    metadata.shippingMethod,
  );
  const customs = safeParse<ParsedShippingMetadata["customs"]>(metadata.customs);

  const rawVendor = safeParse<
    Record<string, { c: number; n?: string; oid?: string; mn?: number; mx?: number }>
  >(metadata.vendorShipping);

  const vendorShippingCosts = new Map<
    string,
    { cost: number; method: ResolvedShippingMethod }
  >();
  if (rawVendor) {
    for (const [vendorId, v] of Object.entries(rawVendor)) {
      vendorShippingCosts.set(vendorId, {
        cost: Number(v.c) || 0,
        method: { name: v.n, optionId: v.oid, minDays: v.mn, maxDays: v.mx },
      });
    }
  }

  return { shippingMethod, customs, vendorShippingCosts };
}

/**
 * Allocate shipping to sub-orders from a parsed per-vendor map (multi-vendor),
 * or attribute the whole order shipping to the sole sub-order (single
 * shipment). Mutates the sub-order objects in place. Shared by every
 * order-creation path so allocation never diverges.
 */
export function allocateSubOrderShipping(
  subOrders: Array<{
    vendorId: { toString: () => string };
    shippingCost?: number;
    shippingMethod?: unknown;
  }>,
  params: {
    vendorShippingCosts: Map<string, { cost: number; method: ResolvedShippingMethod }>;
    orderShippingCost: number;
    orderShippingMethod?: ResolvedShippingMethod;
  },
) {
  if (params.vendorShippingCosts.size > 0) {
    for (const sub of subOrders) {
      const entry = params.vendorShippingCosts.get(sub.vendorId.toString());
      if (entry) {
        sub.shippingCost = entry.cost;
        sub.shippingMethod = entry.method;
      }
    }
  } else if (subOrders.length === 1) {
    subOrders[0]!.shippingCost = params.orderShippingCost;
    subOrders[0]!.shippingMethod = params.orderShippingMethod;
  }
}
