"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronsUpDown,
  Download,
  Eye,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserMinus,
  ShieldBan,
  Upload,
} from "lucide-react";
import {
  DataTable,
  DateCell,
  StatusCell,
  TextCell,
  type DataTableAction,
  type DataTableBulkAction,
  type DataTableColumn,
  type DataTableTab,
} from "@/components/ui/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import type { StaffPermission } from "@/config/permissions.config";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";
import { useListQuery } from "@/hooks/use-list-query";
import { apiClient } from "@/lib/api/client";

interface StaffListItem {
  _id: string;
  name: string;
  email: string;
  image?: string;
  phone?: string;
  status?: "active" | "inactive" | "banned";
  createdAt: string;
  staffProfile: {
    _id: string;
    permissions: StaffPermission[];
    department?: string;
    isActive: boolean;
    notes?: string;
    createdAt: string;
  } | null;
}

interface StaffDataTableProps {
  locale: string;
  area?: "admin" | "vendor";
  initialPage?: number;
  initialSearch?: string;
  initialStatus?: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  access_pos: "POS",
  manage_pos: "Manage POS",
  create_pos: "POS Create",
  edit_pos: "POS Edit",
  delete_pos: "POS Delete",
  view_orders: "Orders",
  manage_orders: "Manage Orders",
  create_orders: "Create Orders",
  edit_orders: "Edit Orders",
  delete_orders: "Delete Orders",
  view_products: "Products",
  manage_products: "Manage Products",
  create_products: "Create Products",
  edit_products: "Edit Products",
  delete_products: "Delete Products",
  view_customers: "Customers",
  manage_customers: "Manage Customers",
  create_customers: "Create Customers",
  edit_customers: "Edit Customers",
  delete_customers: "Delete Customers",
  view_inventory: "Inventory",
  manage_inventory: "Manage Inventory",
  create_inventory: "Create Inventory",
  edit_inventory: "Edit Inventory",
  delete_inventory: "Delete Inventory",
  view_analytics: "Analytics",
};

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function phraseKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function StaffDataTable({
  locale,
  area = "admin",
  initialPage = 1,
  initialSearch = "",
  initialStatus = "all",
}: StaffDataTableProps) {
  const t = useTranslations();
  const tr = (en: string, _bn?: string) => {
    const key = `admin.phrases.${phraseKey(en)}`;
    try {
      const translated = t(key as never);
      return translated === key ? en : translated;
    } catch {
      return en;
    }
  };
  const router = useRouter();
  const { confirm } = useConfirmation();
  const apiBasePath = area === "vendor" ? "/api/vendor/staff" : "/api/admin/staff";
  const staffBasePath = `/${locale}/${area}/staff`;

  const [selectedStaff, setSelectedStaff] = useState<StaffListItem[]>([]);

  const list = useListQuery<StaffListItem>({
    endpoint: apiBasePath,
    initialPage,
    initialSearch,
    initialTab: initialStatus,
    // This table has no sort UI; keep the request shape the API expects.
    mapQuery: ({ sortBy: _sortBy, sortOrder: _sortOrder, ...rest }) => rest,
    errorMessage: tr("Failed to fetch staff members", "স্টাফ সদস্যদের লোড করা যায়নি"),
  });

  const handleDelete = useCallback(
    async (item: StaffListItem) => {
      const confirmed = await confirm({
        title: tr("Remove staff member", "স্টাফ সদস্য অপসারণ"),
        description: t("admin.staffDataTable.removeSingleDescription", {
          name: item.name,
        }),
        confirmText: tr("Remove", "অপসারণ"),
        variant: "destructive",
      });
      if (!confirmed) return;

      try {
        await apiClient.delete(`${apiBasePath}/${item._id}`);
        toast.success(tr("Staff member removed successfully", "স্টাফ সদস্য সফলভাবে অপসারণ হয়েছে"));
        list.refetch();
      } catch {
        toast.error(tr("Failed to remove staff member", "স্টাফ সদস্য অপসারণে ব্যর্থ"));
      }
    },
    [apiBasePath, confirm, list],
  );

  const handleBulkDelete = useCallback(
    async (items: StaffListItem[]) => {
      const confirmed = await confirm({
        title: tr("Remove staff members", "স্টাফ সদস্যদের অপসারণ"),
        description: t("admin.staffDataTable.removeBulkDescription", {
          count: items.length,
        }),
        confirmText: tr("Remove all", "সব অপসারণ"),
        variant: "destructive",
      });
      if (!confirmed) return;

      try {
        await Promise.all(
          items.map((item) => apiClient.delete(`${apiBasePath}/${item._id}`)),
        );
        setSelectedStaff([]);
        toast.success(t("admin.staffDataTable.removeBulkSuccess", { count: items.length }));
        list.refetch();
      } catch {
        toast.error(tr("Failed to remove some staff members", "কিছু স্টাফ সদস্য অপসারণে ব্যর্থ"));
      }
    },
    [apiBasePath, confirm, list],
  );

  const handleBulkStatusUpdate = useCallback(
    async (
      items: StaffListItem[],
      status: "active" | "inactive" | "banned",
    ) => {
      const confirmed = await confirm({
        title: tr("Update account status", "অ্যাকাউন্ট স্ট্যাটাস আপডেট"),
        description: t("admin.staffDataTable.updateStatusDescription", {
          count: items.length,
          status,
        }),
        variant: status === "banned" ? "destructive" : "default",
      });
      if (!confirmed) return;

      const results = await Promise.allSettled(
        items.map((item) =>
          apiClient.put(`${apiBasePath}/${item._id}`, { status }),
        ),
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;

      setSelectedStaff([]);
      list.refetch();

      if (successCount > 0) {
        toast.success(t("admin.staffDataTable.updateSuccess", { count: successCount }));
      }
    },
    [apiBasePath, confirm, list],
  );

  const columns = useMemo<DataTableColumn<StaffListItem>[]>(
    () => [
      {
        id: "staff",
        header: tr("Staff Member", "স্টাফ সদস্য"),
        cell: (row) => (
          <Link
            href={`${staffBasePath}/${row._id}`}
            className="block"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={row.image} />
                <AvatarFallback>{getInitials(row.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate hover:underline">
                  {row.name || tr("Unknown", "অজানা")}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {row.email}
                </p>
              </div>
            </div>
          </Link>
        ),
        className: "w-[280px]",
      },
      {
        id: "accountStatus",
        header: tr("Account", "অ্যাকাউন্ট"),
        cell: (row) => (
          <StatusCell
            status={row.status || "active"}
            statusMap={{
              active: { label: tr("Active", "সক্রিয়"), variant: "default" },
              inactive: { label: tr("Inactive", "নিষ্ক্রিয়"), variant: "outline" },
              banned: { label: tr("Banned", "নিষিদ্ধ"), variant: "destructive" },
            }}
          />
        ),
        className: "w-[120px]",
      },
      {
        id: "staffStatus",
        header: tr("Staff Status", "স্টাফ স্ট্যাটাস"),
        cell: (row) => (
          <StatusCell
            status={
              row.staffProfile?.isActive ? "active" : "inactive"
            }
            statusMap={{
              active: { label: tr("Active", "সক্রিয়"), variant: "default" },
              inactive: { label: tr("Inactive", "নিষ্ক্রিয়"), variant: "outline" },
            }}
          />
        ),
        className: "w-[120px]",
      },
      {
        id: "department",
        header: tr("Department", "বিভাগ"),
        cell: (row) => (
          <TextCell
            value={row.staffProfile?.department || "—"}
            truncate
            maxWidth="150px"
          />
        ),
        className: "w-[150px]",
      },
      {
        id: "permissions",
        header: tr("Permissions", "পারমিশন"),
        cell: (row) => {
          const perms = row.staffProfile?.permissions || [];
          if (perms.length === 0) return <span className="text-muted-foreground">{tr("None", "কোনোটি নয়")}</span>;
          const shown = perms.slice(0, 3);
          const remaining = perms.length - shown.length;
          return (
            <div className="flex flex-wrap gap-1">
              {shown.map((p) => (
                <Badge key={p} variant="secondary" className="text-xs">
                  {tr(PERMISSION_LABELS[p] || p)}
                </Badge>
              ))}
              {remaining > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{remaining}
                </Badge>
              )}
            </div>
          );
        },
        className: "w-[250px]",
      },
      {
        id: "joined",
        header: tr("Joined", "যোগদানের তারিখ"),
        cell: (row) => (
          <DateCell date={row.createdAt} format="relative" />
        ),
        className: "w-[130px]",
      },
    ],
    [locale],
  );

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { id: "all", label: tr("All", "সব") },
      { id: "active", label: tr("Active", "সক্রিয়") },
      { id: "inactive", label: tr("Inactive", "নিষ্ক্রিয়") },
      { id: "banned", label: tr("Banned", "নিষিদ্ধ") },
    ],
    [locale],
  );

  const tableHeader = useMemo(
    () =>
      buildAdminCommerceTableHeader({
        title: tr("Staff Members", "স্টাফ সদস্য"),
        addAction: {
          id: "add",
          label: tr("Add staff", "স্টাফ যোগ করুন"),
          href: `${staffBasePath}/new`,
          icon: <Plus className="h-4 w-4" />,
          variant: "default",
        },
        importExportAction: {
          id: "import-export",
          label: t("admin.productsDataTable.actions.importExport"),
          icon: <ChevronsUpDown className="h-4 w-4" />,
          variant: "outline",
          items: [
            {
              id: "toolbar-export",
              label: tr("Export", "এক্সপোর্ট"),
              icon: <Download className="h-4 w-4" />,
              disabled: true,
            },
            {
              id: "toolbar-import",
              label: t("admin.productsDataTable.actions.import"),
              icon: <Upload className="h-4 w-4" />,
              disabled: true,
            },
          ],
        },
      }),
    [locale, t],
  );

  const bulkActions = useMemo<DataTableBulkAction<StaffListItem>[]>(
    () => [
      {
        id: "set-active",
        label: tr("Set active", "সক্রিয় করুন"),
        icon: <UserCheck className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkStatusUpdate(items, "active"),
      },
      {
        id: "set-inactive",
        label: tr("Set inactive", "নিষ্ক্রিয় করুন"),
        icon: <UserMinus className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkStatusUpdate(items, "inactive"),
      },
      {
        id: "set-banned",
        label: tr("Ban", "নিষিদ্ধ করুন"),
        icon: <ShieldBan className="h-4 w-4" />,
        variant: "destructive",
        onClick: (items) => handleBulkStatusUpdate(items, "banned"),
      },
      {
        id: "delete",
        label: tr("Remove", "অপসারণ"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: handleBulkDelete,
      },
    ],
    [handleBulkDelete, handleBulkStatusUpdate, locale],
  );

  const rowActions = useCallback(
    (row: StaffListItem): DataTableAction[] => [
      {
        id: "view",
        label: tr("View details", "বিস্তারিত দেখুন"),
        icon: <Eye className="h-4 w-4" />,
        href: `${staffBasePath}/${row._id}`,
      },
      {
        id: "edit",
        label: tr("Edit", "এডিট"),
        icon: <Pencil className="h-4 w-4" />,
        href: `${staffBasePath}/${row._id}`,
      },
      {
        id: "delete",
        label: tr("Remove from staff", "স্টাফ থেকে অপসারণ"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: () => handleDelete(row),
      },
    ],
    [handleDelete, locale],
  );

  return (
    <DataTable
      data={list.items}
      columns={columns}
      keyField="_id"
      isLoading={list.isLoading}
      loadingMode="rows"
      title={tableHeader.title}
      tabs={tabs}
      activeTab={list.activeTab}
      onTabChange={list.handleTabChange}
      actions={tableHeader.actions}
      selectable
      selectedItems={selectedStaff}
      onSelectionChange={setSelectedStaff}
      bulkActions={bulkActions}
      searchable
      searchPlaceholder={tr("Search by name or email", "নাম বা ইমেইল দিয়ে খুঁজুন")}
      searchValue={list.search}
      onSearchChange={list.handleSearchChange}
      toolbarActions={tableHeader.toolbarActions}
      toolbarLayout={tableHeader.toolbarLayout}
      tabsVariant={tableHeader.tabsVariant}
      filtersVariant={tableHeader.filtersVariant}
      appearance={tableHeader.appearance}
      stackedTopControls={tableHeader.stackedTopControls}
      showToolbarSortButton={tableHeader.showToolbarSortButton}
      pagination={list.pagination}
      onPageChange={list.handlePageChange}
      onPageSizeChange={list.handlePageSizeChange}
      rowActions={rowActions}
      rowActionsHeader={tr("Actions", "অ্যাকশন")}
      rowActionsVariant="inline-soft"
      onRowClick={(row) =>
        router.push(`${staffBasePath}/${row._id}`)
      }
      emptyMessage={tr("No staff members found", "কোনো স্টাফ সদস্য পাওয়া যায়নি")}
    />
  );
}
