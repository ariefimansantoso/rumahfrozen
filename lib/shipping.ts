export type ShippingRateType =
  | "flat"
  | "free_over"
  | "subtotal_range"
  | "weight_range";

export const SHIPPING_UNAVAILABLE_MESSAGE =
  "Shipping is not available for this address.";

export type WeightUnit = "kg" | "lb";

export type InputWeightUnit = "g" | "kg" | "lb" | "oz";

export type ShippingDutyMode = "DDP" | "DDU";

export type ShippingDestination = {
  country?: string;
  state?: string;
};

export type ShippingDeliveryDefaults = {
  processingDaysMin?: number;
  processingDaysMax?: number;
  showEstimatedDelivery?: boolean;
};

export type ShippingRate = {
  id?: string;
  name?: string;
  type?: ShippingRateType;
  price?: number;
  freeOver?: number;
  minSubtotal?: number;
  maxSubtotal?: number;
  // weight_range bounds, expressed in the store's configured weight unit
  minWeight?: number;
  maxWeight?: number;
  // optional incremental charge added per unit of weight (on top of price)
  pricePerWeightUnit?: number;
  minDays?: number;
  maxDays?: number;
  active?: boolean;
};

export type ShippingZone = {
  id?: string;
  name?: string;
  countries?: string[];
  regions?: string[];
  rates?: ShippingRate[];
};

export type FallbackShippingRate = {
  enabled?: boolean;
  name?: string;
  price?: number;
  minDays?: number;
  maxDays?: number;
};

export type LocalPickupSettings = {
  enabled?: boolean;
  pickupAddress?: string;
  instructions?: string;
  readyInDaysMin?: number;
  readyInDaysMax?: number;
};

export type CustomsSettings = {
  enabled?: boolean;
  // DDP = duties collected at checkout; DDU/DAP = customer pays on delivery.
  dutyMode?: ShippingDutyMode;
  // estimated duty as a percentage of subtotal (used for DDP estimates)
  dutyRatePercent?: number;
  // orders at/below this subtotal are treated as duty-free (de minimis)
  deMinimis?: number;
};

export type ShippingSettings = {
  enabled?: boolean;
  weightUnit?: WeightUnit;
  delivery?: ShippingDeliveryDefaults;
  zones?: ShippingZone[];
  fallbackRate?: FallbackShippingRate;
  localPickup?: LocalPickupSettings;
  customs?: CustomsSettings;
  // when enabled, multi-vendor carts price each vendor's items against that
  // vendor's own shipping profile (falling back to this platform profile)
  vendorShipping?: { enabled?: boolean };
  origin?: ShippingDestination;
};

export type LegacyOrderSettings = {
  freeShippingThreshold?: number;
  defaultShippingCost?: number;
};

export type ShippingRateOptionSource = "zone" | "fallback" | "pickup" | "legacy";

export type ShippingRateOption = {
  id: string;
  name: string;
  cost: number;
  source: ShippingRateOptionSource;
  zoneId?: string;
  rateId?: string;
  deliveryDays?: { min: number; max: number };
};

export type ShippingCalculationResult = {
  available: boolean;
  // cost of the currently selected option (back-compat with callers that
  // only read shippingCost)
  shippingCost: number;
  source: "shipping" | "orders";
  zoneId?: string;
  rateId?: string;
  deliveryDays?: { min: number; max: number };
  // every option the customer may choose between at checkout
  options: ShippingRateOption[];
  // id of the option reflected in shippingCost above
  selectedOptionId?: string;
};

export type CartWeightItem = {
  weight?: number;
  quantity?: number;
};

function n(value: unknown): number | undefined {
  const x = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(x)) return undefined;
  return x;
}

function normalizeToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function inRange(value: number, min?: number, max?: number) {
  if (typeof min === "number" && value < min) return false;
  if (typeof max === "number" && value > max) return false;
  return true;
}

function addDays(
  baseMin: number,
  baseMax: number,
  extraMin?: number,
  extraMax?: number,
) {
  const min = Math.max(0, baseMin + (extraMin ?? 0));
  const max = Math.max(min, baseMax + (extraMax ?? 0));
  return { min, max };
}

function legacyShipping(subtotal: number, orders?: LegacyOrderSettings): number {
  const threshold = n(orders?.freeShippingThreshold) ?? 0;
  const base = Math.max(0, n(orders?.defaultShippingCost) ?? 5);
  return threshold > 0 && subtotal >= threshold ? 0 : base;
}

/** Sum the shippable weight of a cart in the store's weight unit. */
export function calculateCartWeight(items: CartWeightItem[] | undefined): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    const weight = Math.max(0, n(item?.weight) ?? 0);
    const qty = Math.max(0, n(item?.quantity) ?? 0);
    return total + weight * qty;
  }, 0);
}

function pickSelected(
  options: ShippingRateOption[],
  selectedOptionId?: string,
): ShippingRateOption | undefined {
  if (options.length === 0) return undefined;
  if (selectedOptionId) {
    const match = options.find((o) => o.id === selectedOptionId);
    if (match) return match;
  }
  // default: cheapest, tiebreak by fastest max delivery
  return [...options].sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    const aMax = a.deliveryDays?.max ?? Number.POSITIVE_INFINITY;
    const bMax = b.deliveryDays?.max ?? Number.POSITIVE_INFINITY;
    return aMax - bMax;
  })[0];
}

export function calculateShipping(params: {
  subtotal: number;
  totalWeight?: number;
  totalWeightUnit?: InputWeightUnit;
  destination?: ShippingDestination;
  shipping?: ShippingSettings;
  orders?: LegacyOrderSettings;
  selectedOptionId?: string;
}): ShippingCalculationResult {
  const subtotal = Math.max(0, n(params.subtotal) ?? 0);
  const inputWeight = Math.max(0, n(params.totalWeight) ?? 0);
  const rateWeightUnit = params.shipping?.weightUnit ?? "kg";
  const gramsPerUnit: Record<InputWeightUnit, number> = {
    g: 1,
    kg: 1000,
    lb: 453.59237,
    oz: 28.349523125,
  };
  const totalWeight = params.totalWeightUnit
    ? (inputWeight * gramsPerUnit[params.totalWeightUnit]) /
      gramsPerUnit[rateWeightUnit]
    : inputWeight;

  const shippingEnabled = Boolean(params.shipping?.enabled);
  const destinationCountry = normalizeToken(params.destination?.country);
  const destinationState = normalizeToken(params.destination?.state);

  const processingMin = Math.max(
    0,
    n(params.shipping?.delivery?.processingDaysMin) ?? 0,
  );
  const processingMax = Math.max(
    processingMin,
    n(params.shipping?.delivery?.processingDaysMax) ?? processingMin,
  );

  if (!shippingEnabled) {
    const cost = legacyShipping(subtotal, params.orders);
    const option: ShippingRateOption = {
      id: "legacy",
      name: "Standard",
      cost,
      source: "legacy",
    };
    return {
      available: true,
      shippingCost: cost,
      source: "orders",
      options: [option],
      selectedOptionId: option.id,
    };
  }

  const zones = Array.isArray(params.shipping?.zones)
    ? params.shipping?.zones
    : [];

  const zoneMatches = (zones ?? []).filter((zone) => {
    const countries = Array.isArray(zone.countries) ? zone.countries : [];
    if (!destinationCountry || countries.length === 0) return false;
    const countryOk = countries.some(
      (c) => normalizeToken(c) === destinationCountry,
    );
    if (!countryOk) return false;

    const regions = Array.isArray(zone.regions) ? zone.regions : [];
    if (regions.length === 0) return true;
    if (!destinationState) return false;
    return regions.some((r) => normalizeToken(r) === destinationState);
  });

  const options: ShippingRateOption[] = [];

  for (const zone of zoneMatches) {
    const rates = Array.isArray(zone.rates) ? zone.rates : [];
    for (const rate of rates) {
      if (rate && rate.active === false) continue;
      const type = rate.type ?? "flat";
      const delivery = addDays(
        processingMin,
        processingMax,
        n(rate.minDays),
        n(rate.maxDays),
      );
      const base = {
        zoneId: zone.id,
        rateId: rate.id,
        name: rate.name || zone.name || "Shipping",
        source: "zone" as const,
        deliveryDays: delivery,
      };

      if (type === "flat") {
        options.push({
          ...base,
          id: rate.id || `${zone.id}-flat`,
          cost: Math.max(0, n(rate.price) ?? 0),
        });
        continue;
      }

      if (type === "free_over") {
        const freeOver = Math.max(0, n(rate.freeOver) ?? 0);
        if (subtotal >= freeOver) {
          options.push({
            ...base,
            id: rate.id || `${zone.id}-freeover`,
            cost: 0,
          });
        }
        continue;
      }

      if (type === "subtotal_range") {
        if (inRange(subtotal, n(rate.minSubtotal), n(rate.maxSubtotal))) {
          options.push({
            ...base,
            id: rate.id || `${zone.id}-subrange`,
            cost: Math.max(0, n(rate.price) ?? 0),
          });
        }
        continue;
      }

      if (type === "weight_range") {
        if (inRange(totalWeight, n(rate.minWeight), n(rate.maxWeight))) {
          const perUnit = Math.max(0, n(rate.pricePerWeightUnit) ?? 0);
          const cost = Math.max(0, n(rate.price) ?? 0) + perUnit * totalWeight;
          options.push({
            ...base,
            id: rate.id || `${zone.id}-weight`,
            cost: Math.max(0, cost),
          });
        }
        continue;
      }
    }
  }

  // Local pickup is offered as an additional (typically free) option.
  const pickup = params.shipping?.localPickup;
  if (pickup?.enabled) {
    options.push({
      id: "pickup",
      name: "Local pickup",
      cost: 0,
      source: "pickup",
      deliveryDays: addDays(
        0,
        0,
        n(pickup.readyInDaysMin),
        n(pickup.readyInDaysMax),
      ),
    });
  }

  // Fallback only applies when no zone produced a shipping rate.
  const hasZoneRate = options.some((o) => o.source === "zone");
  const fallback = params.shipping?.fallbackRate;
  if (!hasZoneRate && fallback?.enabled) {
    options.push({
      id: "fallback",
      name: fallback.name || "Standard",
      cost: Math.max(0, n(fallback.price) ?? 0),
      source: "fallback",
      deliveryDays: addDays(
        processingMin,
        processingMax,
        n(fallback.minDays),
        n(fallback.maxDays),
      ),
    });
  }

  if (options.length === 0) {
    return {
      available: false,
      shippingCost: 0,
      source: "shipping",
      options: [],
    };
  }

  const selected = pickSelected(options, params.selectedOptionId)!;
  return {
    available: true,
    shippingCost: selected.cost,
    source: "shipping",
    zoneId: selected.zoneId,
    rateId: selected.rateId,
    deliveryDays: selected.deliveryDays,
    options,
    selectedOptionId: selected.id,
  };
}

// ============================================================
// Multi-vendor shipping
// ============================================================

export type VendorShippingGroup = {
  vendorId: string;
  subtotal: number;
  totalWeight?: number;
  totalWeightUnit?: InputWeightUnit;
  // the vendor's own shipping profile, if they manage one
  shipping?: ShippingSettings;
  selectedOptionId?: string;
};

export type VendorShippingResult = {
  vendorId: string;
  result: ShippingCalculationResult;
};

export type MultiVendorShippingResult = {
  perVendor: VendorShippingResult[];
  totalShippingCost: number;
  available: boolean;
};

/**
 * Price a multi-vendor cart. Each vendor group is rated against its own
 * shipping profile when vendor shipping is enabled and the vendor has a
 * usable profile; otherwise it falls back to the platform profile.
 */
export function calculateShippingByVendor(params: {
  groups: VendorShippingGroup[];
  destination?: ShippingDestination;
  platformShipping?: ShippingSettings;
  orders?: LegacyOrderSettings;
}): MultiVendorShippingResult {
  const vendorShippingEnabled = Boolean(
    params.platformShipping?.vendorShipping?.enabled,
  );

  const perVendor = params.groups.map((group) => {
    const vendorProfileUsable =
      vendorShippingEnabled &&
      Boolean(group.shipping?.enabled) &&
      Array.isArray(group.shipping?.zones);

    const shipping = vendorProfileUsable
      ? group.shipping
      : params.platformShipping;

    const result = calculateShipping({
      subtotal: group.subtotal,
      totalWeight: group.totalWeight,
      totalWeightUnit: group.totalWeightUnit,
      destination: params.destination,
      shipping,
      orders: params.orders,
      selectedOptionId: group.selectedOptionId,
    });

    return { vendorId: group.vendorId, result };
  });

  const totalShippingCost = perVendor.reduce(
    (sum, v) => sum + Math.max(0, v.result.shippingCost),
    0,
  );

  return {
    perVendor,
    totalShippingCost,
    available: perVendor.every((vendor) => vendor.result.available),
  };
}

// ============================================================
// Customs / duties
// ============================================================

export type CustomsEstimate = {
  // estimated duty/tax collected at checkout (DDP only)
  dutyAmount: number;
  dutyMode: ShippingDutyMode;
  // true when the destination is treated as a cross-border shipment
  international: boolean;
  // true when duties are the customer's responsibility on delivery
  collectedAtCheckout: boolean;
};

/**
 * Estimate import duties for an order. Only produces a non-zero charge for
 * cross-border DDP shipments above the de-minimis threshold. DDU/DAP returns a
 * zero charge (customer settles with the carrier on delivery).
 */
export function estimateCustomsDuty(params: {
  subtotal: number;
  destination?: ShippingDestination;
  originCountry?: string;
  customs?: CustomsSettings;
}): CustomsEstimate {
  const dutyMode: ShippingDutyMode = params.customs?.dutyMode ?? "DDU";
  const enabled = Boolean(params.customs?.enabled);

  const destCountry = normalizeToken(params.destination?.country);
  const originCountry = normalizeToken(params.originCountry);
  const international = Boolean(
    destCountry && originCountry && destCountry !== originCountry,
  );

  const collectedAtCheckout = enabled && international && dutyMode === "DDP";

  if (!collectedAtCheckout) {
    return {
      dutyAmount: 0,
      dutyMode,
      international,
      collectedAtCheckout: false,
    };
  }

  const subtotal = Math.max(0, n(params.subtotal) ?? 0);
  const deMinimis = Math.max(0, n(params.customs?.deMinimis) ?? 0);
  if (subtotal <= deMinimis) {
    return { dutyAmount: 0, dutyMode, international, collectedAtCheckout };
  }

  const ratePercent = Math.max(0, n(params.customs?.dutyRatePercent) ?? 0);
  const dutyAmount = Math.max(0, (subtotal * ratePercent) / 100);
  return { dutyAmount, dutyMode, international, collectedAtCheckout };
}
