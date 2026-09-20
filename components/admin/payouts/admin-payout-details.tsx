"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast-notification";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/money";

type PayoutDetailsPayload = {
  payout: {
    _id: string;
    payoutNumber: string;
    status: string;
    currency: string;
    grossSales: number;
    commissionAmount: number;
    netAmount: number;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
    paidAt?: string;
    note?: string;
    vendorId?: { storeName?: string; slug?: string };
  };
  orders: Array<{
    _id: string;
    orderNumber: string;
    total: number;
    paymentStatus: string;
    status: string;
    createdAt: string;
  }>;
};

export function AdminPayoutDetails({
  locale,
  payoutId,
}: {
  locale: string;
  payoutId: string;
}) {
  const [data, setData] = useState<PayoutDetailsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("pending");
  const [note, setNote] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to load payout");
      }
      setData(json.data as PayoutDetailsPayload);
      setStatus(json.data?.payout?.status || "pending");
      setNote(json.data?.payout?.note || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load payout");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [payoutId]);

  const updatePayout = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to update payout");
      }
      toast.success("Payout updated.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update payout");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading payout details...</p>;
  }

  if (!data) {
    return <p className="text-muted-foreground">Payout not found.</p>;
  }

  const payout = data.payout;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{payout.payoutNumber}</h1>
          <p className="text-muted-foreground">
            Vendor: {payout.vendorId?.storeName || "-"}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {payout.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Gross Sales" value={formatCurrency(payout.grossSales, payout.currency)} />
        <Metric
          title="Commission"
          value={formatCurrency(payout.commissionAmount, payout.currency)}
        />
        <Metric title="Net Payout" value={formatCurrency(payout.netAmount, payout.currency)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Input
              className="md:col-span-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>
          <Button onClick={() => void updatePayout()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders in This Payout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Order Status</th>
                  <th className="py-2 pr-4">Payment Status</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-0">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order._id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{order.orderNumber}</td>
                    <td className="py-2 pr-4 capitalize">{order.status}</td>
                    <td className="py-2 pr-4 capitalize">{order.paymentStatus}</td>
                    <td className="py-2 pr-4">
                      {formatCurrency(order.total, payout.currency || "USD")}
                    </td>
                    <td className="py-2 pr-0 text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {data.orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No orders linked to this payout.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <a href={`/${locale}/admin/payouts`}>Back to Payouts</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
