"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Layers,
  Sparkles,
  Hand,
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

interface Collection {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  image?: { url: string; alt?: string };
  collectionType: "manual" | "automated";
  status: "active" | "draft";
  productCount: number;
  publishing: {
    onlineStore: boolean;
    pointOfSale: boolean;
  };
}

interface AdminCollectionsTableProps {
  locale: string;
  page: number;
  search?: string;
  status?: string;
  type?: string;
}

export function AdminCollectionsTable({
  locale,
  page,
  search,
  status,
  type,
}: AdminCollectionsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm } = useConfirmation();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState(search || "");
  const [statusFilter, setStatusFilter] = useState(status || "all");
  const [typeFilter, setTypeFilter] = useState(type || "all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      if (type && type !== "all") params.set("type", type);

      const res = await fetch(`/api/admin/collections?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const collectionsData = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.data)
          ? data.data.data
          : [];
        const paginationData =
          data?.data?.pagination ??
          data?.pagination ??
          { page: 1, limit: 10, total: 0, totalPages: 0 };
        setCollections(collectionsData);
        setPagination(paginationData);
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error);
      toast.error("Failed to load collections");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status, type]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

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

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value !== "all") {
      params.set("type", value);
    } else {
      params.delete("type");
    }
    router.push(`?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const handleDelete = async (collectionId: string, collectionTitle: string) => {
    const confirmed = await confirm({
      title: "Delete Collection",
      description: `Are you sure you want to delete "${collectionTitle}"? This will not delete the products in this collection.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/collections/${collectionId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Collection deleted successfully");
        fetchCollections();
      } else {
        toast.error("Failed to delete collection");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center">Loading collections...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
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
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={handleTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="automated">Automated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Available in</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No collections found
                </TableCell>
              </TableRow>
            ) : (
              collections.map((collection) => (
                <TableRow key={collection._id}>
                  <TableCell>
                    <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                      {collection.image?.url ? (
                        <AppImage
                          src={collection.image.url}
                          alt={collection.image.alt || collection.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Layers className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{collection.title}</div>
                      <div className="text-sm text-muted-foreground">
                        /{collection.slug}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 w-fit"
                    >
                      {collection.collectionType === "automated" ? (
                        <>
                          <Sparkles className="h-3 w-3" />
                          Automated
                        </>
                      ) : (
                        <>
                          <Hand className="h-3 w-3" />
                          Manual
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {collection.productCount}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        collection.status === "active" ? "default" : "secondary"
                      }
                    >
                      {collection.status === "active" ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {collection.publishing?.onlineStore && (
                        <Badge variant="outline" className="text-xs">
                          Online
                        </Badge>
                      )}
                      {collection.publishing?.pointOfSale && (
                        <Badge variant="outline" className="text-xs">
                          POS
                        </Badge>
                      )}
                    </div>
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
                            href={`/${locale}/admin/collections/${collection._id}`}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handleDelete(collection._id, collection.title)
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
                <PaginationPrevious onClick={() => handlePageChange(pagination.page - 1)} />
              </PaginationItem>
            )}
            <PaginationItem>
              <span className="px-4 py-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
            </PaginationItem>
            {pagination.page < pagination.totalPages && (
              <PaginationItem>
                <PaginationNext onClick={() => handlePageChange(pagination.page + 1)} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
