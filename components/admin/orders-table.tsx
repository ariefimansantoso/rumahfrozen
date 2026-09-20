"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Eye,
  Search,
  Filter,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useCurrency } from "@/providers/currency-provider";
import { toast } from "@/components/ui/toast-notification";

interface Order {
  _id: string;
  orderNumber: string;
  customerId?: { name: string; email: string };
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: { name: string; quantity: number }[];
}

interface AdminOrdersTableProps {
  locale: string;
  page: number;
  status?: string;
  search?: string;
}

export function AdminOrdersTable({
  locale,
  page,
  status,
  search,
}: AdminOrdersTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState(search || "");

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.data?.data || data.data || []);
        setPagination(
          data.data?.pagination || { page: 1, totalPages: 1, total: 0 }
        );
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchValue) {
      params.set("search", searchValue);
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const handleStatusFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(t("orders.orderUpdated"));
        fetchOrders();
      } else {
        toast.error(t("orders.orderUpdateFailed"));
      }
    } catch {
      toast.error(t("common.error"));
    }
  };

  const getStatusBadge = (orderStatus: string) => {
    const config: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        icon: typeof Clock;
      }
    > = {
      pending: { variant: "secondary", icon: Clock },
      processing: { variant: "default", icon: Package },
      shipped: { variant: "outline", icon: Truck },
      delivered: { variant: "default", icon: CheckCircle },
      cancelled: { variant: "destructive", icon: XCircle },
    };
    const { variant, icon: Icon } = config[orderStatus] || config.pending;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {orderStatus}
      </Badge>
    );
  };

  if (isLoading) {
    return <OrdersTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("orders.searchPlaceholder")}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Select value={status || "all"} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatus")}</SelectItem>
            <SelectItem value="pending">{t("orders.pending")}</SelectItem>
            <SelectItem value="processing">{t("orders.processing")}</SelectItem>
            <SelectItem value="shipped">{t("orders.shipped")}</SelectItem>
            <SelectItem value="delivered">{t("orders.delivered")}</SelectItem>
            <SelectItem value="cancelled">{t("orders.cancelled")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleSearch}>
          {t("common.search")}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("checkout.orderNumber")}</TableHead>
              <TableHead>{t("admin.users")}</TableHead>
              <TableHead>{t("common.items")}</TableHead>
              <TableHead>{t("common.total")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>
                {t("checkout.estimatedDelivery").split(" ")[0]}
              </TableHead>
              <TableHead className="w-[70px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  {t("orders.noOrdersFound")}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order._id}>
                  <TableCell className="font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{order.customerId?.name || t("common.guest")}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerId?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.items.length} {t("common.items")}
                  </TableCell>
                  <TableCell>{formatPrice(order.total)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>
                          {t("common.actions")}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/${locale}/admin/orders/${order._id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t("common.viewDetails")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            handleUpdateStatus(order._id, "processing")
                          }
                        >
                          <Package className="mr-2 h-4 w-4" />
                          {t("orders.markProcessing")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleUpdateStatus(order._id, "shipped")
                          }
                        >
                          <Truck className="mr-2 h-4 w-4" />
                          {t("orders.markShipped")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleUpdateStatus(order._id, "delivered")
                          }
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {t("orders.markDelivered")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handleUpdateStatus(order._id, "cancelled")
                          }
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          {t("orders.cancelOrder")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {pagination.page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={`?page=${pagination.page - 1}`} />
              </PaginationItem>
            )}
            {Array.from(
              { length: Math.min(5, pagination.totalPages) },
              (_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href={`?page=${pageNum}`}
                      isActive={pageNum === pagination.page}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              }
            )}
            {pagination.page < pagination.totalPages && (
              <PaginationItem>
                <PaginationNext href={`?page=${pagination.page + 1}`} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function OrdersTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
