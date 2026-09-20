import { ORDER_STATUS } from "@/config/app.config";

export type OrderStatusValue =
  (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export type OrderStatusActionId =
  | "mark_ready_to_fulfill"
  | "mark_processing"
  | "mark_shipped"
  | "mark_delivered"
  | "cancel_order";

export interface OrderStatusActionDefinition {
  id: OrderStatusActionId;
  to: OrderStatusValue;
  label: string;
  description: string;
  requiresConfirmation?: boolean;
  requiresShipmentDetails?: boolean;
  destructive?: boolean;
}

export const ORDER_STATUS_ACTIONS: Record<
  OrderStatusActionId,
  OrderStatusActionDefinition
> = {
  mark_ready_to_fulfill: {
    id: "mark_ready_to_fulfill",
    to: ORDER_STATUS.PROCESSING,
    label: "Mark ready to fulfill",
    description: "Release the preorder into normal fulfillment.",
  },
  mark_processing: {
    id: "mark_processing",
    to: ORDER_STATUS.PROCESSING,
    label: "Mark as processing",
    description: "Start preparing the order for fulfillment.",
  },
  mark_shipped: {
    id: "mark_shipped",
    to: ORDER_STATUS.SHIPPED,
    label: "Mark as shipped",
    description: "Record shipment details and notify the customer.",
    requiresShipmentDetails: true,
  },
  mark_delivered: {
    id: "mark_delivered",
    to: ORDER_STATUS.DELIVERED,
    label: "Mark as delivered",
    description: "Close fulfillment after delivery is complete.",
  },
  cancel_order: {
    id: "cancel_order",
    to: ORDER_STATUS.CANCELLED,
    label: "Cancel order",
    description: "Cancel the order and restore inventory when possible.",
    requiresConfirmation: true,
    destructive: true,
  },
};

export const ORDER_STATUS_WORKFLOW: Record<
  OrderStatusValue,
  OrderStatusActionId[]
> = {
  [ORDER_STATUS.PREORDERED]: ["mark_ready_to_fulfill", "cancel_order"],
  [ORDER_STATUS.PENDING]: ["mark_processing", "cancel_order"],
  [ORDER_STATUS.PROCESSING]: ["mark_shipped", "cancel_order"],
  [ORDER_STATUS.SHIPPED]: ["mark_delivered"],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

export function getOrderStatusActions(
  status: string,
): OrderStatusActionDefinition[] {
  const actionIds =
    ORDER_STATUS_WORKFLOW[status as OrderStatusValue] ??
    ORDER_STATUS_WORKFLOW[ORDER_STATUS.PENDING];
  return actionIds.map((id) => ORDER_STATUS_ACTIONS[id]);
}

export function getOrderStatusActionByTarget(
  currentStatus: string,
  nextStatus: string,
): OrderStatusActionDefinition | null {
  return (
    getOrderStatusActions(currentStatus).find(
      (action) => action.to === nextStatus,
    ) ?? null
  );
}

export function canTransitionOrderStatus(
  currentStatus: string,
  nextStatus: string,
): boolean {
  return Boolean(getOrderStatusActionByTarget(currentStatus, nextStatus));
}

export function getOrderStatusTimestampUpdates(
  nextStatus: string,
  changedAt = new Date(),
): Record<string, Date> {
  if (nextStatus === ORDER_STATUS.PROCESSING) {
    return { processingAt: changedAt };
  }
  if (nextStatus === ORDER_STATUS.SHIPPED) {
    return { shippedAt: changedAt };
  }
  if (nextStatus === ORDER_STATUS.DELIVERED) {
    return { deliveredAt: changedAt };
  }
  if (nextStatus === ORDER_STATUS.CANCELLED) {
    return { cancelledAt: changedAt };
  }
  return {};
}

export function shouldRestoreInventoryForStatusTransition(
  currentStatus: string,
  nextStatus: string,
) {
  return (
    nextStatus === ORDER_STATUS.CANCELLED &&
    currentStatus !== ORDER_STATUS.CANCELLED
  );
}
