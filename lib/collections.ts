import { Product, Collection, Vendor } from "@/models";
import type {
  IProduct,
  ICollection,
  CollectionCondition,
  CollectionSortOrder,
} from "@/types";
import mongoose from "mongoose";
import { getStorefrontProductConstraint } from "@/lib/product-visibility";

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

/**
 * Map collection condition fields to product schema fields
 */
const FIELD_MAP: Record<string, string> = {
  title: "title",
  productType: "productType",
  vendor: "vendorId",
  tag: "tags",
  price: "price",
  comparePrice: "comparePrice",
  weight: "shipping.weight",
  stock: "stock",
  createdAt: "createdAt",
  category: "category",
};

async function resolveVendorIdsForCondition(
  operator: CollectionCondition["operator"],
  value: unknown
): Promise<string[]> {
  if (typeof value !== "string" || !value.trim()) return [];
  const raw = value.trim();
  if (mongoose.Types.ObjectId.isValid(raw)) return [raw];

  const escaped = escapeRegex(raw);

  const storeNameRegex =
    operator === "equals" || operator === "not_equals"
      ? new RegExp(`^${escaped}$`, "i")
      : operator === "starts_with"
        ? new RegExp(`^${escaped}`, "i")
        : operator === "ends_with"
          ? new RegExp(`${escaped}$`, "i")
          : new RegExp(escaped, "i");

  const vendors = await Vendor.find({
    $or: [{ slug: raw.toLowerCase() }, { storeName: { $regex: storeNameRegex } }],
  })
    .select("_id")
    .lean();

  return vendors.map((v) => String(v._id));
}

/**
 * Build MongoDB query from automated collection conditions
 */
function buildSingleConditionQuery(
  condition: CollectionCondition
): Record<string, unknown> {
  const { field, operator, value } = condition;
  const mongoField = FIELD_MAP[field] || field;

  switch (operator) {
    case "equals":
      if (field === "vendor" && mongoField === "vendorId" && !isObjectIdString(value)) {
        return { vendorId: { $in: [] } };
      }
      return { [mongoField]: value };

    case "not_equals":
      if (field === "vendor" && mongoField === "vendorId" && !isObjectIdString(value)) {
        return { vendorId: { $nin: [] } };
      }
      return { [mongoField]: { $ne: value } };

    case "greater_than":
      return { [mongoField]: { $gt: value } };

    case "less_than":
      return { [mongoField]: { $lt: value } };

    case "starts_with":
      return {
        [mongoField]: {
          $regex: `^${escapeRegex(String(value))}`,
          $options: "i",
        },
      };

    case "ends_with":
      return {
        [mongoField]: {
          $regex: `${escapeRegex(String(value))}$`,
          $options: "i",
        },
      };

    case "contains":
      if (field === "tag") {
        return { tags: { $in: [value] } };
      }
      return {
        [mongoField]: {
          $regex: escapeRegex(String(value)),
          $options: "i",
        },
      };

    case "not_contains":
      if (field === "tag") {
        return { tags: { $nin: [value] } };
      }
      return {
        [mongoField]: {
          $not: { $regex: escapeRegex(String(value)), $options: "i" },
        },
      };

    case "is_set":
      return {
        $and: [
          { [mongoField]: { $exists: true } },
          { [mongoField]: { $ne: null } },
          { [mongoField]: { $ne: "" } },
        ],
      };

    case "is_not_set":
      return {
        $or: [
          { [mongoField]: { $exists: false } },
          { [mongoField]: null },
          { [mongoField]: "" },
        ],
      };

    default:
      return {};
  }
}

export function buildConditionQuery(
  conditions: CollectionCondition[],
  matchType: "all" | "any"
): Record<string, unknown> {
  if (conditions.length === 0) return {};

  const conditionQueries = conditions.map(buildSingleConditionQuery);

  if (matchType === "all") {
    return { $and: conditionQueries };
  } else {
    return { $or: conditionQueries };
  }
}

export async function buildConditionQueryAsync(
  conditions: CollectionCondition[],
  matchType: "all" | "any"
): Promise<Record<string, unknown>> {
  if (conditions.length === 0) return {};

  const conditionQueries = await Promise.all(
    conditions.map(async (condition) => {
      const { field, operator, value } = condition;
      const mongoField = FIELD_MAP[field] || field;

      if (field !== "vendor" || mongoField !== "vendorId") {
        return buildSingleConditionQuery(condition);
      }

      if (operator === "is_set") {
        return {
          $and: [{ vendorId: { $exists: true } }, { vendorId: { $ne: null } }],
        };
      }
      if (operator === "is_not_set") {
        return {
          $or: [{ vendorId: { $exists: false } }, { vendorId: null }],
        };
      }

      const vendorIds = await resolveVendorIdsForCondition(operator, value);
      if (vendorIds.length === 0) {
        if (operator === "not_equals" || operator === "not_contains") {
          return { vendorId: { $nin: [] } };
        }
        return { vendorId: { $in: [] } };
      }

      if (operator === "not_equals" || operator === "not_contains") {
        return { vendorId: { $nin: vendorIds } };
      }
      return { vendorId: { $in: vendorIds } };
    })
  );

  if (matchType === "all") {
    return { $and: conditionQueries };
  } else {
    return { $or: conditionQueries };
  }
}

export async function normalizeCollectionConditions(
  conditions: CollectionCondition[]
): Promise<CollectionCondition[]> {
  const normalized: CollectionCondition[] = [];

  for (const condition of conditions) {
    if (condition.field !== "vendor") {
      normalized.push(condition);
      continue;
    }

    if (isObjectIdString(condition.value)) {
      normalized.push(condition);
      continue;
    }

    const vendorIds = await resolveVendorIdsForCondition(
      condition.operator,
      condition.value
    );

    if (vendorIds.length === 1) {
      normalized.push({ ...condition, value: vendorIds[0] });
      continue;
    }

    normalized.push(condition);
  }

  return normalized;
}

/**
 * Build sort object based on collection sortOrder
 */
function buildSortObject(
  sortOrder: CollectionSortOrder
): Record<string, 1 | -1> {
  const sortMap: Record<string, Record<string, 1 | -1>> = {
    "title-asc": { title: 1 },
    "title-desc": { title: -1 },
    "price-asc": { price: 1 },
    "price-desc": { price: -1 },
    "created-asc": { createdAt: 1 },
    "created-desc": { createdAt: -1 },
    "best-selling": { totalSales: -1, createdAt: -1 },
    manual: { createdAt: -1 },
  };
  return sortMap[sortOrder] || { createdAt: -1 };
}

/**
 * Get products for a collection (handles both manual and automated)
 */
export async function getCollectionProducts(
  collection: ICollection,
  options: {
    page?: number;
    limit?: number;
    publishingChannel?: "onlineStore" | "pointOfSale";
    locationId?: string;
    sortOrder?: CollectionSortOrder;
  } = {}
): Promise<{ products: IProduct[]; total: number }> {
  const { page = 1, limit = 24, publishingChannel, sortOrder } = options;
  const skip = (page - 1) * limit;

  let query: Record<string, unknown> = {
    status: "active",
    ...(await getStorefrontProductConstraint()),
  };

  // Filter by publishing channel
  if (publishingChannel) {
    query[`publishing.${publishingChannel}`] = true;
  }

  if (collection.collectionType === "manual") {
    // Manual collection: use product IDs
    if (collection.products && collection.products.length > 0) {
      query._id = { $in: collection.products };
    } else {
      // Empty manual collection
      return { products: [], total: 0 };
    }
  } else {
    // Automated collection: build query from conditions
    const conditionQuery = await buildConditionQueryAsync(
      collection.conditions,
      collection.conditionMatch
    );
    query = { ...query, ...conditionQuery };
  }

  // Use provided sortOrder or collection's default
  const effectiveSortOrder = sortOrder || collection.sortOrder;
  const sort = buildSortObject(effectiveSortOrder);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("vendorId", "storeName slug")
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  return { products: products as IProduct[], total };
}

/**
 * Update product count for a collection
 */
export async function updateCollectionProductCount(
  collectionId: string
): Promise<number> {
  const collection = await Collection.findById(collectionId);
  if (!collection) return 0;

  let count = 0;
  if (collection.collectionType === "manual") {
    count = collection.products?.length || 0;
  } else {
    const query = await buildConditionQueryAsync(
      collection.conditions,
      collection.conditionMatch
    );
    count = await Product.countDocuments({ ...query, status: "active" });
  }

  await Collection.updateOne({ _id: collectionId }, { productCount: count });
  return count;
}

/**
 * Update product counts for all collections
 * Useful for background jobs or after bulk product updates
 */
export async function updateAllCollectionProductCounts(): Promise<void> {
  const collections = await Collection.find({}).lean();

  for (const collection of collections) {
    await updateCollectionProductCount(collection._id.toString());
  }
}

/**
 * Check if a product matches a collection's conditions
 */
export function productMatchesConditions(
  product: IProduct,
  conditions: CollectionCondition[],
  matchType: "all" | "any"
): boolean {
  if (conditions.length === 0) return true;

  const results = conditions.map((condition) => {
    const { field, operator, value } = condition;

    // Get product value for the field
    let productValue: unknown;
    switch (field) {
      case "title":
        productValue = product.title || product.name;
        break;
      case "productType":
        productValue = product.productType;
        break;
      case "vendor": {
        const vid = product.vendorId as unknown;
        if (vid && typeof vid === "object" && "_id" in (vid as Record<string, unknown>)) {
          productValue = String((vid as { _id: unknown })._id);
        } else if (vid) {
          productValue = String(vid);
        }
        break;
      }
      case "tag":
        productValue = product.tags;
        break;
      case "price":
        productValue = product.price;
        break;
      case "comparePrice":
        productValue = product.comparePrice;
        break;
      case "weight":
        productValue = product.shipping?.weight;
        break;
      case "stock":
        productValue = product.stock;
        break;
      case "createdAt":
        productValue = product.createdAt;
        break;
      case "category":
        productValue = product.category?.toString();
        break;
      default:
        productValue = undefined;
    }

    // Evaluate condition
    switch (operator) {
      case "equals":
        return productValue === value;
      case "not_equals":
        return productValue !== value;
      case "greater_than":
        return (productValue as number) > (value as number);
      case "less_than":
        return (productValue as number) < (value as number);
      case "starts_with":
        return String(productValue || "")
          .toLowerCase()
          .startsWith(String(value).toLowerCase());
      case "ends_with":
        return String(productValue || "")
          .toLowerCase()
          .endsWith(String(value).toLowerCase());
      case "contains":
        if (field === "tag" && Array.isArray(productValue)) {
          return productValue.includes(value);
        }
        return String(productValue || "")
          .toLowerCase()
          .includes(String(value).toLowerCase());
      case "not_contains":
        if (field === "tag" && Array.isArray(productValue)) {
          return !productValue.includes(value);
        }
        return !String(productValue || "")
          .toLowerCase()
          .includes(String(value).toLowerCase());
      case "is_set":
        return (
          productValue !== undefined &&
          productValue !== null &&
          productValue !== ""
        );
      case "is_not_set":
        return (
          productValue === undefined ||
          productValue === null ||
          productValue === ""
        );
      default:
        return false;
    }
  });

  if (matchType === "all") {
    return results.every((r) => r);
  } else {
    return results.some((r) => r);
  }
}

/**
 * Get collections that a product belongs to
 */
export async function getProductCollections(
  product: IProduct
): Promise<ICollection[]> {
  // Get manual collections that include this product
  const manualCollections = await Collection.find({
    collectionType: "manual",
    products: product._id,
    status: "active",
  }).lean();

  // Get automated collections and filter by conditions
  const automatedCollections = await Collection.find({
    collectionType: "automated",
    status: "active",
  }).lean();

  const matchingAutomated = automatedCollections.filter((collection) =>
    productMatchesConditions(
      product,
      collection.conditions,
      collection.conditionMatch
    )
  );

  return [...manualCollections, ...matchingAutomated] as ICollection[];
}

/**
 * Sync a product's collection memberships when collectionIds change.
 * Adds the product to newly selected collections and removes from deselected ones.
 */
export async function syncProductCollections(
  productId: string,
  oldCollectionIds: string[],
  newCollectionIds: string[]
): Promise<void> {
  const oldSet = new Set(oldCollectionIds.map(String));
  const newSet = new Set(newCollectionIds.map(String));

  const added = newCollectionIds.filter((id) => !oldSet.has(String(id)));
  const removed = oldCollectionIds.filter((id) => !newSet.has(String(id)));

  if (added.length > 0) {
    await Collection.updateMany(
      { _id: { $in: added } },
      { $addToSet: { products: productId } }
    );
  }

  if (removed.length > 0) {
    await Collection.updateMany(
      { _id: { $in: removed } },
      { $pull: { products: productId } }
    );
  }

  // Update product counts for all affected collections
  const allAffected = [...new Set([...added, ...removed])];
  for (const id of allAffected) {
    await updateCollectionProductCount(id);
  }
}

/**
 * Remove a product from all collections it belongs to.
 * Call this when a product is deleted.
 */
export async function removeProductFromAllCollections(
  productId: string
): Promise<void> {
  const affected = await Collection.find({ products: productId })
    .select("_id")
    .lean();

  if (affected.length > 0) {
    await Collection.updateMany(
      { products: productId },
      { $pull: { products: productId } }
    );

    for (const col of affected) {
      await updateCollectionProductCount(col._id.toString());
    }
  }
}
