import { Product } from "@/models";
import { revalidateProductContent } from "@/lib/cache-invalidation";

export type InventoryAdjustmentLine = {
  productId: string;
  quantity: number;
  variantId?: string;
};

export type InventoryAdjustmentOptions = {
  channel?: "online" | "pos";
  locationId?: string;
};

export class InsufficientStockError extends Error {
  public readonly line: InventoryAdjustmentLine;
  public readonly channel: InventoryAdjustmentOptions["channel"];
  public readonly locationId?: string;

  constructor(params: {
    line: InventoryAdjustmentLine;
    channel?: InventoryAdjustmentOptions["channel"];
    locationId?: string;
  }) {
    super("Insufficient stock");
    this.name = "InsufficientStockError";
    this.line = params.line;
    this.channel = params.channel;
    this.locationId = params.locationId;
  }
}

type ProductModelLike = {
  updateOne?: (
    filter: unknown,
    update: unknown,
    options?: unknown,
  ) => Promise<unknown>;
  findByIdAndUpdate?: (id: unknown, update: unknown) => Promise<unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function readMatchedCount(result: unknown): number | null {
  if (!isPlainObject(result)) return null;
  const matchedCount = result.matchedCount;
  return typeof matchedCount === "number" ? matchedCount : null;
}

async function decrementSingleLine(
  productModel: ProductModelLike,
  line: InventoryAdjustmentLine,
  opts: InventoryAdjustmentOptions,
) {
  if (line.variantId) {
    if (typeof productModel.updateOne !== "function") {
      if (typeof productModel.findByIdAndUpdate !== "function") {
        throw new Error("Product model does not support inventory updates");
      }
      await productModel.findByIdAndUpdate(line.productId, {
        $inc: { stock: -line.quantity },
      });
      return;
    }

    const baseUpdate: Record<string, unknown> = {
      $inc: {
        stock: -line.quantity,
        "variants.$.stock": -line.quantity,
      },
    };

    const isPos =
      opts.channel === "pos" &&
      typeof opts.locationId === "string" &&
      opts.locationId.length > 0;

    // For POS + location inventory, validate against the location quantity.
    // Parent/variant aggregate stock can be stale and should not block sale.
    const filter: Record<string, unknown> = isPos
      ? {
          _id: line.productId,
          variants: {
            $elemMatch: {
              _id: line.variantId,
              locationInventory: {
                $elemMatch: {
                  locationId: opts.locationId,
                  quantity: { $gte: line.quantity },
                },
              },
            },
          },
        }
      : {
          _id: line.productId,
          stock: { $gte: line.quantity },
          variants: {
            $elemMatch: {
              _id: line.variantId,
              stock: { $gte: line.quantity },
            },
          },
        };

    let options: Record<string, unknown> | undefined;
    if (isPos) {
      (baseUpdate.$inc as Record<string, unknown>)[
        "variants.$.locationInventory.$[li].quantity"
      ] = -line.quantity;
      options = {
        arrayFilters: [
          {
            "li.locationId": opts.locationId,
            "li.quantity": { $gte: line.quantity },
          },
        ],
      };
    }

    const result = await productModel.updateOne(filter, baseUpdate, options);
    if (readMatchedCount(result) === 0) {
      throw new InsufficientStockError({
        line,
        channel: opts.channel,
        locationId: opts.locationId,
      });
    }
    return;
  }

  if (typeof productModel.updateOne === "function") {
    const result = await productModel.updateOne(
      { _id: line.productId, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } },
    );
    if (readMatchedCount(result) === 0) {
      throw new InsufficientStockError({
        line,
        channel: opts.channel,
        locationId: opts.locationId,
      });
    }
    return;
  }

  if (typeof productModel.findByIdAndUpdate === "function") {
    await productModel.findByIdAndUpdate(line.productId, {
      $inc: { stock: -line.quantity },
    });
    return;
  }

  throw new Error("Product model does not support inventory updates");
}

/**
 * Decrement inventory for a list of lines. Atomic from the caller's
 * perspective: if any line fails (insufficient stock or otherwise), all
 * previously-decremented lines in the same call are rolled back before the
 * error is re-thrown. Callers can therefore treat the operation as
 * all-or-nothing.
 */
export async function decrementInventory(
  lines: InventoryAdjustmentLine[],
  opts: InventoryAdjustmentOptions = {},
) {
  const productModel = Product as unknown as ProductModelLike;
  const applied: InventoryAdjustmentLine[] = [];

  try {
    for (const line of lines) {
      if (
        !line.productId ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0
      ) {
        continue;
      }
      await decrementSingleLine(productModel, line, opts);
      applied.push(line);
    }
  } catch (err) {
    if (applied.length > 0) {
      await restoreInventory(applied, opts).catch((rollbackErr) => {
        // If rollback itself fails, we surface the original error to the
        // caller (so they don't double-handle InsufficientStockError) but
        // log the rollback failure for operator follow-up.
        console.error(
          "Failed to roll back partial inventory decrement:",
          rollbackErr,
        );
      });
    }
    throw err;
  }

  // Refresh cached storefront product pages so the new stock count is
  // reflected immediately rather than waiting for the 60s revalidate window.
  await invalidateProductCache(applied);
}

/**
 * Restore inventory for cancelled/refunded orders.
 * Increments stock back for each line item.
 */
export async function restoreInventory(
  lines: InventoryAdjustmentLine[],
  opts: InventoryAdjustmentOptions = {},
) {
  const productModel = Product as unknown as ProductModelLike;

  for (const line of lines) {
    if (!line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      continue;
    }

    if (line.variantId) {
      if (typeof productModel.updateOne !== "function") {
        if (typeof productModel.findByIdAndUpdate !== "function") {
          throw new Error("Product model does not support inventory updates");
        }
        await productModel.findByIdAndUpdate(line.productId, {
          $inc: { stock: line.quantity },
        });
        continue;
      }

      const baseUpdate: Record<string, unknown> = {
        $inc: {
          stock: line.quantity,
          "variants.$.stock": line.quantity,
        },
      };

      const isPos = opts.channel === "pos" && typeof opts.locationId === "string" && opts.locationId.length > 0;

      const filter: Record<string, unknown> = {
        _id: line.productId,
        "variants._id": line.variantId,
      };

      let options: Record<string, unknown> | undefined;
      if (isPos) {
        (baseUpdate.$inc as Record<string, unknown>)[
          "variants.$.locationInventory.$[li].quantity"
        ] = line.quantity;
        options = {
          arrayFilters: [{ "li.locationId": opts.locationId }],
        };
      }

      await productModel.updateOne(filter, baseUpdate, options);
      continue;
    }

    if (typeof productModel.updateOne === "function") {
      await productModel.updateOne(
        { _id: line.productId },
        { $inc: { stock: line.quantity } },
      );
    } else if (typeof productModel.findByIdAndUpdate === "function") {
      await productModel.findByIdAndUpdate(line.productId, {
        $inc: { stock: line.quantity },
      });
    } else {
      throw new Error("Product model does not support inventory updates");
    }
  }

  await invalidateProductCache(lines);
}

/**
 * Look up slugs for the given inventory lines and trigger a cache
 * invalidation. Best-effort: failures are logged but never thrown, because
 * cache invalidation must not break order placement / refund flows.
 */
async function invalidateProductCache(
  lines: InventoryAdjustmentLine[],
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
      "Failed to invalidate product cache after inventory change:",
      err,
    );
  }
}
