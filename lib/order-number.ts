import { Order, getNextSequence } from "@/models";
import { normalizeOrderPrefix } from "@/lib/order-settings";

const ONLINE_COUNTER_KEY_PREFIX = "online_order:";
const POS_COUNTER_KEY_PREFIX = "pos_order:";

/**
 * Read the highest existing online order number for the configured prefix and
 * return it as a number. Used to seed the online-order counter on the first
 * call so a fresh counter doesn't collide with pre-existing orders.
 */
async function readMaxOnlineOrderSequence(prefix: string): Promise<number> {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\d+$`);
  const top = await Order.findOne({ orderNumber: pattern })
    .sort({ orderNumber: -1 })
    .select({ orderNumber: 1 })
    .lean();
  if (!top?.orderNumber) return 0;
  const match = String(top.orderNumber).match(new RegExp(`^${escaped}(\\d+)$`));
  return match ? parseInt(match[1], 10) || 0 : 0;
}

/**
 * Read the highest existing POS order number for a given prefix.
 */
async function readMaxPosOrderSequence(prefix: string): Promise<number> {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const top = await Order.findOne({
    orderNumber: new RegExp(`^${escaped}\\d+$`),
  })
    .sort({ orderNumber: -1 })
    .select({ orderNumber: 1 })
    .lean();
  if (!top?.orderNumber) return 0;
  const match = String(top.orderNumber).match(
    new RegExp(`^${escaped}(\\d+)$`),
  );
  return match ? parseInt(match[1], 10) || 0 : 0;
}

/**
 * Generate the next online order number atomically. Format: <PREFIX>000001.
 * On first call for a prefix, seed from the highest matching existing order.
 */
export async function getNextOnlineOrderNumber(prefix = "ORD"): Promise<string> {
  const normalized = normalizeOrderPrefix(prefix);
  const seq = await getNextSequence(
    `${ONLINE_COUNTER_KEY_PREFIX}${normalized}`,
    () => readMaxOnlineOrderSequence(normalized),
  );
  return `${normalized}${String(seq).padStart(6, "0")}`;
}

/**
 * Generate the next POS order number atomically for the given prefix.
 * Format: <PREFIX>000001. On first call (no counter document yet), seeds
 * from max(existing prefix#).
 */
export async function getNextPosOrderNumber(prefix: string): Promise<string> {
  const normalized = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "POS";
  const seq = await getNextSequence(
    `${POS_COUNTER_KEY_PREFIX}${normalized}`,
    () => readMaxPosOrderSequence(normalized),
  );
  return `${normalized}${String(seq).padStart(6, "0")}`;
}
