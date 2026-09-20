"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Check,
  X,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SettingsTabHeader } from "./settings-tab-header";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { apiClient } from "@/lib/api/client";

interface InventoryLocation {
  _id: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface NewLocationForm {
  name: string;
  address: string;
  isDefault: boolean;
}

export function LocationsSettingsTab() {
  const t = useTranslations();
  const { confirm } = useConfirmation();
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryLocation>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocation, setNewLocation] = useState<NewLocationForm>({
    name: "",
    address: "",
    isDefault: false,
  });

  const tSafe = (key: string, fallback: string) => {
    try {
      const result = t(key as Parameters<typeof t>[0]);
      return typeof result === "string" && result !== key ? result : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    try {
      setIsLoading(true);
      const data = await apiClient.get<InventoryLocation[]>(
        "/api/admin/locations?includeInactive=true",
      );
      setLocations(data || []);
    } catch (error) {
      console.error("Failed to fetch locations:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch locations",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!newLocation.name.trim()) {
      toast.error("Location name is required");
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post("/api/admin/locations", newLocation);
      toast.success("Location created successfully");
      setNewLocation({ name: "", address: "", isDefault: false });
      setShowAddForm(false);
      await fetchLocations();
    } catch (error) {
      console.error("Failed to create location:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create location",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editForm.name?.trim()) {
      toast.error("Location name is required");
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.put(`/api/admin/locations/${id}`, editForm);
      toast.success("Location updated successfully");
      setEditingId(null);
      setEditForm({});
      await fetchLocations();
    } catch (error) {
      console.error("Failed to update location:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update location",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Delete Location",
      description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      confirmVariant: "destructive",
    });

    if (!ok) return;

    setIsSaving(true);
    try {
      await apiClient.delete(`/api/admin/locations/${id}`);
      toast.success("Location deleted successfully");
      await fetchLocations();
    } catch (error) {
      console.error("Failed to delete location:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete location",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    setIsSaving(true);
    try {
      await apiClient.put(`/api/admin/locations/${id}`, { isDefault: true });
      toast.success("Default location updated");
      await fetchLocations();
    } catch (error) {
      console.error("Failed to set default:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to set default location",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(id: string, nextActive: boolean) {
    setIsSaving(true);
    try {
      await apiClient.put(`/api/admin/locations/${id}`, {
        isActive: nextActive,
      });
      toast.success(`Location ${nextActive ? "activated" : "deactivated"}`);
      await fetchLocations();
    } catch (error) {
      console.error("Failed to toggle active:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update location",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(location: InventoryLocation) {
    setEditingId(location._id);
    setEditForm({
      name: location.name,
      address: location.address || "",
      isDefault: location.isDefault,
      isActive: location.isActive,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader
          title={tSafe("admin.settings.locations.title", "Inventory Locations")}
          description={tSafe(
            "admin.settings.locations.description",
            "Manage warehouse and store locations for inventory tracking"
          )}
        />
        <Card>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={tSafe("admin.settings.locations.title", "Inventory Locations")}
        description={tSafe(
          "admin.settings.locations.description",
          "Manage warehouse and store locations for inventory tracking"
        )}
      />
      <Card>
        <CardContent className="space-y-6">
        {/* Add New Location Section */}
        {!showAddForm ? (
          <Button
            onClick={() => setShowAddForm(true)}
            variant="outline"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {tSafe("admin.settings.locations.add", "Add New Location")}
          </Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {tSafe("admin.settings.locations.new", "New Location")}
              </h4>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowAddForm(false);
                  setNewLocation({ name: "", address: "", isDefault: false });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-name">
                  {tSafe("admin.settings.locations.name", "Location Name")} *
                </Label>
                <Input
                  id="new-name"
                  value={newLocation.name}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, name: e.target.value })
                  }
                  placeholder="e.g., Main Warehouse"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-address">
                  {tSafe("admin.settings.locations.address", "Address")}
                </Label>
                <Input
                  id="new-address"
                  value={newLocation.address}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, address: e.target.value })
                  }
                  placeholder="e.g., 123 Main St, City"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="new-default"
                  checked={newLocation.isDefault}
                  onCheckedChange={(v) =>
                    setNewLocation({ ...newLocation, isDefault: v })
                  }
                />
                <Label htmlFor="new-default" className="text-sm">
                  {tSafe(
                    "admin.settings.locations.setAsDefault",
                    "Set as default location"
                  )}
                </Label>
              </div>
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {tSafe("admin.settings.locations.create", "Create Location")}
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Locations List */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">
            {tSafe("admin.settings.locations.existing", "Existing Locations")} (
            {locations.length})
          </h4>

          {locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>
                {tSafe(
                  "admin.settings.locations.empty",
                  "No locations configured yet"
                )}
              </p>
              <p className="text-sm mt-1">
                {tSafe(
                  "admin.settings.locations.emptyHint",
                  "Add your first location to start tracking inventory across multiple places"
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {locations.map((location) => (
                <div
                  key={location._id}
                  className={`border rounded-lg p-4 transition-colors ${
                    !location.isActive ? "opacity-60 bg-muted/30" : ""
                  }`}
                >
                  {editingId === location._id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>
                            {tSafe(
                              "admin.settings.locations.name",
                              "Location Name"
                            )}{" "}
                            *
                          </Label>
                          <Input
                            value={editForm.name || ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {tSafe(
                              "admin.settings.locations.address",
                              "Address"
                            )}
                          </Label>
                          <Input
                            value={editForm.address || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editForm.isActive ?? true}
                              onCheckedChange={(v) =>
                                setEditForm({ ...editForm, isActive: v })
                              }
                            />
                            <Label className="text-sm">
                              {tSafe(
                                "admin.settings.locations.active",
                                "Active"
                              )}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editForm.isDefault ?? false}
                              onCheckedChange={(v) =>
                                setEditForm({ ...editForm, isDefault: v })
                              }
                            />
                            <Label className="text-sm">
                              {tSafe(
                                "admin.settings.locations.default",
                                "Default"
                              )}
                            </Label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {tSafe("common.cancel", "Cancel")}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdate(location._id)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            {tSafe("common.save", "Save")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{location.name}</span>
                          {location.isDefault && (
                            <Badge
                              variant="secondary"
                              className="text-xs gap-1"
                            >
                              <Star className="h-3 w-3" />
                              {tSafe(
                                "admin.settings.locations.defaultBadge",
                                "Default"
                              )}
                            </Badge>
                          )}
                          {!location.isActive && (
                            <Badge variant="outline" className="text-xs">
                              {tSafe(
                                "admin.settings.locations.inactive",
                                "Inactive"
                              )}
                            </Badge>
                          )}
                        </div>
                        {location.address && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {location.address}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!location.isDefault && location.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(location._id)}
                            disabled={isSaving}
                            title="Set as default"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={location.isActive}
                          onCheckedChange={(checked) =>
                            handleToggleActive(location._id, checked)
                          }
                          disabled={isSaving}
                          title={location.isActive ? "Deactivate" : "Activate"}
                          aria-label={
                            location.isActive
                              ? "Deactivate location"
                              : "Activate location"
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(location)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleDelete(location._id, location.name)
                          }
                          disabled={isSaving || location.isDefault}
                          title={
                            location.isDefault
                              ? "Cannot delete default location"
                              : "Delete"
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <h5 className="font-medium text-foreground mb-2">
            {tSafe("admin.settings.locations.infoTitle", "About Locations")}
          </h5>
          <ul className="list-disc list-inside space-y-1">
            <li>
              {tSafe(
                "admin.settings.locations.info1",
                "Locations are used to track inventory across multiple warehouses or stores"
              )}
            </li>
            <li>
              {tSafe(
                "admin.settings.locations.info2",
                "The default location is used for POS sales and new inventory"
              )}
            </li>
            <li>
              {tSafe(
                "admin.settings.locations.info3",
                "Inactive locations won't appear in product inventory forms"
              )}
            </li>
            <li>
              {tSafe(
                "admin.settings.locations.info4",
                "You cannot delete a location that is set as default"
              )}
            </li>
          </ul>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
