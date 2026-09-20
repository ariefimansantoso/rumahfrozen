"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  FolderTree,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { toast } from "@/components/ui/toast-notification";
import { AppImage } from "@/components/ui/app-image";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  isActive: boolean;
  productCount?: number;
}

interface AdminCategoriesTableProps {
  locale: string;
  page: number;
  search?: string;
  status?: string;
}

export function AdminCategoriesTable({
  locale,
  page,
  search,
  status,
}: AdminCategoriesTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm } = useConfirmation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState(search || "");
  const [statusFilter, setStatusFilter] = useState(status || "all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      params.set("flat", "true");
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);

      const res = await fetch(`/api/categories?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const categoriesData = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.data)
            ? data.data.data
            : [];
        const paginationData =
          data?.data?.pagination ??
          data?.pagination ??
          { page: 1, limit: 10, total: categoriesData.length, totalPages: 1 };

        setCategories(categoriesData);
        setPagination(paginationData);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status]);

  // Fetch all categories flat for parent name lookup
  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch("/api/categories?flat=true");
        const data = await res.json();
        if (data.success) {
          const cats = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.data?.data)
              ? data.data.data
              : [];
          setAllCategories(cats);
        }
      } catch {
        // Silent - parent lookup is non-critical
      }
    }
    fetchAll();
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (searchValue) {
      params.set("search", searchValue);
    } else {
      params.delete("search");
    }
    router.push(`?${params.toString()}`);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value !== "all") {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    router.push(`?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const handleDelete = async (categoryId: string, categoryName: string) => {
    const confirmed = await confirm({
      title: "Delete Category",
      description: `Are you sure you want to delete "${categoryName}"? Products in this category will need to be recategorized.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Category deleted successfully");
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to delete category");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center">Loading categories...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          Search
        </Button>

        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead className="text-center">Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No categories found
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => {
                const parentCategory = allCategories.find(
                  (c) => c._id === category.parentId
                );

                return (
                  <TableRow key={category._id}>
                    <TableCell>
                      <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {category.image ? (
                          <AppImage
                            src={category.image}
                            alt={category.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <FolderTree className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{category.name}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      /{category.slug}
                    </TableCell>
                    <TableCell>
                      {parentCategory ? (
                        <Badge variant="outline">{parentCategory.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {category.productCount ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={category.isActive ? "default" : "secondary"}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/${locale}/admin/categories/${category._id}/edit`}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              handleDelete(category._id, category.name)
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
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
                <PaginationPrevious
                  onClick={() => handlePageChange(pagination.page - 1)}
                />
              </PaginationItem>
            )}
            <PaginationItem>
              <span className="px-4 py-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
            </PaginationItem>
            {pagination.page < pagination.totalPages && (
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(pagination.page + 1)}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
