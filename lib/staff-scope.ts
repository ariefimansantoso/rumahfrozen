export interface StaffAccessScope {
  vendorIds: string[];
  locationIds: string[];
  fulfillmentRegions: string[];
}

export const EMPTY_STAFF_SCOPE: StaffAccessScope = {
  vendorIds: [],
  locationIds: [],
  fulfillmentRegions: [],
};

export function normalizeStaffScope(input?: Partial<StaffAccessScope> | null) {
  return {
    vendorIds: normalizeList(input?.vendorIds),
    locationIds: normalizeList(input?.locationIds),
    fulfillmentRegions: normalizeList(input?.fulfillmentRegions),
  };
}

export function hasStaffScope(scope?: StaffAccessScope | null) {
  if (!scope) return false;
  return (
    scope.vendorIds.length > 0 ||
    scope.locationIds.length > 0 ||
    scope.fulfillmentRegions.length > 0
  );
}

export function buildStaffOrderScopeFilter(
  scope?: StaffAccessScope | null,
): Record<string, unknown> {
  if (!hasStaffScope(scope)) return {};

  const clauses: Record<string, unknown>[] = [];
  if (scope!.vendorIds.length > 0) {
    clauses.push(
      { "items.vendorId": { $in: scope!.vendorIds } },
      { "subOrders.vendorId": { $in: scope!.vendorIds } },
    );
  }

  if (scope!.locationIds.length > 0) {
    clauses.push({ posLocationId: { $in: scope!.locationIds } });
  }

  if (scope!.fulfillmentRegions.length > 0) {
    clauses.push(
      { "shippingAddress.country": { $in: scope!.fulfillmentRegions } },
      { "shippingAddress.state": { $in: scope!.fulfillmentRegions } },
    );
  }

  return clauses.length > 0 ? { $or: clauses } : impossibleQuery();
}

export function buildStaffProductScopeFilter(
  scope?: StaffAccessScope | null,
): Record<string, unknown> {
  if (!hasStaffScope(scope)) return {};

  const clauses: Record<string, unknown>[] = [];
  if (scope!.vendorIds.length > 0) {
    clauses.push({ vendorId: { $in: scope!.vendorIds } });
  }

  if (scope!.locationIds.length > 0) {
    clauses.push(
      { "locationInventory.locationId": { $in: scope!.locationIds } },
      { "variants.locationInventory.locationId": { $in: scope!.locationIds } },
    );
  }

  return clauses.length > 0 ? { $or: clauses } : impossibleQuery();
}

export function buildStaffLocationScopeFilter(
  scope?: StaffAccessScope | null,
): Record<string, unknown> {
  if (!scope?.locationIds.length) return {};
  return { _id: { $in: scope.locationIds } };
}

export function mergeScopeFilter(
  query: Record<string, unknown>,
  scopeFilter: Record<string, unknown>,
) {
  if (Object.keys(scopeFilter).length === 0) return query;
  if (Object.keys(query).length === 0) return scopeFilter;
  return { $and: [query, scopeFilter] };
}

function normalizeList(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function impossibleQuery() {
  return { _id: { $exists: false } };
}
