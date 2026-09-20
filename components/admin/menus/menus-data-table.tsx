"use client";

import { Plus, Pencil, Trash2, ListTree, PanelsTopLeft } from "lucide-react";
import {
  DataTable,
  StatusCell,
  type DataTableColumn,
  type DataTableAction,
  type DataTablePaginationType,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast-notification";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";

interface Menu {
  _id: string;
  name: string;
  handle: string;
  location: string;
  isActive: boolean;
  items: { length?: number }[] | unknown[];
  updatedAt: string;
}

interface HeaderCmsRow {
  _id: "__header-cms__";
  type: "header-cms";
  name: "Headers";
  handle: "headers";
  location: "header-cms";
  isActive: true;
  items: [];
  updatedAt: string;
}

interface FooterCmsRow {
  _id: "__footer-cms__";
  type: "footer-cms";
  name: "Footer";
  handle: "footer";
  location: "footer-cms";
  isActive: true;
  items: [];
  updatedAt: string;
}

type MenuRow = Menu | HeaderCmsRow | FooterCmsRow;

const HEADER_CMS_ROW: HeaderCmsRow = {
  _id: "__header-cms__",
  type: "header-cms",
  name: "Headers",
  handle: "headers",
  location: "header-cms",
  isActive: true,
  items: [],
  updatedAt: "",
};

const FOOTER_CMS_ROW: FooterCmsRow = {
  _id: "__footer-cms__",
  type: "footer-cms",
  name: "Footer",
  handle: "footer",
  location: "footer-cms",
  isActive: true,
  items: [],
  updatedAt: "",
};

const LOCATION_LABELS: Record<string, string> = {
  "header-cms": "Headers",
  "footer-cms": "Footer CMS",
  header: "Header (main)",
  "header-mega": "Header (megamenu)",
  footer: "Footer",
  mobile: "Mobile",
  sidebar: "Sidebar",
  custom: "Custom",
};

function isHeaderCmsRow(row: MenuRow): row is HeaderCmsRow {
  return row._id === HEADER_CMS_ROW._id;
}

function isFooterCmsRow(row: MenuRow): row is FooterCmsRow {
  return row._id === FOOTER_CMS_ROW._id;
}

function isMainHeaderMenu(row: Menu) {
  return row.handle === "main-header";
}

// System menu wired into the storefront header — editable but not deletable.
function isMegaMenu(row: Menu) {
  return row.handle === "main-mega-menu";
}

function getMenuEditorHref(locale: string, row: Menu) {
  return `/${locale}/admin/online-store/menus/${encodeURIComponent(
    row.handle || row._id,
  )}/edit`;
}

export function MenusDataTable({ locale }: { locale: string }) {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<MenuRow[]>([]);
  const [pagination, setPagination] = useState<DataTablePaginationType>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.pageSize),
      });
      const res = await fetch(`/api/menus?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const menuItems = (data.data.data as Menu[]).filter(
          (menu) => !isMainHeaderMenu(menu),
        );
        setItems(
          pagination.page === 1
            ? [HEADER_CMS_ROW, FOOTER_CMS_ROW, ...menuItems]
            : menuItems,
        );
        setPagination((p) => ({
          ...p,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("Failed to load menus");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchItems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  const handleDelete = useCallback(
    async (m: Menu) => {
      const ok = await confirm({
        title: "Delete menu?",
        description: `"${m.name}" will be removed.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "destructive",
      });
      if (!ok) return;
      const res = await fetch(`/api/menus/${m._id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Menu deleted");
        fetchItems();
      } else {
        toast.error("Failed to delete");
      }
    },
    [confirm, fetchItems],
  );

  const columns = useMemo<DataTableColumn<MenuRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (row) => (
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
              {isHeaderCmsRow(row) || isFooterCmsRow(row) ? (
                <PanelsTopLeft className="h-4 w-4" />
              ) : (
                <ListTree className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.handle}</p>
            </div>
          </div>
        ),
        className: "w-[280px]",
      },
      {
        id: "location",
        header: "Location",
        cell: (row) => (
          <Badge variant="outline" className="capitalize">
            {LOCATION_LABELS[row.location] || row.location}
          </Badge>
        ),
        className: "w-[200px]",
      },
      {
        id: "items",
        header: "Items",
        cell: (row) => (
          <span className="text-sm">
            {isHeaderCmsRow(row) || isFooterCmsRow(row)
              ? "CMS"
              : row.items?.length || 0}
          </span>
        ),
        className: "w-[80px]",
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => <StatusCell status={row.isActive ? "active" : "inactive"} />,
        className: "w-[120px]",
      },
    ],
    [],
  );

  const tableHeader = useMemo(
    () =>
      buildAdminCommerceTableHeader({
        title: "Menus",
        addAction: {
          id: "add",
          label: "Add menu",
          href: `/${locale}/admin/online-store/menus/new`,
          icon: <Plus className="h-4 w-4" />,
          variant: "default",
        },
      }),
    [locale],
  );

  const rowActions = useCallback(
    (row: MenuRow): DataTableAction[] => {
      if (isHeaderCmsRow(row)) {
        return [
          {
            id: "customize-header",
            label: "Customize",
            icon: <Pencil className="h-4 w-4" />,
            href: `/${locale}/admin/online-store/menus/header`,
          },
        ];
      }

      if (isFooterCmsRow(row)) {
        return [
          {
            id: "customize-footer",
            label: "Customize",
            icon: <Pencil className="h-4 w-4" />,
            href: `/${locale}/admin/online-store/menus/footer`,
          },
        ];
      }

      const editAction: DataTableAction = {
        id: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        href: getMenuEditorHref(locale, row),
      };

      // Mega Menu is a protected system menu — editable, but not deletable, so
      // it shows only the edit action (matching the Headers/Footer CMS rows).
      if (isMegaMenu(row)) {
        return [editAction];
      }

      return [
        editAction,
        {
          id: "delete",
          label: "Delete",
          icon: <Trash2 className="h-4 w-4" />,
          variant: "destructive",
          onClick: () => handleDelete(row),
        },
      ];
    },
    [locale, handleDelete],
  );

  return (
    <DataTable
      data={items}
      columns={columns}
      keyField="_id"
      isLoading={isLoading}
      loadingMode="rows"
      title={tableHeader.title}
      actions={tableHeader.actions}
      toolbarActions={tableHeader.toolbarActions}
      toolbarLayout={tableHeader.toolbarLayout}
      tabsVariant={tableHeader.tabsVariant}
      filtersVariant={tableHeader.filtersVariant}
      appearance={tableHeader.appearance}
      stackedTopControls={tableHeader.stackedTopControls}
      showToolbarSortButton={tableHeader.showToolbarSortButton}
      pagination={pagination}
      onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
      onPageSizeChange={(pageSize) =>
        setPagination((p) => ({ ...p, page: 1, pageSize }))
      }
      rowActions={rowActions}
      rowActionsHeader="Actions"
      rowActionsVariant="inline"
      onRowClick={(row) => {
        if (isHeaderCmsRow(row)) {
          router.push(`/${locale}/admin/online-store/menus/header`);
          return;
        }
        if (isFooterCmsRow(row)) {
          router.push(`/${locale}/admin/online-store/menus/footer`);
          return;
        }
        router.push(getMenuEditorHref(locale, row));
      }}
      emptyMessage="No menus yet. Create one to manage navigation."
      emptyIcon={<ListTree className="h-8 w-8" />}
    />
  );
}
