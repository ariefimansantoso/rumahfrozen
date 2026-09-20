"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Loader2 } from "lucide-react";
import type { LocationInventory } from "@/types";

interface InventoryLocation {
  _id: string;
  name: string;
  address?: string;
  isDefault: boolean;
}

interface LocationInventoryManagerProps {
  value: LocationInventory[];
  onChange: (value: LocationInventory[]) => void;
  disabled?: boolean;
}

export function LocationInventoryManager({
  value,
  onChange,
  disabled = false,
}: LocationInventoryManagerProps) {
  const t = useTranslations();
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLocationName, setNewLocationName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch("/api/admin/locations");
        const data = await res.json();
        if (data.success) {
          setLocations(data.data || []);

          // Initialize inventory for any new locations not in value
          const existingIds = new Set(value.map((v) => String(v.locationId)));
          const newItems: LocationInventory[] = [];

          for (const loc of data.data || []) {
            if (!existingIds.has(String(loc._id))) {
              newItems.push({
                locationId: loc._id,
                locationName: loc.name,
                quantity: 0,
              });
            }
          }

          if (newItems.length > 0) {
            onChange([...value, ...newItems]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLocations();
  }, []);

  const handleQuantityChange = (locationId: string, quantity: number) => {
    const updated = value.map((item) =>
      String(item.locationId) === locationId
        ? { ...item, quantity: Math.max(0, quantity) }
        : item
    );

    // If location doesn't exist in value, add it
    if (!updated.some((item) => String(item.locationId) === locationId)) {
      const loc = locations.find((l) => l._id === locationId);
      if (loc) {
        updated.push({
          locationId,
          locationName: loc.name,
          quantity: Math.max(0, quantity),
        });
      }
    }

    onChange(updated);
  };

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocationName.trim() }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setLocations([...locations, data.data]);
        onChange([
          ...value,
          {
            locationId: data.data._id,
            locationName: data.data.name,
            quantity: 0,
          },
        ]);
        setNewLocationName("");
      }
    } catch (error) {
      console.error("Failed to create location:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const getQuantityForLocation = (locationId: string): number => {
    const item = value.find((v) => String(v.locationId) === locationId);
    return item?.quantity ?? 0;
  };

  const totalQuantity = value.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {t("admin.productForm.inventoryByLocation")}
          </span>
        </div>
        <Badge variant="secondary">
          {t("admin.productForm.totalQuantity", {
            total: totalQuantity,
          })}
        </Badge>
      </div>

      {locations.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
          {t("admin.productForm.noLocations")}
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((location) => (
            <div
              key={location._id}
              className="flex items-center justify-between gap-4 p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {location.name}
                  {location.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      {t("admin.productForm.defaultLocation")}
                    </Badge>
                  )}
                </div>
                {location.address && (
                  <p className="text-xs text-muted-foreground">
                    {location.address}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("admin.productForm.qty")}
                </span>
                <Input
                  type="number"
                  min="0"
                  value={getQuantityForLocation(location._id)}
                  onChange={(e) =>
                    handleQuantityChange(
                      location._id,
                      parseInt(e.target.value) || 0
                    )
                  }
                  disabled={disabled}
                  className="w-24"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new location inline */}
      <div className="flex gap-2 pt-2 border-t">
        <Input
          placeholder={t("admin.productForm.placeholders.newLocation")}
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          disabled={disabled || isCreating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreateLocation();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleCreateLocation}
          disabled={disabled || isCreating || !newLocationName.trim()}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
