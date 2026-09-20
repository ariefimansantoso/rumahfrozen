import { Product } from "@/models";

export type TransferLifecycleStatus =
  | "draft"
  | "ready_to_ship"
  | "in_transit"
  | "completed"
  | "cancelled";

export type TransferLine = {
  productId: string;
  variantId: string;
  quantity: number;
};

export const TRANSFER_STATUS_ORDER: TransferLifecycleStatus[] = [
  "draft",
  "ready_to_ship",
  "in_transit",
  "completed",
  "cancelled",
];

const ALLOWED_TRANSITIONS: Record<
  TransferLifecycleStatus,
  TransferLifecycleStatus[]
> = {
  draft: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["in_transit", "cancelled"],
  in_transit: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionTransferStatus(
  currentStatus: TransferLifecycleStatus,
  nextStatus: TransferLifecycleStatus,
) {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export async function generateTransferNumber() {
  const seed = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 90 + 10);
  return `TR-${seed}${random}`;
}

export async function applyTransferInventory(params: {
  fromLocationId: string;
  toLocationId: string;
  items: TransferLine[];
}) {
  const grouped = new Map<string, TransferLine[]>();

  for (const item of params.items) {
    if (!grouped.has(item.productId)) {
      grouped.set(item.productId, []);
    }
    grouped.get(item.productId)!.push(item);
  }

  for (const [productId, lines] of grouped) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found while completing transfer");
    }

    for (const line of lines) {
      const variantIndex = Array.isArray(product.variants)
        ? product.variants.findIndex(
            (variant: { _id?: { toString: () => string } }) =>
              String(variant._id) === String(line.variantId),
          )
        : -1;

      if (variantIndex < 0) {
        throw new Error("Variant not found while completing transfer");
      }

      const variant = product.variants[variantIndex] as {
        stock?: number;
        inventory?: { quantity?: number };
        locationInventory?: Array<{ locationId: string; quantity: number }>;
      };

      variant.locationInventory = Array.isArray(variant.locationInventory)
        ? variant.locationInventory
        : [];

      const fromEntry = variant.locationInventory.find(
        (entry) => String(entry.locationId) === params.fromLocationId,
      );

      if (!fromEntry || (fromEntry.quantity || 0) < line.quantity) {
        throw new Error(
          "Insufficient source location stock for one or more transfer items",
        );
      }

      const toEntry = variant.locationInventory.find(
        (entry) => String(entry.locationId) === params.toLocationId,
      );

      fromEntry.quantity = Math.max(0, (fromEntry.quantity || 0) - line.quantity);

      if (toEntry) {
        toEntry.quantity = (toEntry.quantity || 0) + line.quantity;
      } else {
        variant.locationInventory.push({
          locationId: params.toLocationId,
          quantity: line.quantity,
        });
      }

      const updatedTotal = variant.locationInventory.reduce(
        (sum, entry) => sum + Math.max(0, entry.quantity || 0),
        0,
      );

      variant.stock = updatedTotal;
      if (variant.inventory) {
        variant.inventory.quantity = updatedTotal;
      }
    }

    await product.save();
  }
}
