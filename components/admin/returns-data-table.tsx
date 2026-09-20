"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  MoreHorizontal,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast-notification";
import { useCurrency } from "@/providers/currency-provider";

interface AdminReturnRequest {
  _id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId?: { name?: string; email?: string };
  status: string;
  refundStatus: string;
  reason: string;
  customerNote?: string;
  estimatedRefund: {
    total: number;
    currency: string;
  };
  actualRefund?: {
    amount?: number;
  };
  items: Array<{
    name: string;
    quantityRequested: number;
  }>;
  createdAt: string;
}

interface ReturnsDataTableProps {
  locale: string;
  scope?: "admin" | "vendor";
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "rejected" || status === "cancelled") return "destructive";
  if (status === "refunded") return "default";
  if (status === "requested" || status === "refund_pending") return "secondary";
  return "outline";
}

export function ReturnsDataTable({
  locale,
  scope = "admin",
}: ReturnsDataTableProps) {
  const { formatPrice } = useCurrency();
  const [returns, setReturns] = useState<AdminReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionReturn, setActionReturn] = useState<AdminReturnRequest | null>(null);
  const [actionType, setActionType] = useState<"reject" | "refund" | null>(null);
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/${scope}/returns?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReturns(data.data?.data || []);
      } else {
        toast.error(data.message || data.error || "Failed to load returns");
      }
    } catch {
      toast.error("Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, [scope, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchReturns();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fetchReturns]);

  const updateReturn = async (
    id: string,
    payload: Record<string, unknown>,
  ) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/${scope}/returns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast.success("Return updated");
        setReturns((current) =>
          current.map((item) => (item._id === id ? data.data : item)),
        );
        setActionReturn(null);
        setActionType(null);
        setNote("");
        setRefundAmount("");
      } else {
        toast.error(data?.message || data?.error || "Failed to update return");
      }
    } catch {
      toast.error("Failed to update return");
    } finally {
      setUpdating(false);
    }
  };

  const openRefundDialog = (request: AdminReturnRequest) => {
    setActionReturn(request);
    setActionType("refund");
    setRefundAmount(String(request.estimatedRefund?.total || ""));
    setNote("");
  };

  const openRejectDialog = (request: AdminReturnRequest) => {
    setActionReturn(request);
    setActionType("reject");
    setNote("");
  };

  return (
    <>
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Return requests</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search return or order number"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Refund</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      Loading returns...
                    </TableCell>
                  </TableRow>
                ) : returns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      No return requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  returns.map((request) => (
                    <TableRow key={request._id}>
                      <TableCell>
                        <p className="font-medium">{request.returnNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/${locale}/${scope}/orders/${request.orderId}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {request.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p>{request.customerId?.name || "Customer"}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.customerId?.email}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-64">
                        {request.items
                          .map((item) => `${item.name} x${item.quantityRequested}`)
                          .join(", ")}
                      </TableCell>
                      <TableCell>
                        {formatPrice(request.estimatedRefund?.total || 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusVariant(request.status)} className="w-fit capitalize">
                            {request.status.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground capitalize">
                            {request.refundStatus.replace(/_/g, " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/${scope}/orders/${request.orderId}`}>
                                  <Eye className="h-4 w-4" />
                                  View order
                                </Link>
                              </DropdownMenuItem>
                              {request.status === "requested" ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void updateReturn(request._id, {
                                        status: "approved",
                                      })
                                    }
                                    disabled={updating}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Approve request
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openRejectDialog(request)}
                                    disabled={updating}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Reject request
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              {["approved", "in_transit"].includes(request.status) ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void updateReturn(request._id, {
                                        status: "received",
                                      })
                                    }
                                    disabled={updating}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark received
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              {[
                                "approved",
                                "received",
                                "inspected",
                                "refund_pending",
                              ].includes(request.status) ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openRefundDialog(request)}
                                    disabled={updating}
                                  >
                                    <RefreshCcw className="h-4 w-4" />
                                    Issue refund
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(actionReturn && actionType)}
        onOpenChange={(open) => {
          if (!open) {
            setActionReturn(null);
            setActionType(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "refund" ? "Issue refund" : "Reject return"}
            </DialogTitle>
            <DialogDescription>
              {actionReturn?.returnNumber} for order {actionReturn?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {actionType === "refund" ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="refund-amount">Refund amount</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="refund-note">Reason</Label>
                <Textarea
                  id="refund-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional refund note"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2 py-2">
              <Label htmlFor="reject-note">Reason</Label>
              <Textarea
                id="reject-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Explain why this return cannot be accepted"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionReturn(null);
                setActionType(null);
              }}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "reject" ? "destructive" : "default"}
              disabled={updating || !actionReturn}
              onClick={() => {
                if (!actionReturn) return;
                if (actionType === "refund") {
                  void updateReturn(actionReturn._id, {
                    status: "refunded",
                    refundAmount: Number(refundAmount),
                    refundReason: note.trim() || undefined,
                  });
                  return;
                }
                void updateReturn(actionReturn._id, {
                  status: "rejected",
                  rejectionReason: note.trim() || undefined,
                });
              }}
            >
              {updating
                ? "Working..."
                : actionType === "refund"
                  ? "Issue refund"
                  : "Reject return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
