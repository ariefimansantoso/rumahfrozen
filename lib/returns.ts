export const RETURN_STATUS = {
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  AWAITING_SHIPMENT: "awaiting_shipment",
  IN_TRANSIT: "in_transit",
  RECEIVED: "received",
  INSPECTED: "inspected",
  REFUND_PENDING: "refund_pending",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
  CLOSED: "closed",
  CANCELLED: "cancelled",
} as const;

export const RETURN_REFUND_STATUS = {
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  MANUAL_REQUIRED: "manual_required",
} as const;

export type ReturnStatus = (typeof RETURN_STATUS)[keyof typeof RETURN_STATUS];
export type ReturnRefundStatus =
  (typeof RETURN_REFUND_STATUS)[keyof typeof RETURN_REFUND_STATUS];

export const OPEN_RETURN_STATUSES: ReturnStatus[] = [
  RETURN_STATUS.REQUESTED,
  RETURN_STATUS.APPROVED,
  RETURN_STATUS.AWAITING_SHIPMENT,
  RETURN_STATUS.IN_TRANSIT,
  RETURN_STATUS.RECEIVED,
  RETURN_STATUS.INSPECTED,
  RETURN_STATUS.REFUND_PENDING,
  RETURN_STATUS.PARTIALLY_REFUNDED,
];

export const RETURN_REASONS = [
  "wrong_size_or_variant",
  "damaged_or_defective",
  "not_as_described",
  "wrong_item_received",
  "arrived_late",
  "other",
] as const;

export function getReturnReasonLabel(value: string) {
  const map: Record<string, string> = {
    wrong_size_or_variant: "Wrong size or variant",
    damaged_or_defective: "Damaged or defective",
    not_as_described: "Not as described",
    wrong_item_received: "Wrong item received",
    arrived_late: "Arrived late",
    other: "Other",
  };
  return map[value] || value;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
