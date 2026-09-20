import { Types } from "mongoose";
import { Order, Product } from "@/models";
import { revalidateProductContent } from "@/lib/cache-invalidation";

export const PURCHASE_TYPE = {
  STANDARD: "standard",
  PREORDER: "preorder",
} as const;

export const PREORDER_ITEM_STATUS = {
  RESERVED: "reserved",
  PAYMENT_DUE: "payment_due",
  DELAYED: "delayed",
  PARTIALLY_READY: "partially_ready",
  READY: "ready",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export type PurchaseType = (typeof PURCHASE_TYPE)[keyof typeof PURCHASE_TYPE];

export type PreorderSettingsShape = {
  enabled?: boolean;
  releaseDate?: Date | string | null;
  message?: string | null;
  limit?: number | null;
  reservedQuantity?: number | null;
  preorderOnly?: boolean;
  autoConvert?: boolean;
  paymentMode?: "full" | "deposit" | "pay_later";
  depositType?: "percentage" | "fixed";
  depositValue?: number | null;
  supplierEta?: Date | string | null;
  batchName?: string | null;
};

export type PreorderProductShape = {
  _id?: unknown;
  stock?: number;
  preorder?: PreorderSettingsShape;
  variants?: Array<{
    _id?: unknown;
    stock?: number;
    preorder?: PreorderSettingsShape;
  }>;
};

export type PreorderReservationLine = {
  productId: string;
  quantity: number;
  variantId?: string;
};

export type PreorderSnapshot = {
  purchaseType: typeof PURCHASE_TYPE.PREORDER;
  preorderReleaseDate?: Date;
  preorderMessage?: string;
  preorderStatus: typeof PREORDER_ITEM_STATUS.RESERVED;
  preorderPaymentMode: "full" | "deposit" | "pay_later";
  preorderDepositAmount: number;
  preorderOutstandingAmount: number;
  preorderSupplierEta?: Date;
  preorderBatchName?: string;
};

export class PreorderUnavailableError extends Error {
  public readonly line: PreorderReservationLine;

  constructor(line: PreorderReservationLine) {
    super("Preorder is no longer available");
    this.name = "PreorderUnavailableError";
    this.line = line;
  }
}

function asDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function idsMatch(left: unknown, right?: string) {
  if (!left || !right) return false;
  return String((left as { _id?: unknown })?._id || left) === right;
}

function toObjectId(value: string) {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;
}

function normalizePaymentMode(settings?: PreorderSettingsShape) {
  return settings?.paymentMode === "deposit" || settings?.paymentMode === "pay_later"
    ? settings.paymentMode
    : "full";
}

export function calculatePreorderDeposit(params: {
  unitPrice: number;
  quantity: number;
  settings?: PreorderSettingsShape;
}) {
  const lineTotal = Math.max(0, params.unitPrice * params.quantity);
  const mode = normalizePaymentMode(params.settings);
  if (mode === "full") {
    return { paymentMode: mode, depositAmount: lineTotal, outstandingAmount: 0 };
  }
  if (mode === "pay_later") {
    return { paymentMode: mode, depositAmount: 0, outstandingAmount: lineTotal };
  }

  const rawValue = Number(params.settings?.depositValue || 0);
  const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
  const depositAmount =
    params.settings?.depositType === "fixed"
      ? Math.min(lineTotal, value * params.quantity)
      : Math.min(lineTotal, lineTotal * Math.min(value, 100) / 100);

  return {
    paymentMode: mode,
    depositAmount,
    outstandingAmount: Math.max(0, lineTotal - depositAmount),
  };
}

export function getVariantForPreorder(
  product: PreorderProductShape,
  variantId?: string,
) {
  if (!variantId) return undefined;
  return product.variants?.find((variant) => idsMatch(variant._id, variantId));
}

function shouldReserveVariantPreorder(
  product: PreorderProductShape,
  variantId?: string,
) {
  return Boolean(getVariantForPreorder(product, variantId)?.preorder?.enabled);
}

export function getPreorderSettings(
  product: PreorderProductShape,
  variantId?: string,
): PreorderSettingsShape | undefined {
  const variantPreorder = getVariantForPreorder(product, variantId)?.preorder;
  return variantPreorder?.enabled ? variantPreorder : product.preorder;
}

export function isPreorderWindowOpen(
  settings?: PreorderSettingsShape,
  now = new Date(),
) {
  if (!settings?.enabled) return false;
  const releaseDate = asDate(settings.releaseDate);
  if (
    settings.autoConvert !== false &&
    releaseDate &&
    releaseDate.getTime() < now.getTime()
  ) {
    return false;
  }
  return true;
}

export function getPreorderRemaining(settings?: PreorderSettingsShape) {
  if (!settings?.enabled) return 0;
  const limit = Number(settings.limit || 0);
  if (!Number.isFinite(limit) || limit <= 0) return Number.POSITIVE_INFINITY;
  const reserved = Number(settings.reservedQuantity || 0);
  return Math.max(0, limit - reserved);
}

export function getAvailableStock(
  product: PreorderProductShape,
  variantId?: string,
) {
  const variant = getVariantForPreorder(product, variantId);
  return Number(variant?.stock ?? product.stock ?? 0);
}

export function getPreorderSnapshot(
  product: PreorderProductShape,
  variantId?: string,
): PreorderSnapshot | null {
  const settings = getPreorderSettings(product, variantId);
  if (!isPreorderWindowOpen(settings)) return null;
  if (getPreorderRemaining(settings) <= 0) return null;

  const releaseDate = asDate(settings?.releaseDate);
  const supplierEta = asDate(settings?.supplierEta);
  const message =
    typeof settings?.message === "string" && settings.message.trim()
      ? settings.message.trim()
      : undefined;
  const batchName =
    typeof settings?.batchName === "string" && settings.batchName.trim()
      ? settings.batchName.trim()
      : undefined;

  return {
    purchaseType: PURCHASE_TYPE.PREORDER,
    preorderReleaseDate: releaseDate,
    preorderMessage: message,
    preorderStatus: PREORDER_ITEM_STATUS.RESERVED,
    preorderPaymentMode: normalizePaymentMode(settings),
    preorderDepositAmount: 0,
    preorderOutstandingAmount: 0,
    preorderSupplierEta: supplierEta,
    preorderBatchName: batchName,
  };
}

export function resolvePurchaseType(params: {
  product: PreorderProductShape;
  variantId?: string;
  requestedQuantity: number;
}):
  | { purchaseType: typeof PURCHASE_TYPE.STANDARD }
  | ({ purchaseType: typeof PURCHASE_TYPE.PREORDER } & PreorderSnapshot)
  | null {
  const settings = getPreorderSettings(params.product, params.variantId);
  const stock = getAvailableStock(params.product, params.variantId);

  // Only force the preorder path when the preorder is actually actionable
  // (window open and remaining capacity). This mirrors the storefront UI's
  // `isPreorderOpen()` check so a `preorderOnly` variant whose preorder
  // window has expired or whose limit has been reached still allows a
  // standard purchase when stock is sufficient.
  const preorderActionable =
    !!settings && isPreorderWindowOpen(settings) && getPreorderRemaining(settings) > 0;
  const forcePreorder = Boolean(settings?.preorderOnly) && preorderActionable;

  if (!forcePreorder && stock >= params.requestedQuantity) {
    return { purchaseType: PURCHASE_TYPE.STANDARD };
  }

  const snapshot = getPreorderSnapshot(params.product, params.variantId);
  if (!snapshot) return null;

  const remaining = getPreorderRemaining(settings);
  if (remaining < params.requestedQuantity) return null;

  return snapshot;
}

export function normalizePreorderDate(value: unknown) {
  return asDate(value);
}

export function getPreorderReleaseDateForOrder(
  items: Array<{ preorderReleaseDate?: unknown; purchaseType?: string }>,
) {
  const dates = items
    .filter((item) => item.purchaseType === PURCHASE_TYPE.PREORDER)
    .map((item) => asDate(item.preorderReleaseDate))
    .filter((date): date is Date => Boolean(date));

  if (dates.length === 0) return undefined;
  return dates.reduce((latest, date) =>
    date.getTime() > latest.getTime() ? date : latest,
  );
}

export function getOrderPreorderLines(
  items: Array<{
    productId: unknown;
    variantId?: unknown;
    quantity: number;
    purchaseType?: string;
  }>,
): PreorderReservationLine[] {
  return items
    .filter((item) => item.purchaseType === PURCHASE_TYPE.PREORDER)
    .map((item) => ({
      productId: String((item.productId as { _id?: unknown })?._id || item.productId),
      variantId: item.variantId ? String(item.variantId) : undefined,
      quantity: Number(item.quantity || 0),
    }))
    .filter((line) => line.productId && line.quantity > 0);
}

function mergePreorderLines(lines: PreorderReservationLine[]) {
  const merged = new Map<string, PreorderReservationLine>();
  for (const line of lines) {
    if (!line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      continue;
    }
    const key = `${line.productId}:${line.variantId || ""}`;
    const current = merged.get(key);
    if (current) {
      current.quantity += line.quantity;
    } else {
      merged.set(key, { ...line });
    }
  }
  return Array.from(merged.values());
}

function buildPreorderWindowQuery(path: string) {
  const now = new Date();
  return {
    [`${path}.enabled`]: true,
    $or: [
      { [`${path}.autoConvert`]: false },
      { [`${path}.releaseDate`]: { $exists: false } },
      { [`${path}.releaseDate`]: null },
      { [`${path}.releaseDate`]: { $gte: now } },
    ],
  };
}

function buildParentLimitExpr(quantity: number) {
  return {
    $or: [
      { $lte: [{ $ifNull: ["$preorder.limit", 0] }, 0] },
      {
        $lte: [
          { $add: [{ $ifNull: ["$preorder.reservedQuantity", 0] }, quantity] },
          "$preorder.limit",
        ],
      },
    ],
  };
}

function buildVariantLimitExpr(variantId: string, quantity: number) {
  const variantObjectId = toObjectId(variantId);
  return {
    $let: {
      vars: {
        variant: {
          $first: {
            $filter: {
              input: "$variants",
              as: "variant",
              cond: { $eq: ["$$variant._id", variantObjectId] },
            },
          },
        },
      },
      in: {
        $or: [
          { $lte: [{ $ifNull: ["$$variant.preorder.limit", 0] }, 0] },
          {
            $lte: [
              {
                $add: [
                  { $ifNull: ["$$variant.preorder.reservedQuantity", 0] },
                  quantity,
                ],
              },
              "$$variant.preorder.limit",
            ],
          },
        ],
      },
    },
  };
}

async function reservePreorderLine(line: PreorderReservationLine) {
  const product = await Product.findById(line.productId).lean<PreorderProductShape>();
  if (!product) throw new PreorderUnavailableError(line);

  const result = resolvePurchaseType({
    product,
    variantId: line.variantId,
    requestedQuantity: line.quantity,
  });
  if (!result || result.purchaseType !== PURCHASE_TYPE.PREORDER) {
    throw new PreorderUnavailableError(line);
  }

  if (line.variantId && shouldReserveVariantPreorder(product, line.variantId)) {
    const variantObjectId = toObjectId(line.variantId);
    const updateResult = await Product.updateOne(
      {
        _id: line.productId,
        variants: {
          $elemMatch: {
            _id: variantObjectId,
            ...buildPreorderWindowQuery("preorder"),
          },
        },
        $expr: buildVariantLimitExpr(line.variantId, line.quantity),
      },
      { $inc: { "variants.$.preorder.reservedQuantity": line.quantity } },
    );
    if (updateResult.modifiedCount !== 1) throw new PreorderUnavailableError(line);
    return;
  }

  const updateResult = await Product.updateOne(
    {
      _id: line.productId,
      ...buildPreorderWindowQuery("preorder"),
      $expr: buildParentLimitExpr(line.quantity),
    },
    { $inc: { "preorder.reservedQuantity": line.quantity } },
  );
  if (updateResult.modifiedCount !== 1) throw new PreorderUnavailableError(line);
}

export async function reservePreorderQuantity(lines: PreorderReservationLine[]) {
  const normalizedLines = mergePreorderLines(lines);
  const applied: PreorderReservationLine[] = [];

  try {
    for (const line of normalizedLines) {
      await reservePreorderLine(line);
      applied.push(line);
    }
  } catch (err) {
    if (applied.length > 0) {
      await releasePreorderQuantity(applied).catch((rollbackErr) => {
        console.error(
          "Failed to roll back partial preorder reservation:",
          rollbackErr,
        );
      });
    }
    throw err;
  }

  // Refresh cached storefront product pages so the new preorder
  // remaining count is reflected immediately.
  await invalidatePreorderProductCache(normalizedLines);
}

/**
 * Look up slugs for the given preorder reservation lines and trigger
 * a cache invalidation. Best-effort: failures are logged but never
 * thrown, because cache invalidation must not break order placement.
 */
async function invalidatePreorderProductCache(
  lines: PreorderReservationLine[],
): Promise<void> {
  const productIds = Array.from(
    new Set(
      lines
        .map((line) => String(line.productId || "").trim())
        .filter(Boolean),
    ),
  );
  if (productIds.length === 0) return;

  try {
    const slugs = (
      await Product.find({ _id: { $in: productIds } })
        .select("slug")
        .lean()
    )
      .map((p) => p.slug)
      .filter(
        (slug): slug is string => typeof slug === "string" && slug.length > 0,
      );
    revalidateProductContent({ slugs });
  } catch (err) {
    console.error(
      "Failed to invalidate product cache after preorder reservation:",
      err,
    );
  }
}

export async function releasePreorderQuantity(lines: PreorderReservationLine[]) {
  for (const line of mergePreorderLines(lines)) {
    const product = line.variantId
      ? await Product.findById(line.productId).lean<PreorderProductShape>()
      : null;

    if (
      product &&
      line.variantId &&
      shouldReserveVariantPreorder(product, line.variantId)
    ) {
      const variantObjectId = toObjectId(line.variantId);
      await Product.updateOne(
        { _id: line.productId, "variants._id": variantObjectId },
        [
          {
            $set: {
              variants: {
                $map: {
                  input: "$variants",
                  as: "variant",
                  in: {
                    $cond: [
                      { $eq: ["$$variant._id", toObjectId(line.variantId)] },
                      {
                        $mergeObjects: [
                          "$$variant",
                          {
                            preorder: {
                              $mergeObjects: [
                                "$$variant.preorder",
                                {
                                  reservedQuantity: {
                                    $max: [
                                      0,
                                      {
                                        $subtract: [
                                          {
                                            $ifNull: [
                                              "$$variant.preorder.reservedQuantity",
                                              0,
                                            ],
                                          },
                                          line.quantity,
                                        ],
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                      "$$variant",
                    ],
                  },
                },
              },
            },
          },
        ],
        { updatePipeline: true },
      );
      continue;
    }

    await Product.updateOne(
      { _id: line.productId },
      [
        {
          $set: {
            "preorder.reservedQuantity": {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ["$preorder.reservedQuantity", 0] },
                    line.quantity,
                  ],
                },
              ],
            },
          },
        },
      ],
      { updatePipeline: true },
    );
  }
}

export async function markOrderPreorderReserved(orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) return;
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        preorderReserved: true,
        "subOrders.$[].preorderReserved": true,
      },
    },
  );
}

export async function releaseOrderPreorders(orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) return false;

  const order = await Order.findOneAndUpdate(
    { _id: orderId, "subOrders.preorderReserved": true },
    {
      $set: {
        preorderReserved: false,
        preorderStatus: PREORDER_ITEM_STATUS.CANCELLED,
        "items.$[item].preorderStatus": PREORDER_ITEM_STATUS.CANCELLED,
        "subOrders.$[sub].preorderReserved": false,
        "subOrders.$[].items.$[subItem].preorderStatus":
          PREORDER_ITEM_STATUS.CANCELLED,
      },
    },
    {
      new: false,
      arrayFilters: [
        { "sub.preorderReserved": true },
        { "item.purchaseType": PURCHASE_TYPE.PREORDER },
        { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
      ],
    },
  ).lean();

  if (!order) return false;
  const lines = getOrderPreorderLines(order.items || []);
  if (lines.length === 0) return false;
  await releasePreorderQuantity(lines);
  return true;
}

export async function releaseSubOrderPreorders(params: {
  orderId: string;
  vendorId: string;
}) {
  if (!Types.ObjectId.isValid(params.orderId)) return false;

  const order = await Order.findOneAndUpdate(
    {
      _id: params.orderId,
      subOrders: {
        $elemMatch: {
          vendorId: new Types.ObjectId(params.vendorId),
          preorderReserved: true,
        },
      },
    },
    {
      $set: {
        "subOrders.$[sub].preorderReserved": false,
        "subOrders.$[sub].items.$[subItem].preorderStatus":
          PREORDER_ITEM_STATUS.CANCELLED,
      },
    },
    {
      new: false,
      arrayFilters: [
        {
          "sub.vendorId": new Types.ObjectId(params.vendorId),
          "sub.preorderReserved": true,
        },
        { "subItem.purchaseType": PURCHASE_TYPE.PREORDER },
      ],
    },
  ).lean();

  if (!order) return false;

  const subOrders = (order.subOrders || []) as Array<{
    vendorId?: unknown;
    preorderReserved?: boolean;
    items?: Array<{
      productId: unknown;
      variantId?: unknown;
      quantity: number;
      purchaseType?: string;
    }>;
  }>;
  const subOrder = subOrders.find(
    (sub) =>
      sub.preorderReserved &&
      String((sub.vendorId as { _id?: unknown })?._id || sub.vendorId) ===
        params.vendorId,
  );

  const lines = getOrderPreorderLines(subOrder?.items || []);
  if (lines.length > 0) {
    await releasePreorderQuantity(lines);
  }

  const remaining = await Order.exists({
    _id: params.orderId,
    "subOrders.preorderReserved": true,
  });
  if (!remaining) {
    await Order.updateOne(
      { _id: params.orderId },
      { $set: { preorderReserved: false } },
    );
  }

  return lines.length > 0;
}
