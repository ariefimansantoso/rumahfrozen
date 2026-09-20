"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Barcode, Download, Upload, Loader2, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-notification";
import {
  DataTable,
  ProductCell,
  TextCell,
  type DataTableColumn,
  type DataTableTab,
  type DataTableFilter,
  type DataTableBulkAction,
} from "@/components/ui/data-table";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";
import { useListQuery } from "@/hooks/use-list-query";
import { apiClient } from "@/lib/api/client";
import {
  BarcodeLabelStudio,
  type BarcodeLabelInventoryItem,
} from "@/components/barcode/barcode-label-studio";
import type { BarcodeFormat } from "@/lib/barcode/standards";

interface InventoryItem {
  id: string; // Added unique key for DataTable
  productId: string;
  productName: string;
  productImage: string | null;
  variantId: string | null;
  variantName: string | null;
  sku: string;
  barcode: string;
  barcodeFormat?: BarcodeFormat;
  barcodeSource?: "manufacturer" | "gs1" | "internal";
  price: number;
  unavailable: number;
  committed: number;
  available: number;
  onHand: number;
  locationInventory: Array<{
    locationId: string;
    locationName: string;
    quantity: number;
  }>;
}

interface Location {
  _id: string;
  name: string;
  isDefault: boolean;
}

interface InventoryPayload {
  items?: Omit<InventoryItem, "id">[];
  locations?: Location[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

interface InventoryDataTableProps {
  locale: string;
  readOnly?: boolean;
  apiEndpoint?: string;
  productHrefBase?: string;
  title?: string;
}

export function InventoryDataTable({
  locale,
  readOnly = false,
  apiEndpoint = "/api/admin/inventory",
  productHrefBase = "admin/products",
  title,
}: InventoryDataTableProps) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const initialPageParam = parseInt(searchParams.get("page") || "1", 10);

  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [labelStudioOpen, setLabelStudioOpen] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<
    Map<string, { available: number; onHand: number }>
  >(new Map());

  const list = useListQuery<InventoryItem>({
    endpoint: apiEndpoint,
    initialPage: Number.isNaN(initialPageParam) ? 1 : initialPageParam,
    initialSearch: searchParams.get("search") || "",
    initialTab: searchParams.get("location") || "all",
    tabParam: "location",
    initialSortBy: searchParams.get("sortBy") || "productName",
    initialSortOrder: searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
    initialFilters: { stockLevel: searchParams.get("stockLevel") || "all" },
    select: (payload) => {
      const data = (payload || {}) as InventoryPayload;
      return {
        items: (data.items || []).map((item) => ({
          ...item,
          id: `${item.productId}-${item.variantId || "main"}`,
        })),
        pagination: data.pagination,
      };
    },
    errorMessage: t("admin.inventory.updateError"),
  });

  const locations = useMemo(
    () => ((list.rawData as InventoryPayload | undefined)?.locations) || [],
    [list.rawData],
  );

  // Overlay unsaved quantity edits on top of the fetched rows.
  const displayItems = useMemo(
    () =>
      list.items.map((item) => {
        const pending = pendingUpdates.get(item.id);
        return pending ? { ...item, ...pending } : item;
      }),
    [list.items, pendingUpdates],
  );

  const handleQuantityChange = useCallback(
    (item: InventoryItem, field: "available" | "onHand", value: number) => {
      if (readOnly) return;
      const key = `${item.productId}-${item.variantId || "main"}`;

      setPendingUpdates((prev) => {
        const existing = prev.get(key) || {
          available: item.available,
          onHand: item.onHand,
        };
        const next = new Map(prev);
        next.set(key, { ...existing, [field]: value });
        return next;
      });
    },
    [readOnly],
  );

  const saveChanges = async () => {
    if (pendingUpdates.size === 0) return;

    setIsSaving(true);
    try {
      const updates = Array.from(pendingUpdates.entries()).map(
        ([key, values]) => {
          const [productId, variantId] = key.split("-");
          return {
            productId,
            variantId: variantId === "main" ? undefined : variantId,
            quantity: values.onHand,
            locationId: list.activeTab !== "all" ? list.activeTab : undefined,
          };
        },
      );

      await apiClient.patch(apiEndpoint, { updates });

      toast.success(t("admin.inventory.updateSuccess"));
      setPendingUpdates(new Map());
      list.refetch();
    } catch (error) {
      console.error("Failed to save inventory:", error);
      toast.error(t("admin.inventory.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  const translateSystemLocationName = useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase();
      const knownLabels: Record<string, string> = {
        online: t("admin.inventory.tabs.online"),
        "online store": t("admin.inventory.tabs.onlineStore"),
        "main warehouse": t("admin.inventory.tabs.mainWarehouse"),
        "storify warehouse": t("admin.inventory.tabs.storifyWarehouse"),
        "store front": t("admin.inventory.tabs.storeFront"),
        "secondary storage": t("admin.inventory.tabs.secondaryStorage"),
      };
      return knownLabels[normalized] || name;
    },
    [t],
  );

  const exportInventory = useCallback(() => {
    const headers = [
      t("admin.inventory.csvHeaders.product"),
      t("admin.inventory.csvHeaders.variant"),
      t("admin.inventory.csvHeaders.sku"),
      t("admin.inventory.csvHeaders.barcode"),
      t("admin.inventory.csvHeaders.available"),
      t("admin.inventory.csvHeaders.onHand"),
    ];
    const rows = displayItems.map((item) => [
      item.productName,
      item.variantName || "",
      item.sku,
      item.barcode,
      String(item.available),
      String(item.onHand),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayItems, t]);

  // Columns
  const columns = useMemo<DataTableColumn<InventoryItem>[]>(
    () => [
      {
        id: "product",
        header: t("admin.inventory.columns.product"),
        cell: (row) => (
          <ProductCell
            image={row.productImage}
            title={row.productName}
            subtitle={row.variantName || undefined}
            href={
              productHrefBase
                ? `/${locale}/${productHrefBase}/${row.productId}/edit`
                : undefined
            }
          />
        ),
      },
      {
        id: "sku",
        header: t("admin.inventory.columns.sku"),
        cell: (row) => (
          <TextCell value={row.sku} className="font-mono text-sm" />
        ),
        className: "w-[150px]",
      },
      {
        id: "barcode",
        header: t("admin.inventory.columns.barcode"),
        cell: (row) => (
          <TextCell value={row.barcode || "--"} className="font-mono text-sm" />
        ),
        className: "w-[170px]",
      },
      {
        id: "unavailable",
        header: t("admin.inventory.columns.unavailable"),
        cell: (row) => (
          <TextCell
            value={row.unavailable}
            className="text-center text-muted-foreground"
          />
        ),
        className: "text-center w-[100px]",
      },
      {
        id: "committed",
        header: t("admin.inventory.columns.committed"),
        cell: (row) => (
          <TextCell
            value={row.committed}
            className="text-center text-muted-foreground"
          />
        ),
        className: "text-center w-[100px]",
      },
      {
        id: "available",
        header: t("admin.inventory.columns.available"),
        cell: (row) => (
          <Input
            type="number"
            min={0}
            value={row.available}
            disabled={readOnly}
            onChange={(e) =>
              handleQuantityChange(
                row,
                "available",
                parseInt(e.target.value) || 0,
              )
            }
            className="h-8 w-20 text-center mx-auto"
          />
        ),
        className: "text-center w-[120px]",
      },
      {
        id: "onHand",
        header: t("admin.inventory.columns.onHand"),
        cell: (row) => (
          <Input
            type="number"
            min={0}
            value={row.onHand}
            disabled={readOnly}
            onChange={(e) =>
              handleQuantityChange(row, "onHand", parseInt(e.target.value) || 0)
            }
            className="h-8 w-20 text-center mx-auto"
          />
        ),
        className: "text-center w-[120px]",
      },
    ],
    [locale, productHrefBase, t, handleQuantityChange, readOnly],
  );

  // Tabs (Locations)
  const tabs = useMemo<DataTableTab[]>(
    () => [
      { id: "all", label: t("admin.inventory.tabs.all") },
      ...locations.map((loc) => ({
        id: loc._id,
        label: translateSystemLocationName(loc.name),
      })),
    ],
    [locations, t, translateSystemLocationName],
  );

  // Filters (Stock Level)
  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: "stockLevel",
        label: t("admin.inventory.filters.stockLevel"),
        type: "select",
        options: [
          { label: t("admin.inventory.filters.all"), value: "all" },
          { label: t("admin.inventory.filters.lowStock"), value: "low" },
          { label: t("admin.inventory.filters.outOfStock"), value: "out" },
        ],
      },
    ],
    [t],
  );

  const tableHeader = useMemo(
    () =>
      buildAdminCommerceTableHeader({
        title: title || t("admin.inventory.title"),
        secondaryActions: [
          {
            id: "print-barcode-labels",
            label: "Print barcode labels",
            icon: <Barcode className="h-4 w-4" />,
            onClick: () => setLabelStudioOpen(true),
            disabled: selectedItems.length === 0,
          },
        ],
        importExportAction: {
          id: "import-export",
          label: t("admin.productsDataTable.actions.importExport"),
          icon: <ChevronsUpDown className="h-4 w-4" />,
          variant: "outline",
          items: [
            {
              id: "toolbar-export",
              label: t("admin.inventory.export"),
              icon: <Download className="h-4 w-4" />,
              onClick: exportInventory,
            },
            {
              id: "toolbar-import",
              label: t("admin.inventory.import"),
              icon: <Upload className="h-4 w-4" />,
              disabled: true,
            },
          ],
        },
      }),
    [exportInventory, selectedItems.length, t, title],
  );

  const bulkActions = useMemo<DataTableBulkAction<InventoryItem>[]>(
    () => [
      {
        id: "bulk-print-barcode-labels",
        label: "Print barcode labels",
        icon: <Barcode className="h-4 w-4" />,
        onClick: () => setLabelStudioOpen(true),
      },
    ],
    [],
  );

  const hasChanges = pendingUpdates.size > 0;

  return (
    <div className="space-y-4">
      <DataTable
        data={displayItems}
        columns={columns}
        keyField="id"
        isLoading={list.isLoading}
        loadingMode="rows"
        // Header
        title={tableHeader.title}
        tabs={tabs}
        activeTab={list.activeTab}
        onTabChange={list.handleTabChange}
        actions={tableHeader.actions}
        // Selection
        selectable
        selectedItems={selectedItems}
        onSelectionChange={setSelectedItems}
        bulkActions={bulkActions}
        // Search
        searchable
        searchPlaceholder={t("admin.inventory.searchPlaceholder")}
        searchValue={list.search}
        onSearchChange={list.handleSearchChange}
        filters={filters}
        filterValues={list.filters}
        onFilterChange={(id, value) => {
          if (id === "stockLevel") list.handleFilterChange(id, value);
        }}
        toolbarActions={tableHeader.toolbarActions}
        toolbarLayout={tableHeader.toolbarLayout}
        tabsVariant={tableHeader.tabsVariant}
        filtersVariant={tableHeader.filtersVariant}
        appearance={tableHeader.appearance}
        stackedTopControls={tableHeader.stackedTopControls}
        showToolbarSortButton={tableHeader.showToolbarSortButton}
        sortColumn={list.sortBy}
        sortDirection={list.sortOrder}
        onSortChange={list.handleSortChange}
        // Pagination
        pagination={list.pagination}
        onPageChange={list.handlePageChange}
        onPageSizeChange={list.handlePageSizeChange}
        // Empty state
        emptyMessage={t("admin.inventory.empty")}
      />

      <BarcodeLabelStudio
        open={labelStudioOpen}
        onOpenChange={setLabelStudioOpen}
        items={selectedItems as BarcodeLabelInventoryItem[]}
      />

      {/* Footer for unsaved changes */}
      {hasChanges && !readOnly && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-4 border rounded-lg bg-background shadow-lg animate-in slide-in-from-bottom-5">
          <div className="mr-2 text-sm font-medium">
            {t("admin.inventory.itemsModified", { count: pendingUpdates.size })}
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setPendingUpdates(new Map());
              list.refetch();
            }}
          >
            {t("admin.inventory.actions.cancel")}
          </Button>
          <Button onClick={saveChanges} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("admin.inventory.actions.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
