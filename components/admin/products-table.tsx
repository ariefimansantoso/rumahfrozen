"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Search,
  Filter,
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
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { AppImage } from "@/components/ui/app-image";
import type { ProductListItem as Product } from "@/types/product-list";


interface AdminProductsTableProps {
  locale: string;
  page: number;
  search?: string;
  status?: string;
}

export function AdminProductsTable({
  locale,
  page,
  search,
  status,
}: AdminProductsTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();
  const { confirm } = useConfirmation();

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState(search || "");

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setProducts(data.data?.data || data.data || []);
        setPagination(
          data.data?.pagination || { page: 1, totalPages: 1, total: 0 },
        );
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  const handleDelete = async (productId: string, productName: string) => {
    const confirmed = await confirm({
      title: t("admin.productsManagement.deleteDialog.title"),
      description: t("admin.productsManagement.deleteDialog.description", {
        name: productName,
      }),
      confirmText: t("admin.productsManagement.deleteDialog.confirm"),
      cancelText: t("admin.productsManagement.deleteDialog.cancel"),
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(t("admin.productsManagement.deleteDialog.success"));
        fetchProducts();
      } else {
        toast.error(t("admin.productsManagement.deleteDialog.error"));
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const getStatusBadge = (productStatus: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      published: "default",
      active: "default",
      draft: "secondary",
      archived: "outline",
    };
    return (
      <Badge variant={variants[productStatus] || "secondary"}>
        {t(`admin.productsManagement.status.${productStatus}`)}
      </Badge>
    );
  };

  if (isLoading) {
    return <ProductsTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.productsManagement.searchPlaceholder")}
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
            <SelectItem value="published">
              {t("admin.productsManagement.status.published")}
            </SelectItem>
            <SelectItem value="draft">
              {t("admin.productsManagement.status.draft")}
            </SelectItem>
            <SelectItem value="archived">
              {t("admin.productsManagement.status.archived")}
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
              <TableHead className="w-[80px]">
                {t("admin.productsManagement.table.image")}
              </TableHead>
              <TableHead>{t("admin.productsManagement.table.name")}</TableHead>
              <TableHead>
                {t("admin.productsManagement.table.vendor")}
              </TableHead>
              <TableHead>{t("admin.productsManagement.table.price")}</TableHead>
              <TableHead>{t("admin.productsManagement.table.stock")}</TableHead>
              <TableHead>
                {t("admin.productsManagement.table.status")}
              </TableHead>
              <TableHead className="w-[70px]">
                {t("admin.productsManagement.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  {t("admin.productsManagement.table.noProducts")}
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product._id}>
                  <TableCell>
                    <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted">
                      {product.images?.[0] ? (
                        <AppImage
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          {t("admin.productsManagement.table.na")}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.category?.name ||
                          t("admin.productsManagement.table.uncategorized")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.vendorId?.storeName ||
                      t("admin.productsManagement.table.na")}
                  </TableCell>
                  <TableCell>{formatPrice(product.price)}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>{getStatusBadge(product.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>
                          {t("admin.productsManagement.table.actions")}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/${locale}/products/${product.slug}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t("admin.productsManagement.table.view")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/${locale}/admin/products/${product._id}/edit`}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("admin.productsManagement.table.edit")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handleDelete(product._id, product.name)
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("admin.productsManagement.table.delete")}
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
              },
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

export function ProductsTableSkeleton() {
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
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-12 w-12 rounded-md" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
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
