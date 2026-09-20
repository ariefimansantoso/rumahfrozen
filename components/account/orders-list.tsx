"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { AlertCircle, ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/providers/currency-provider";
import { ORDER_STATUS } from "@/config/app.config";

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  purchaseType?: string;
  preorderReleaseDate?: string;
  preorderStatus?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  items: OrderItem[];
  hasPreorder?: boolean;
  preorderStatus?: string;
  preorderReleaseDate?: string;
  createdAt: string;
}

interface CustomerOrdersListProps {
  locale: string;
  filter?: "all" | "regular" | "preorders";
  emptyTitle?: string;
  emptyDescription?: string;
}

function getPreorderReleaseDate(order: Order) {
  if (order.preorderReleaseDate) return order.preorderReleaseDate;
  return order.items.find((item) => item.purchaseType === "preorder")
    ?.preorderReleaseDate;
}

function getPreorderStatus(order: Order) {
  if (order.preorderStatus) return order.preorderStatus;
  return order.items.find((item) => item.purchaseType === "preorder")
    ?.preorderStatus;
}

function getStatusBadge(status: string) {
  const config: Record<
    string,
    {
      variant: "default" | "secondary" | "outline" | "destructive";
      label: string;
    }
  > = {
    [ORDER_STATUS.PENDING]: { variant: "outline", label: "Pending" },
    [ORDER_STATUS.PREORDERED]: { variant: "outline", label: "Pre-ordered" },
    [ORDER_STATUS.PROCESSING]: { variant: "secondary", label: "Processing" },
    [ORDER_STATUS.SHIPPED]: { variant: "default", label: "Shipped" },
    [ORDER_STATUS.DELIVERED]: { variant: "default", label: "Delivered" },
    [ORDER_STATUS.CANCELLED]: { variant: "destructive", label: "Cancelled" },
  };
  const { variant, label } = config[status] || {
    variant: "outline",
    label: status,
  };
  return <Badge variant={variant}>{label}</Badge>;
}

function getPreorderStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    reserved: "Reserved",
    payment_due: "Payment due",
    delayed: "Delayed",
    partially_ready: "Partially ready",
    ready: "Ready",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
    expired: "Expired",
  };
  return status ? labels[status] || status.replace(/_/g, " ") : null;
}

export function CustomerOrdersList({
  locale,
  filter = "all",
  emptyTitle,
  emptyDescription,
}: CustomerOrdersListProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const params = new URLSearchParams();
        if (filter === "preorders") params.set("type", "preorders");
        if (filter === "regular") params.set("type", "regular");
        const query = params.toString();
        const res = await fetch(`/api/orders${query ? `?${query}` : ""}`);
        const data = await res.json();

        if (data.success) {
          const ordersData = data.data?.data || data.data || [];
          setOrders(Array.isArray(ordersData) ? ordersData : []);
        } else {
          setError(data.message || "Failed to load orders");
        }
      } catch {
        setError("Failed to load orders");
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, [filter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-2">
          {emptyTitle ||
            t("orders.noOrders")}
        </h3>
        <p className="text-muted-foreground mb-4">
          {emptyDescription ||
            t("orders.startShopping")}
        </p>
        <Button asChild>
          <Link href={`/${locale}/products`}>
            {t("orders.browseProducts")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const preorderReleaseDate = getPreorderReleaseDate(order);
        const preorderStatusLabel = getPreorderStatusLabel(
          getPreorderStatus(order),
        );

        return (
          <Link
            key={order._id}
            href={`/${locale}/account/orders/${order._id}`}
            className="block rounded-lg border p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{order.orderNumber}</span>
                {getStatusBadge(order.status)}
                {order.hasPreorder ? (
                  <Badge variant="outline">Pre-order</Badge>
                ) : null}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {order.items.length} {order.items.length === 1 ? "item" : "items"}{" "}
              - {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
            {order.hasPreorder ? (
              <p className="text-sm text-muted-foreground mb-2">
                {preorderStatusLabel || "Pre-order"}
                {preorderReleaseDate
                  ? ` - ships around ${format(
                      new Date(preorderReleaseDate),
                      "MMM d, yyyy",
                    )}`
                  : ""}
              </p>
            ) : null}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-semibold">{formatPrice(order.total)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
