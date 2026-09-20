"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Search,
  Filter,
  Store,
  Shield,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataTablePagination,
  type DataTablePaginationType,
} from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast-notification";
import { USER_ACCOUNT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { useCurrency } from "@/providers/currency-provider";

interface Vendor {
  _id: string;
  storeName: string;
  slug: string;
  logo?: string;
  status: string;
  commission: number;
  totalSales: number;
  createdAt: string;
  user?: {
    name: string;
    email: string;
    image?: string;
    status?: "active" | "inactive" | "banned";
  };
}

interface AdminVendorsTableProps {
  locale: string;
  page: number;
  limit?: number;
  status?: string;
  search?: string;
}

export function AdminVendorsTable({
  locale,
  page,
  limit = 10,
  status,
  search,
}: AdminVendorsTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pagination, setPagination] = useState<DataTablePaginationType>({
    page: 1,
    pageSize: limit,
    totalPages: 1,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState(search || "");

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);

      const res = await fetch(`/api/admin/vendors?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setVendors(data.data?.data || data.data || []);
        setPagination((prev) => ({
          page: data.data?.pagination?.page ?? 1,
          pageSize: data.data?.pagination?.limit ?? prev.pageSize,
          total: data.data?.pagination?.total ?? 0,
          totalPages: data.data?.pagination?.totalPages ?? 1,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

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

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", String(nextPageSize));
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const handleUpdateStatus = async (vendorId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(t("admin.vendorsManagement.toasts.statusSuccess"));
        fetchVendors();
      } else {
        const data = await res.json();
        toast.error(
          data.message || t("admin.vendorsManagement.toasts.statusError"),
        );
      }
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleUpdateAccountStatus = async (
    vendorId: string,
    userStatus: string,
  ) => {
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userStatus }),
      });

      if (res.ok) {
        toast.success("Account status updated successfully");
        fetchVendors();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to update account status");
      }
    } catch {
      toast.error(t("common.error"));
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
      [VENDOR_STATUS.APPROVED]: {
        variant: "default",
        icon: CheckCircle2,
        label: t("admin.vendorsManagement.status.approved"),
      },
      [VENDOR_STATUS.PENDING]: {
        variant: "outline",
        icon: Store,
        label: t("admin.vendorsManagement.status.pending"),
      },
      [VENDOR_STATUS.REJECTED]: {
        variant: "destructive",
        icon: XCircle,
        label: t("admin.vendorsManagement.status.rejected"),
      },
      [VENDOR_STATUS.SUSPENDED]: {
        variant: "destructive",
        icon: XCircle,
        label: t("admin.vendorsManagement.status.suspended"),
      },
    };

    // Fallback if status doesn't match keys
    const {
      variant,
      icon: Icon,
      label,
    } = config[status] || { variant: "secondary", icon: Store, label: status };

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getAccountStatusBadge = (status?: string) => {
    if (status === USER_ACCOUNT_STATUS.BANNED) {
      return <Badge variant="destructive">Banned</Badge>;
    }
    if (status === USER_ACCOUNT_STATUS.INACTIVE) {
      return <Badge variant="outline">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  if (isLoading) {
    return <VendorsTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.vendorsManagement.searchPlaceholder")}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Select value={status || "all"} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue
              placeholder={t("admin.productsManagement.status.label")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("admin.productsManagement.status.all")}
            </SelectItem>
            <SelectItem value={VENDOR_STATUS.PENDING}>
              {t("admin.vendorsManagement.status.pending")}
            </SelectItem>
            <SelectItem value={VENDOR_STATUS.APPROVED}>
              {t("admin.vendorsManagement.status.approved")}
            </SelectItem>
            <SelectItem value={VENDOR_STATUS.SUSPENDED}>
              {t("admin.vendorsManagement.status.suspended")}
            </SelectItem>
            <SelectItem value={VENDOR_STATUS.REJECTED}>
              {t("admin.vendorsManagement.status.rejected")}
            </SelectItem>
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
              <TableHead>
                {t("admin.vendorsManagement.table.storeOwner")}
              </TableHead>
              <TableHead>{t("admin.vendorsManagement.table.status")}</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>
                {t("admin.vendorsManagement.table.commission")}
              </TableHead>
              <TableHead>{t("admin.vendorsManagement.table.sales")}</TableHead>
              <TableHead>{t("admin.vendorsManagement.table.joined")}</TableHead>
              <TableHead className="w-[70px]">
                {t("admin.vendorsManagement.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  {t("admin.vendorsManagement.table.noVendors")}
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((vendor) => (
                <TableRow key={vendor._id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{vendor.storeName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={vendor.user?.image} />
                          <AvatarFallback className="text-[10px]">
                            {vendor.user?.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {vendor.user?.name ||
                            t("admin.vendorsManagement.table.unknown")}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                  <TableCell>{getAccountStatusBadge(vendor.user?.status)}</TableCell>
                  <TableCell>{vendor.commission}%</TableCell>
                  <TableCell>{formatPrice(vendor.totalSales)}</TableCell>
                  <TableCell>
                    {format(new Date(vendor.createdAt), "MMM d, yyyy")}
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
                          {t("admin.vendorsManagement.table.actions")}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/${locale}/vendors/${vendor.slug}`}
                            target="_blank"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {t("admin.vendorsManagement.table.visitStore")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {t("admin.vendorsManagement.table.updateStatus")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                              value={vendor.status}
                              onValueChange={(val) =>
                                handleUpdateStatus(vendor._id, val)
                              }
                            >
                              <DropdownMenuRadioItem
                                value={VENDOR_STATUS.PENDING}
                              >
                                {t("admin.vendorsManagement.status.pending")}
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem
                                value={VENDOR_STATUS.APPROVED}
                              >
                                {t("admin.vendorsManagement.status.approved")}
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem
                                value={VENDOR_STATUS.SUSPENDED}
                              >
                                {t("admin.vendorsManagement.status.suspended")}
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem
                                value={VENDOR_STATUS.REJECTED}
                              >
                                {t("admin.vendorsManagement.status.rejected")}
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Shield className="mr-2 h-4 w-4" />
                            Account Status
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                              value={vendor.user?.status || USER_ACCOUNT_STATUS.ACTIVE}
                              onValueChange={(val) =>
                                handleUpdateAccountStatus(vendor._id, val)
                              }
                            >
                              <DropdownMenuRadioItem value={USER_ACCOUNT_STATUS.ACTIVE}>
                                Active
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value={USER_ACCOUNT_STATUS.INACTIVE}>
                                Inactive
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value={USER_ACCOUNT_STATUS.BANNED}>
                                Banned
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination
        pagination={pagination}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}

function VendorsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store & Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
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
