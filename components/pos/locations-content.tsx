"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Star,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  DataTable,
  TextCell,
  StatusCell,
  type DataTableColumn,
  type DataTableAction,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { LocationFormDialog } from "./location-form-dialog";

interface Location {
  _id: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LocationsContentProps {
  locale: string;
}

export function LocationsContent({ locale }: LocationsContentProps) {
  const t = useTranslations();
  const { confirm } = useConfirmation();

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/locations?includeInactive=true");
      const json = await res.json();
      if (json.success) {
        setLocations(json.data || []);
      }
    } catch {
      toast.error(t("locations.fetchError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Filtered data
  const filteredData = useMemo(() => {
    let data = locations;

    if (activeTab === "active") {
      data = data.filter((l) => l.isActive);
    } else if (activeTab === "inactive") {
      data = data.filter((l) => !l.isActive);
    }

    if (searchValue) {
      const q = searchValue.toLowerCase();
      data = data.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.address?.toLowerCase().includes(q)
      );
    }

    return data;
  }, [locations, activeTab, searchValue]);

  // Counts for tabs
  const activeCount = locations.filter((l) => l.isActive).length;
  const inactiveCount = locations.filter((l) => !l.isActive).length;

  // Actions
  const handleDelete = useCallback(
    async (location: Location) => {
      if (location.isDefault) {
        toast.error(t("locations.cannotDeleteDefault"));
        return;
      }

      const confirmed = await confirm({
        title: t("locations.deleteTitle"),
        description: t("locations.deleteDescription", { name: location.name }),
        confirmText: t("common.delete"),
        cancelText: t("common.cancel"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        const res = await fetch(`/api/admin/locations/${location._id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (json.success) {
          toast.success(t("locations.deleted"));
          fetchLocations();
        } else {
          toast.error(json.message || t("locations.deleteError"));
        }
      } catch {
        toast.error(t("locations.deleteError"));
      }
    },
    [confirm, fetchLocations, t]
  );

  const handleToggleActive = useCallback(
    async (location: Location) => {
      try {
        const res = await fetch(`/api/admin/locations/${location._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !location.isActive }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(
            location.isActive
              ? t("locations.deactivated")
              : t("locations.activated")
          );
          fetchLocations();
        } else {
          toast.error(json.message);
        }
      } catch {
        toast.error(t("locations.updateError"));
      }
    },
    [fetchLocations, t]
  );

  const handleSetDefault = useCallback(
    async (location: Location) => {
      if (location.isDefault) return;

      try {
        const res = await fetch(`/api/admin/locations/${location._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(t("locations.setAsDefault"));
          fetchLocations();
        } else {
          toast.error(json.message);
        }
      } catch {
        toast.error(t("locations.updateError"));
      }
    },
    [fetchLocations, t]
  );

  const handleEdit = useCallback((location: Location) => {
    setEditingLocation(location);
    setDialogOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingLocation(null);
    setDialogOpen(true);
  }, []);

  const handleDialogSuccess = useCallback(() => {
    setDialogOpen(false);
    setEditingLocation(null);
    fetchLocations();
  }, [fetchLocations]);

  // Columns
  const columns = useMemo<DataTableColumn<Location>[]>(
    () => [
      {
        id: "name",
        header: t("locations.name"),
        cell: (row) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{row.name}</span>
                {row.isDefault && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {t("locations.default")}
                  </Badge>
                )}
              </div>
              {row.address && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {row.address}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "status",
        header: t("locations.status"),
        cell: (row) => (
          <StatusCell
            status={row.isActive ? "active" : "inactive"}
            statusMap={{
              active: { label: t("locations.active"), variant: "default" },
              inactive: { label: t("locations.inactive"), variant: "secondary" },
            }}
          />
        ),
        className: "w-[120px]",
      },
    ],
    [t]
  );

  // Tabs
  const tabs = useMemo(
    () => [
      {
        id: "all",
        label: t("locations.all"),
        count: locations.length,
      },
      {
        id: "active",
        label: t("locations.active"),
        count: activeCount,
      },
      {
        id: "inactive",
        label: t("locations.inactive"),
        count: inactiveCount,
      },
    ],
    [t, locations.length, activeCount, inactiveCount]
  );

  // Top actions
  const tableActions = useMemo<DataTableAction[]>(
    () => [
      {
        id: "add",
        label: t("locations.addLocation"),
        icon: <Plus className="h-4 w-4" />,
        onClick: handleAdd,
      },
    ],
    [t, handleAdd]
  );

  // Row actions
  const rowActions = useCallback(
    (row: Location): DataTableAction[] => {
      const actions: DataTableAction[] = [
        {
          id: "edit",
          label: t("common.edit"),
          icon: <Pencil className="h-4 w-4" />,
          onClick: () => handleEdit(row),
        },
      ];

      if (!row.isDefault) {
        actions.push({
          id: "setDefault",
          label: t("locations.setDefault"),
          icon: <Star className="h-4 w-4" />,
          onClick: () => handleSetDefault(row),
        });
      }

      actions.push({
        id: "toggle",
        label: row.isActive
          ? t("locations.deactivate")
          : t("locations.activate"),
        icon: row.isActive ? (
          <ToggleLeft className="h-4 w-4" />
        ) : (
          <ToggleRight className="h-4 w-4" />
        ),
        onClick: () => handleToggleActive(row),
      });

      if (!row.isDefault) {
        actions.push({
          id: "delete",
          label: t("common.delete"),
          icon: <Trash2 className="h-4 w-4" />,
          variant: "destructive",
          onClick: () => handleDelete(row),
        });
      }

      return actions;
    },
    [t, handleEdit, handleSetDefault, handleToggleActive, handleDelete]
  );

  return (
    <>
      <DataTable
        data={filteredData}
        columns={columns}
        keyField="_id"
        isLoading={isLoading}
        title={t("locations.title")}
        titleIcon={<MapPin className="h-5 w-5" />}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={tableActions}
        searchable
        searchPlaceholder={t("locations.searchPlaceholder")}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        rowActions={rowActions}
        rowActionsHeader={t("locations.actions")}
        emptyMessage={t("locations.empty")}
        emptyIcon={<MapPin className="h-10 w-10" />}
        dense
      />

      <LocationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingLocation(null);
        }}
        location={editingLocation}
        onSuccess={handleDialogSuccess}
      />
    </>
  );
}
