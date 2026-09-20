"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import {
  MoreHorizontal,
  Printer,
  Download,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  PackageCheck,
  Loader2,
  Truck,
  ArrowLeft,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputDialog,
  type InputDialogField,
  type InputDialogValues,
} from "@/components/ui/input-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useCurrency } from "@/providers/currency-provider";
import { IOrder } from "@/types";
import {
  getOrderStatusActions,
  type OrderStatusActionDefinition,
} from "@/lib/order-status-workflow";
import { apiClient } from "@/lib/api/client";
import {
  getSavedThermalPrinterName,
  printPdfBlobWithQz,
} from "@/lib/printing/qz-client";

interface OrderReturnRequest {
  _id: string;
  returnNumber: string;
  status: string;
  refundStatus?: string;
}

interface OrderHeaderProps {
  order: IOrder;
  locale: string;
  readOnly?: boolean;
  canRefund?: boolean;
}

export function OrderHeader({
  order,
  readOnly,
  canRefund = false,
}: OrderHeaderProps) {
  const t = useTranslations("admin");
  const tRoot = useTranslations();
  const router = useRouter();
  const { confirm } = useConfirmation();
  const { formatPrice } = useCurrency();
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [refundDialogKind, setRefundDialogKind] = useState<
    "full" | "partial" | null
  >(null);
  const [refundValues, setRefundValues] = useState<InputDialogValues>({
    amount: "",
    reason: "",
  });
  const [refundErrors, setRefundErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [returnRequests, setReturnRequests] = useState<OrderReturnRequest[]>(
    [],
  );
  const [trackingNumber, setTrackingNumber] = useState(
    order.trackingNumber || "",
  );
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [cancelReason, setCancelReason] = useState(order.cancelReason || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isDownloadingShippingLabel, setIsDownloadingShippingLabel] = useState(false);

  const fetchReturnRequests = async () => {
    try {
      const params = new URLSearchParams({
        orderId: String(order._id),
        limit: "20",
      });
      const data = await apiClient.get<{ data?: OrderReturnRequest[] }>(
        `/api/admin/returns?${params.toString()}`,
      );
      setReturnRequests(data?.data || []);
    } catch {
      setReturnRequests([]);
    }
  };

  useEffect(() => {
    let isActive = true;
    const params = new URLSearchParams({
      orderId: String(order._id),
      limit: "20",
    });

    apiClient
      .get<{ data?: OrderReturnRequest[] }>(
        `/api/admin/returns?${params.toString()}`,
      )
      .then((data) => {
        if (isActive) setReturnRequests(data?.data || []);
      })
      .catch(() => {
        if (isActive) setReturnRequests([]);
      });

    return () => {
      isActive = false;
    };
  }, [order._id]);

  const handleStatusUpdate = async (
    status: string,
    payload: Record<string, string | undefined> = {},
  ) => {
    setIsUpdating(true);
    try {
      await apiClient.put(`/api/admin/orders/${order._id}`, {
        status,
        ...payload,
      });
      toast.success(tRoot("orders.orderUpdated"));
      router.refresh();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : tRoot("orders.orderUpdateFailed"),
      );
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsPaid = async () => {
    const confirmed = await confirm({
      type: "question",
      title: t("orderDetails.markAsPaid"),
      description: t("orderDetails.markAsPaidConfirm"),
      confirmText: t("orderDetails.markAsPaid"),
      cancelText: t("orderDetails.cancel"),
    });
    if (!confirmed) return;
    setIsUpdating(true);
    try {
      await apiClient.put(`/api/admin/orders/${order._id}`, {
        paymentStatus: "paid",
      });
      toast.success(t("orderDetails.markAsPaidSuccess"));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : tRoot("orders.orderUpdateFailed"),
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusAction = (action: OrderStatusActionDefinition) => {
    if (action.to === "shipped") {
      setShipDialogOpen(true);
      return;
    }
    if (action.to === "cancelled") {
      setCancelDialogOpen(true);
      return;
    }
    void handleStatusUpdate(action.to);
  };

  const getActionIcon = (actionId: string) => {
    if (actionId === "mark_processing") return <Package className="h-4 w-4" />;
    if (actionId === "mark_shipped") return <Truck className="h-4 w-4" />;
    if (actionId === "mark_delivered")
      return <CheckCircle className="h-4 w-4" />;
    return <XCircle className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        icon: LucideIcon;
      }
    > = {
      pending: { variant: "secondary", icon: Clock },
      preordered: { variant: "outline", icon: Package },
      processing: { variant: "default", icon: Package },
      shipped: { variant: "outline", icon: Truck },
      delivered: { variant: "default", icon: CheckCircle },
      cancelled: { variant: "destructive", icon: XCircle },
    };
    const labels: Record<string, string> = {
      pending: t("orderDetails.orderStatus.pending"),
      preordered: t.has("orderDetails.orderStatus.preordered")
        ? t("orderDetails.orderStatus.preordered")
        : "Pre-ordered",
      processing: t("orderDetails.orderStatus.processing"),
      shipped: t("orderDetails.orderStatus.shipped"),
      delivered: t("orderDetails.orderStatus.delivered"),
      cancelled: t("orderDetails.orderStatus.cancelled"),
    };
    const { variant, icon: Icon } = config[status] || config.pending;
    return (
      <Badge
        variant={variant}
        className="gap-1 px-3 py-1 text-sm font-medium capitalize"
      >
        <Icon className="h-3.5 w-3.5" />
        {labels[status] || status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getPaymentBadge = (status: string) => {
    const config: Record<
      string,
      {
        variant:
          | "default"
          | "secondary"
          | "destructive"
          | "outline"
          | "success";
      }
    > = {
      paid: { variant: "success" },
      pending: { variant: "secondary" },
      partially_paid: { variant: "outline" },
      refunded: { variant: "outline" },
      partially_refunded: { variant: "outline" },
    };
    const { variant } = config[status] || { variant: "secondary" };

    return (
      <Badge
        variant={variant === "success" ? "default" : variant}
        className={status === "paid" ? "bg-green-600 hover:bg-green-700" : ""}
      >
        {t(`orderDetails.paymentStatus.${status}`)}
      </Badge>
    );
  };

  const getReturnStatusVariant = (
    status: string,
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "rejected" || status === "cancelled") {
      return "destructive";
    }
    if (status === "received" || status === "refunded") {
      return "default";
    }
    if (status === "requested" || status === "refund_pending") {
      return "secondary";
    }
    return "outline";
  };

  const getReturnStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      requested: t("orderDetails.returnStatus.requested"),
      approved: t("orderDetails.returnStatus.approved"),
      rejected: t("orderDetails.returnStatus.rejected"),
      awaiting_shipment: t("orderDetails.returnStatus.awaitingShipment"),
      in_transit: t("orderDetails.returnStatus.inTransit"),
      received: t("orderDetails.returnStatus.received"),
      inspected: t("orderDetails.returnStatus.inspected"),
      refund_pending: t("orderDetails.returnStatus.refundPending"),
      refunded: t("orderDetails.returnStatus.refunded"),
      partially_refunded: t("orderDetails.returnStatus.partiallyRefunded"),
      closed: t("orderDetails.returnStatus.closed"),
      cancelled: t("orderDetails.returnStatus.cancelled"),
    };

    return labels[status] || status.replace(/_/g, " ");
  };

  const getReturnRefundStatusLabel = (status?: string) => {
    if (!status || status === "not_required") return null;

    const labels: Record<string, string> = {
      pending: t("orderDetails.returnRefundStatus.pending"),
      processing: t("orderDetails.returnRefundStatus.processing"),
      succeeded: t("orderDetails.returnRefundStatus.succeeded"),
      failed: t("orderDetails.returnRefundStatus.failed"),
      manual_required: t("orderDetails.returnRefundStatus.manualRequired"),
    };

    return labels[status] || status.replace(/_/g, " ");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadInvoice = async () => {
    setIsDownloadingInvoice(true);
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/invoice`);
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
      toast.error(t("orderDetails.invoiceDownloadFailed"));
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const ensureShippingLabel = async (download = true) => {
    setIsDownloadingShippingLabel(true);
    try {
      await apiClient.post(`/api/admin/orders/${order._id}/shipments`, {
        carrier: carrier.trim() || order.carrier || undefined,
        trackingNumber:
          trackingNumber.trim() || order.trackingNumber || order.orderNumber,
      });
      if (download) {
        const response = await fetch(
          `/api/admin/orders/${order._id}/shipping-label`,
        );
        if (!response.ok) throw new Error("Failed to generate shipping label");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `shipping-label-${order.orderNumber}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      }
      toast.success(download ? "Shipping label downloaded" : "Shipping label created");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create shipping label",
      );
      return false;
    } finally {
      setIsDownloadingShippingLabel(false);
    }
  };

  const printShippingLabelDirect = async () => {
    setIsDownloadingShippingLabel(true);
    try {
      await apiClient.post(`/api/admin/orders/${order._id}/shipments`, {
        carrier: carrier.trim() || order.carrier || undefined,
        trackingNumber:
          trackingNumber.trim() || order.trackingNumber || order.orderNumber,
      });
      const response = await fetch(
        `/api/admin/orders/${order._id}/shipping-label`,
      );
      if (!response.ok) throw new Error("Failed to generate shipping label");
      await printPdfBlobWithQz(
        getSavedThermalPrinterName(),
        await response.blob(),
        { widthIn: 4, heightIn: 6 },
      );
      toast.success("4 × 6 shipping label sent to thermal printer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to print shipping label",
      );
    } finally {
      setIsDownloadingShippingLabel(false);
    }
  };

  const openRefundDialog = (kind: "full" | "partial") => {
    const orderTotal = Number(order.total || 0);
    const currentStatus = String(order.paymentStatus || "").toLowerCase();
    if (currentStatus !== "paid" && currentStatus !== "partially_refunded") {
      toast.error(t("orderDetails.refundNotAvailable"));
      return;
    }

    setRefundValues({
      amount: kind === "partial" ? "" : orderTotal.toFixed(2),
      reason: "",
    });
    setRefundErrors({});
    setRefundDialogKind(kind);
  };

  const handleRefundSubmit = async (values: InputDialogValues) => {
    if (!refundDialogKind) return;

    const orderTotal = Number(order.total || 0);
    const amount =
      refundDialogKind === "full" ? orderTotal : Number(values.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundErrors({ amount: t("orderDetails.invalidRefundAmount") });
      return;
    }

    setRefundErrors({});
    setIsUpdating(true);

    try {
      const returnRequestForRefund = returnRequests.find((request) =>
        ["approved", "received", "inspected", "refund_pending"].includes(
          request.status,
        ),
      );
      await apiClient.put(
        returnRequestForRefund
          ? `/api/admin/returns/${returnRequestForRefund._id}`
          : `/api/admin/orders/${order._id}`,
        returnRequestForRefund
          ? {
              status: "refunded",
              refundAmount: amount,
              refundReason: values.reason.trim() || undefined,
            }
          : {
              paymentStatus:
                refundDialogKind === "full"
                  ? "refunded"
                  : "partially_refunded",
              refundAmount: amount,
              refundReason: values.reason.trim() || undefined,
            },
      );

      toast.success(t("orderDetails.refundRecorded"));
      setRefundDialogKind(null);
      await fetchReturnRequests();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("orderDetails.refundFailed"),
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReturnStatusUpdate = async (
    request: OrderReturnRequest,
    status: "approved" | "received",
  ) => {
    setIsUpdating(true);
    try {
      await apiClient.put(`/api/admin/returns/${request._id}`, { status });
      toast.success(t("orderDetails.returnRequestUpdated"));
      await fetchReturnRequests();
      router.refresh();
    } catch {
      toast.error(t("orderDetails.returnRequestUpdateFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  const refundFields: InputDialogField[] =
    refundDialogKind === "partial"
      ? [
          {
            name: "amount",
            label: t("orderDetails.enterRefundAmount"),
            type: "number",
            inputMode: "decimal",
            min: "0.01",
            step: "0.01",
            required: true,
          },
          {
            name: "reason",
            label: t("orderDetails.refundReasonOptional"),
            multiline: true,
            rows: 3,
          },
        ]
      : [
          {
            name: "reason",
            label: t("orderDetails.refundReasonOptional"),
            multiline: true,
            rows: 3,
          },
        ];

  const statusActions = getOrderStatusActions(order.status);
  const approvableReturnRequests = returnRequests.filter(
    (request) => request.status === "requested",
  );
  const receivableReturnRequests = returnRequests.filter((request) =>
    ["approved", "in_transit"].includes(request.status),
  );
  const canShowReturnActions =
    !readOnly &&
    (approvableReturnRequests.length > 0 ||
      receivableReturnRequests.length > 0);
  const canShowRefundActions =
    canRefund &&
    (order.paymentStatus === "paid" ||
      order.paymentStatus === "partially_refunded");
  const canMarkPaid =
    !readOnly &&
    order.status !== "cancelled" &&
    (order.paymentStatus === "pending" ||
      order.paymentStatus === "partially_paid");

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("orderDetails.orderNumber", { number: order.orderNumber })}
            </h1>
            {getPaymentBadge(order.paymentStatus)}
            {getStatusBadge(order.status)}
          </div>
          <p className="text-muted-foreground mt-1">
            {t("orderDetails.placedOn")}{" "}
            {format(new Date(order.createdAt), "MMMM d, yyyy, h:mm a")}
          </p>
          {order.trackingNumber ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("orderDetails.tracking")} {order.trackingNumber}
              {order.carrier ? ` · ${order.carrier}` : ""}
            </p>
          ) : null}
          {returnRequests.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("orderDetails.returnRequests")}
              </span>
              {returnRequests.map((request) => {
                const refundStatusLabel = getReturnRefundStatusLabel(
                  request.refundStatus,
                );

                return (
                  <Badge
                    key={request._id}
                    variant={getReturnStatusVariant(request.status)}
                    className="gap-1.5 capitalize"
                  >
                    <span>{request.returnNumber}</span>
                    <span>{getReturnStatusLabel(request.status)}</span>
                    {refundStatusLabel ? (
                      <span className="border-l border-current/30 pl-1.5">
                        {refundStatusLabel}
                      </span>
                    ) : null}
                  </Badge>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            {t("orderDetails.print")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadInvoice()}
            disabled={isDownloadingInvoice}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("orderDetails.downloadInvoice")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void ensureShippingLabel(true)}
            disabled={isDownloadingShippingLabel}
          >
            {isDownloadingShippingLabel ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PackageCheck className="mr-2 h-4 w-4" />
            )}
            Shipping label
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void printShippingLabelDirect()}
            disabled={isDownloadingShippingLabel}
            title="Print the 4 × 6 PDF with the saved QZ thermal printer"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print 4 × 6
          </Button>
          {!readOnly &&
          (statusActions.length > 0 ||
            canShowReturnActions ||
            canShowRefundActions ||
            canMarkPaid) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{t("orderDetails.moreActions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusActions.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    className={
                      action.destructive ? "text-destructive" : undefined
                    }
                    onClick={() => handleStatusAction(action)}
                  >
                    {getActionIcon(action.id)}
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {canMarkPaid && (
                  <>
                    {statusActions.length > 0 ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    <DropdownMenuItem
                      onClick={() => void handleMarkAsPaid()}
                    >
                      <CircleDollarSign className="h-4 w-4" />
                      {t("orderDetails.markAsPaid")}
                    </DropdownMenuItem>
                  </>
                )}
                {canShowRefundActions && (
                  <>
                    {(statusActions.length > 0 || canMarkPaid) ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {approvableReturnRequests.map((request) => (
                      <DropdownMenuItem
                        key={`approve-return-${request._id}`}
                        disabled={isUpdating}
                        onClick={() =>
                          void handleReturnStatusUpdate(request, "approved")
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("orderDetails.returnRequestApprovedAction")}
                      </DropdownMenuItem>
                    ))}
                    {receivableReturnRequests.map((request) => (
                      <DropdownMenuItem
                        key={`receive-return-${request._id}`}
                        disabled={isUpdating}
                        onClick={() =>
                          void handleReturnStatusUpdate(request, "received")
                        }
                      >
                        <PackageCheck className="h-4 w-4" />
                        {t("orderDetails.returnRequestReceivedAction")}
                      </DropdownMenuItem>
                    ))}
                    {canShowReturnActions ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem onClick={() => openRefundDialog("full")}>
                      {t("orderDetails.refundFull")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openRefundDialog("partial")}
                    >
                      {t("orderDetails.refundPartial")}
                    </DropdownMenuItem>
                  </>
                )}
                {!canShowRefundActions && canShowReturnActions && (
                  <>
                    {(statusActions.length > 0 || canMarkPaid) ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {approvableReturnRequests.map((request) => (
                      <DropdownMenuItem
                        key={`approve-return-${request._id}`}
                        disabled={isUpdating}
                        onClick={() =>
                          void handleReturnStatusUpdate(request, "approved")
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("orderDetails.returnRequestApprovedAction")}
                      </DropdownMenuItem>
                    ))}
                    {receivableReturnRequests.map((request) => (
                      <DropdownMenuItem
                        key={`receive-return-${request._id}`}
                        disabled={isUpdating}
                        onClick={() =>
                          void handleReturnStatusUpdate(request, "received")
                        }
                      >
                        <PackageCheck className="h-4 w-4" />
                        {t("orderDetails.returnRequestReceivedAction")}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("orderDetails.back")}
          </Button>
        </div>
      </div>

      <InputDialog
        open={refundDialogKind !== null}
        onOpenChange={(open) => {
          if (!open) setRefundDialogKind(null);
        }}
        title={
          refundDialogKind === "partial"
            ? t("orderDetails.refundPartial")
            : t("orderDetails.refundFull")
        }
        description={
          refundDialogKind === "full"
            ? `${t("orderDetails.totalLabel")}: ${formatPrice(order.total)}`
            : undefined
        }
        fields={refundFields}
        values={refundValues}
        onValuesChange={(values) => {
          setRefundValues(values);
          if (Object.keys(refundErrors).length > 0) setRefundErrors({});
        }}
        onSubmit={handleRefundSubmit}
        submitText={tRoot("common.confirm")}
        cancelText={t("orderDetails.cancel")}
        loading={isUpdating}
        errors={refundErrors}
      />

      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orderDetails.markShipped")}</DialogTitle>
            <DialogDescription>
              {t("orderDetails.markShippedDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="detail-order-carrier">{t("orderDetails.carrier")}</Label>
              <Input
                id="detail-order-carrier"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
                placeholder={t("orderDetails.carrierPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-order-tracking-number">
                {t("orderDetails.trackingNumber")}
              </Label>
              <Input
                id="detail-order-tracking-number"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder={t("orderDetails.trackingNumberPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShipDialogOpen(false)}
              disabled={isUpdating}
            >
              {t("orderDetails.cancel")}
            </Button>
            <Button
              type="button"
              disabled={isUpdating}
              onClick={() => {
                void handleStatusUpdate("shipped", {
                  trackingNumber: trackingNumber.trim() || undefined,
                  carrier: carrier.trim() || undefined,
                }).then(async (ok) => {
                  if (ok) {
                    await ensureShippingLabel(false);
                    setShipDialogOpen(false);
                  }
                });
              }}
            >
              {t("orderDetails.markShipped")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orderDetails.cancelOrderTitle")}</DialogTitle>
            <DialogDescription>
              {t("orderDetails.cancelOrderDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="detail-order-cancel-reason">{t("orderDetails.reason")}</Label>
            <Textarea
              id="detail-order-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder={t("orderDetails.cancelReasonPlaceholder")}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isUpdating}
            >
              {t("orderDetails.keepOrder")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isUpdating}
              onClick={() => {
                void handleStatusUpdate("cancelled", {
                  cancelReason: cancelReason.trim() || undefined,
                }).then((ok) => {
                  if (ok) setCancelDialogOpen(false);
                });
              }}
            >
              {t("orderDetails.cancelOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
