import { Types } from "mongoose";
import { Order } from "@/models";
import {
  restoreInventory,
  type InventoryAdjustmentLine,
  type InventoryAdjustmentOptions,
} from "@/lib/inventory";

type SubOrderItem = {
  productId: unknown;
  variantId?: unknown;
  quantity: number;
};

type SubOrderShape = {
  _id?: unknown;
  vendorId?: unknown;
  items?: SubOrderItem[];
  inventoryReserved?: boolean;
};

function itemsToInventoryLines(
  items: SubOrderItem[] | undefined,
): InventoryAdjustmentLine[] {
  return (items || [])
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => ({
      productId: String(
        (item.productId as { _id?: unknown })?._id || item.productId,
      ),
      variantId: item.variantId ? String(item.variantId) : undefined,
      quantity: Number(item.quantity),
    }));
}

function getInventoryOpts(order: {
  channel?: string;
  posLocationId?: unknown;
}): InventoryAdjustmentOptions {
  if (order.channel === "pos" && order.posLocationId) {
    return { channel: "pos", locationId: String(order.posLocationId) };
  }
  return {};
}

/**
 * Mark every sub-order on the order as having stock reserved. Call after
 * a successful decrementInventory for the entire order so cancel/refund
 * paths know there is something to restore.
 */
export async function markOrderInventoryReserved(orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) return;
  await Order.updateOne(
    { _id: orderId },
    { $set: { "subOrders.$[].inventoryReserved": true } },
  );
}

/**
 * Atomically claim the right to restore inventory for a single sub-order.
 * Returns the items to restore (already in inventory-line shape) if this
 * caller won the claim, or null if the sub-order was already restored or
 * never reserved. Callers MUST call restoreInventory for the returned
 * items themselves; this helper only flips the flag.
 */
export async function claimSubOrderRestore(params: {
  orderId: string;
  vendorId: string;
}): Promise<{
  lines: InventoryAdjustmentLine[];
  opts: InventoryAdjustmentOptions;
} | null> {
  if (!Types.ObjectId.isValid(params.orderId)) return null;

  // Atomically flip the matching sub-order's reservation flag from
  // true -> false. Use arrayFilters so we only touch the one sub-order
  // that is still reserved for this vendor.
  const updated = await Order.findOneAndUpdate(
    {
      _id: params.orderId,
      subOrders: {
        $elemMatch: {
          vendorId: new Types.ObjectId(params.vendorId),
          inventoryReserved: true,
        },
      },
    },
    { $set: { "subOrders.$[so].inventoryReserved": false } },
    {
      new: false,
      arrayFilters: [
        {
          "so.vendorId": new Types.ObjectId(params.vendorId),
          "so.inventoryReserved": true,
        },
      ],
    },
  );

  if (!updated) return null;

  const subOrders = (updated.subOrders || []) as SubOrderShape[];
  const sub = subOrders.find(
    (so) =>
      so.vendorId &&
      String((so.vendorId as { _id?: unknown })?._id || so.vendorId) ===
        params.vendorId,
  );
  if (!sub) return null;

  return {
    lines: itemsToInventoryLines(sub.items),
    opts: getInventoryOpts(updated as { channel?: string; posLocationId?: unknown }),
  };
}

/**
 * Atomically claim the right to restore inventory for ALL still-reserved
 * sub-orders on the given order. Returns the union of items to restore
 * across the claimed sub-orders. Used by full-cancel paths.
 *
 * Idempotent: if no sub-orders are currently reserved, returns an empty
 * lines array — no double-restore is possible.
 */
export async function claimAllRemainingRestores(
  orderId: string,
): Promise<{
  lines: InventoryAdjustmentLine[];
  opts: InventoryAdjustmentOptions;
}> {
  if (!Types.ObjectId.isValid(orderId)) {
    return { lines: [], opts: {} };
  }

  // Atomically flip all reserved sub-orders to false in a single update.
  const updated = await Order.findOneAndUpdate(
    {
      _id: orderId,
      "subOrders.inventoryReserved": true,
    },
    { $set: { "subOrders.$[so].inventoryReserved": false } },
    {
      new: false,
      arrayFilters: [{ "so.inventoryReserved": true }],
    },
  );

  if (!updated) return { lines: [], opts: {} };

  const subOrders = (updated.subOrders || []) as SubOrderShape[];
  const lines: InventoryAdjustmentLine[] = [];
  for (const sub of subOrders) {
    if (sub.inventoryReserved) {
      lines.push(...itemsToInventoryLines(sub.items));
    }
  }

  return {
    lines,
    opts: getInventoryOpts(updated as { channel?: string; posLocationId?: unknown }),
  };
}

/**
 * Convenience wrapper that claims and restores in one call.
 * Returns true if any inventory was actually restored.
 */
export async function restoreOrderInventory(orderId: string): Promise<boolean> {
  const { lines, opts } = await claimAllRemainingRestores(orderId);
  if (lines.length === 0) return false;
  await restoreInventory(lines, opts);
  return true;
}

/**
 * Convenience wrapper for the vendor partial-cancel case.
 */
export async function restoreSubOrderInventory(params: {
  orderId: string;
  vendorId: string;
}): Promise<boolean> {
  const claim = await claimSubOrderRestore(params);
  if (!claim || claim.lines.length === 0) return false;
  await restoreInventory(claim.lines, claim.opts);
  return true;
}
