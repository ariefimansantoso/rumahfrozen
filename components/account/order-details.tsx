"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  Package,
  Truck,
  MapPin,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Loader2,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/providers/currency-provider";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { toast } from "@/components/ui/toast-notification";
import { ORDER_STATUS } from "@/config/app.config";
import { AppImage } from "@/components/ui/app-image";

interface OrderItem {
  productId:
    | string
    | { _id: string; name: string; images?: string[]; slug?: string };
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ShippingAddress {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shipping?: number;
  shippingCost?: number;
  tax: number;
  discount?: number;
  total: number;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

interface ReturnRequest {
  _id: string;
  returnNumber: string;
  status: string;
  refundStatus: string;
  reason: string;
  customerNote?: string;
  estimatedRefund?: {
    total: number;
    currency: string;
  };
  items: Array<{
    orderItemIndex: number;
    name: string;
    quantityRequested: number;
  }>;
  createdAt: string;
}

const ACTIVE_RETURN_STATUSES = new Set([
  "requested",
  "approved",
  "awaiting_shipment",
  "in_transit",
  "received",
  "inspected",
  "refund_pending",
  "partially_refunded",
  "refunded",
]);

interface OrderDetailsProps {
  orderId: string;
  locale: string;
}

export function OrderDetails({ orderId, locale }: OrderDetailsProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const { confirm } = useConfirmation();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [otherReturnReason, setOtherReturnReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const data = await res.json();

        if (data.success) {
          setOrder(data.data);
        } else {
          setError(data.message || "Order not found");
        }
      } catch {
        setError("Failed to load order");
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    async function fetchReturns() {
      try {
        const res = await fetch(`/api/returns?orderId=${orderId}&limit=20`);
        const data = await res.json();
        if (data.success) {
          setReturnRequests(data.data?.data || []);
        }
      } catch {
        // Return history should not block order rendering.
      }
    }

    void fetchReturns();
  }, [orderId]);

  const handleCancelOrder = async () => {
    if (!order) return;

    const confirmed = await confirm({
      title: t("orders.cancelOrderTitle"),
      description: t("orders.cancelOrderDescription"),
      confirmText: t("orders.cancelOrder"),
      cancelText: t("orders.keepOrder"),
      variant: "destructive",
    });

    if (!confirmed) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: ORDER_STATUS.CANCELLED }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(t("orders.orderCancelled"));
        setOrder({ ...order, status: ORDER_STATUS.CANCELLED });
      } else {
        toast.error(data.message || t("orders.orderCancelFailed"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingInvoice(true);
    try {
      const res = await fetch(`/api/orders/${order._id}/invoice`);
      if (!res.ok) throw new Error("Failed to download invoice");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("orders.invoiceDownloadFailed"));
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleReturnQuantityChange = (index: number, value: string) => {
    if (!order) return;
    const parsed = Number(value);
    const max = getReturnableQuantity(index);
    setReturnQuantities((current) => ({
      ...current,
      [index]: Number.isFinite(parsed)
        ? Math.min(max, Math.max(0, parsed))
        : 0,
    }));
  };

  const selectedReturnItemsCount = Object.values(returnQuantities).filter(
    (quantity) => Number(quantity || 0) > 0,
  ).length;
  const selectedReturnReason =
    returnReason === "other" ? otherReturnReason.trim() : returnReason.trim();
  const canSubmitReturn =
    selectedReturnReason.length > 0 &&
    selectedReturnItemsCount > 0 &&
    !isSubmittingReturn;

  const handleSubmitReturn = async () => {
    if (!order) return;

    const items = Object.entries(returnQuantities)
      .map(([index, quantity]) => ({
        orderItemIndex: Number(index),
        quantity: Number(quantity || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      toast.error("Select at least one item to return");
      return;
    }

    if (!selectedReturnReason) {
      toast.error("Select a return reason");
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order._id,
          reason: selectedReturnReason,
          customerNote: returnNote.trim() || undefined,
          items,
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        toast.success("Return request submitted");
        setReturnDialogOpen(false);
        setReturnReason("");
        setOtherReturnReason("");
        setReturnNote("");
        setReturnQuantities({});
        setReturnRequests((current) => [
          ...(Array.isArray(data.data) ? data.data : [data.data]),
          ...current,
        ]);
      } else {
        toast.error(data?.message || data?.error || "Failed to submit return");
      }
    } catch {
      toast.error("Failed to submit return");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      {
        variant: "default" | "secondary" | "outline" | "destructive";
        icon: LucideIcon;
        label: string;
      }
    > = {
      [ORDER_STATUS.PENDING]: {
        variant: "outline",
        icon: Clock,
        label: t("orders.pending"),
      },
      [ORDER_STATUS.PROCESSING]: {
        variant: "secondary",
        icon: Package,
        label: t("orders.processing"),
      },
      [ORDER_STATUS.SHIPPED]: {
        variant: "default",
        icon: Truck,
        label: t("orders.shipped"),
      },
      [ORDER_STATUS.DELIVERED]: {
        variant: "default",
        icon: CheckCircle2,
        label: t("orders.delivered"),
      },
      [ORDER_STATUS.CANCELLED]: {
        variant: "destructive",
        icon: XCircle,
        label: t("orders.cancelled"),
      },
    };
    const {
      variant,
      icon: Icon,
      label,
    } = config[status] || { variant: "outline", icon: Package, label: status };
    return (
      <Badge variant={variant} className="gap-1.5 text-sm py-1 px-3">
        <Icon className="h-4 w-4" />
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return <OrderDetailsSkeleton />;
  }

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-2">
          {error || "Order not found"}
        </h3>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/account/orders`}>
            {t("orders.backToOrders")}
          </Link>
        </Button>
      </div>
    );
  }

  const canCancel = order.status === ORDER_STATUS.PENDING;
  const isReturnEligibleOrder =
    order.status === ORDER_STATUS.DELIVERED &&
    (order.paymentStatus === "paid" ||
      order.paymentStatus === "partially_refunded");
  const shippingAmount = order.shipping ?? order.shippingCost ?? 0;
  const discountAmount = order.discount ?? 0;
  const billingAddress = order.billingAddress || order.shippingAddress;
  const getAddressName = (address: ShippingAddress) =>
    address.fullName ||
    [address.firstName, address.lastName].filter(Boolean).join(" ");
  const returnedQuantityByIndex = returnRequests.reduce<Record<number, number>>(
    (acc, request) => {
      if (!ACTIVE_RETURN_STATUSES.has(request.status)) return acc;
      request.items.forEach((item) => {
        const index = item.orderItemIndex;
        if (typeof index !== "number") return;
        acc[index] = (acc[index] || 0) + Number(item.quantityRequested || 0);
      });
      return acc;
    },
    {},
  );
  function getReturnableQuantity(index: number) {
    const item = order!.items[index];
    return Math.max(
      0,
      Number(item?.quantity || 0) - (returnedQuantityByIndex[index] || 0),
    );
  }
  const canRequestReturn =
    isReturnEligibleOrder &&
    order.items.some((_, index) => getReturnableQuantity(index) > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            {t("orders.placedOn")}{" "}
            {format(new Date(order.createdAt), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(order.status)}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadInvoice}
            disabled={isDownloadingInvoice}
          >
            {isDownloadingInvoice ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t("orders.downloadInvoice")}
          </Button>
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? t("orders.cancelling") : t("orders.cancelOrder")}
            </Button>
          )}
          {canRequestReturn && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReturnDialogOpen(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Request return
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shipping Address */}
        <Card className="gap-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              {t("checkout.shippingAddress")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {getAddressName(order.shippingAddress) ? (
                <p className="font-medium">
                  {getAddressName(order.shippingAddress)}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                {order.shippingAddress.street}
              </p>
              {order.shippingAddress.apartment ? (
                <p className="text-muted-foreground">
                  {order.shippingAddress.apartment}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.postalCode}
              </p>
              <p className="text-muted-foreground">
                {order.shippingAddress.country}
              </p>
              {order.shippingAddress.phone && (
                <p className="text-muted-foreground pt-1">
                  {order.shippingAddress.phone}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card className="gap-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              {t("checkout.billingAddress")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {getAddressName(billingAddress) ? (
                <p className="font-medium">{getAddressName(billingAddress)}</p>
              ) : null}
              <p className="text-muted-foreground">{billingAddress.street}</p>
              {billingAddress.apartment ? (
                <p className="text-muted-foreground">
                  {billingAddress.apartment}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                {billingAddress.city}, {billingAddress.state}{" "}
                {billingAddress.postalCode}
              </p>
              <p className="text-muted-foreground">{billingAddress.country}</p>
              {billingAddress.phone && (
                <p className="text-muted-foreground pt-1">
                  {billingAddress.phone}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card className="gap-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {t("checkout.paymentMethod")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("common.method")}
                </span>
                <span className="capitalize">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("common.status")}
                </span>
                <Badge
                  variant={
                    order.paymentStatus === "paid" ? "default" : "outline"
                  }
                >
                  {order.paymentStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t("orders.orderItems")}</CardTitle>
          <CardDescription>
            {order.items.length} {order.items.length === 1 ? "item" : "items"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item, index) => {
              const productName =
                typeof item.productId === "object"
                  ? item.productId.name
                  : item.name;
              const productSlug =
                typeof item.productId === "object" ? item.productId.slug : null;
              const productImage =
                item.image ||
                (typeof item.productId === "object"
                  ? item.productId.images?.[0]
                  : null);

              return (
                <div key={index} className="flex gap-4">
                  <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {productImage ? (
                      <AppImage
                        src={productImage}
                        alt={productName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {productSlug ? (
                      <Link
                        href={`/${locale}/products/${productSlug}`}
                        className="font-medium hover:underline line-clamp-1"
                      >
                        {productName}
                      </Link>
                    ) : (
                      <p className="font-medium line-clamp-1">{productName}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {t("common.qty")}: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.price)} each
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator className="my-4" />

          {/* Order Summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("common.subtotal")}
              </span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("common.shipping")}
              </span>
              <span>
                {shippingAmount === 0
                  ? t("common.free")
                  : formatPrice(shippingAmount)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("checkout.discount")}
                </span>
                <span className="text-red-600">
                  -{formatPrice(discountAmount)}
                </span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("common.tax")}</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-base font-semibold">
              <span>{t("common.total")}</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {returnRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Return requests</CardTitle>
            <CardDescription>
              Return and refund activity for this order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {returnRequests.map((request) => (
                <div
                  key={request._id}
                  className="rounded-md border p-4 text-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{request.returnNumber}</p>
                      <p className="text-muted-foreground">
                        {request.items
                          .map((item) => `${item.name} x${item.quantityRequested}`)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {request.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {request.refundStatus.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  {request.estimatedRefund ? (
                    <p className="mt-2 text-muted-foreground">
                      Estimated refund: {formatPrice(request.estimatedRefund.total)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={returnDialogOpen}
        onOpenChange={(open) => {
          setReturnDialogOpen(open);
          if (!open) {
            setReturnReason("");
            setOtherReturnReason("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request a return</DialogTitle>
            <DialogDescription>
              Select the items you want to return. The store team will review
              the request before refund processing.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Select
                value={returnReason}
                onValueChange={(value) => {
                  setReturnReason(value);
                  if (value !== "other") setOtherReturnReason("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wrong_size_or_variant">
                    Wrong size or variant
                  </SelectItem>
                  <SelectItem value="damaged_or_defective">
                    Damaged or defective
                  </SelectItem>
                  <SelectItem value="not_as_described">
                    Not as described
                  </SelectItem>
                  <SelectItem value="wrong_item_received">
                    Wrong item received
                  </SelectItem>
                  <SelectItem value="arrived_late">Arrived late</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {returnReason === "other" ? (
                <div className="grid gap-2">
                  <Label htmlFor="other-return-reason">Other reason</Label>
                  <Input
                    id="other-return-reason"
                    value={otherReturnReason}
                    onChange={(event) => setOtherReturnReason(event.target.value)}
                    placeholder="Type your return reason"
                    maxLength={100}
                    required
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3">
              <Label>Items</Label>
              {order.items.map((item, index) => {
                const productName =
                  typeof item.productId === "object"
                    ? item.productId.name
                    : item.name;
                const returnableQuantity = getReturnableQuantity(index);
                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_120px]"
                  >
                    <div>
                      <p className="font-medium">{productName}</p>
                      <p className="text-sm text-muted-foreground">
                        Returnable quantity: {returnableQuantity} of {item.quantity}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor={`return-item-${index}`} className="text-xs">
                        Return qty
                      </Label>
                      <Input
                        id={`return-item-${index}`}
                        type="number"
                        min={0}
                        max={returnableQuantity}
                        value={returnQuantities[index] ?? 0}
                        disabled={returnableQuantity === 0}
                        onChange={(event) =>
                          handleReturnQuantityChange(index, event.target.value)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="return-note">Notes</Label>
              <Textarea
                id="return-note"
                value={returnNote}
                onChange={(event) => setReturnNote(event.target.value)}
                placeholder="Add details for the store team"
                className="min-h-24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
              disabled={isSubmittingReturn}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitReturn()}
              disabled={!canSubmitReturn}
            >
              {isSubmittingReturn ? "Submitting..." : "Submit return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-4 mb-4">
              <Skeleton className="h-16 w-16 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
