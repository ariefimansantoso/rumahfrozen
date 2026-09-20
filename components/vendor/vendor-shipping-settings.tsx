"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CountryMultiSelect } from "@/components/common/country-multi-select";
import type { VendorShippingProfile, VendorShippingRate } from "@/types";

type Profile = VendorShippingProfile;

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const parseCsv = (v: string) =>
  v.split(",").map((s) => s.trim()).filter(Boolean);
const formatCsv = (v?: string[]) => (Array.isArray(v) ? v.join(", ") : "");

export const EMPTY_VENDOR_SHIPPING: Profile = {
  enabled: false,
  weightUnit: "kg",
  delivery: {
    processingDaysMin: 0,
    processingDaysMax: 0,
    showEstimatedDelivery: true,
  },
  zones: [],
  fallbackRate: { enabled: false, name: "Standard", price: 0 },
  localPickup: { enabled: false },
};

/**
 * Controlled editor for a vendor's shipping profile. State and persistence are
 * owned by the parent (the Vendor Settings form saves it via its shared "Save
 * changes" button), so this component has no save button of its own.
 */
export function VendorShippingEditor({
  value,
  onChange,
}: {
  value: Profile;
  onChange: (next: Profile) => void;
}) {
  const profile = value;
  const weightUnit = profile.weightUnit || "kg";
  const zones = profile.zones || [];

  const patch = (p: Partial<Profile>) => onChange({ ...profile, ...p });
  const setZones = (z: Profile["zones"]) => patch({ zones: z });
  const updateZone = (id: string, p: Partial<Profile["zones"][number]>) =>
    setZones(zones.map((z) => (z.id === id ? { ...z, ...p } : z)));
  const addZone = () =>
    setZones([
      ...zones,
      { id: newId(), name: "", countries: [], regions: [], rates: [] },
    ]);
  const addRate = (zoneId: string) =>
    updateZone(zoneId, {
      rates: [
        ...(zones.find((z) => z.id === zoneId)?.rates || []),
        { id: newId(), name: "Standard", type: "flat", price: 0, active: true },
      ],
    });
  const updateRate = (
    zoneId: string,
    rateId: string,
    p: Partial<VendorShippingRate>,
  ) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    updateZone(zoneId, {
      rates: (zone.rates || []).map((r) => (r.id === rateId ? { ...r, ...p } : r)),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="font-medium">Enable my own shipping rates</p>
          <p className="text-sm text-muted-foreground">
            When enabled, your items are rated against these rules. Otherwise the
            store&apos;s platform rates apply to your items.
          </p>
        </div>
        <Switch
          checked={Boolean(profile.enabled)}
          onCheckedChange={(v) => patch({ enabled: v })}
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-medium">Weight unit</p>
          <p className="text-sm text-muted-foreground">
            Used for weight-based rates.
          </p>
        </div>
        <Select
          value={weightUnit}
          onValueChange={(v) => patch({ weightUnit: v as "kg" | "lb" })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kg">Kilograms (kg)</SelectItem>
            <SelectItem value="lb">Pounds (lb)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Shipping zones</p>
            <p className="text-sm text-muted-foreground">
              Select countries from the list; regions are comma-separated and
              matched against the customer address.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={addZone}>
            <Plus className="h-4 w-4 mr-2" /> Add zone
          </Button>
        </div>

        {zones.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No zones yet. Add a zone to start configuring rates.
          </div>
        ) : null}

        {zones.map((zone) => (
          <div key={zone.id} className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Label>Zone name</Label>
                <Input
                  value={zone.name}
                  onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                  placeholder="Domestic"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setZones(zones.filter((z) => z.id !== zone.id))}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Remove
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Countries</Label>
                <CountryMultiSelect
                  value={zone.countries || []}
                  onChange={(countries) =>
                    updateZone(zone.id, { countries })
                  }
                  placeholder="Select countries"
                />
              </div>
              <div className="space-y-2">
                <Label>Regions (optional)</Label>
                <Textarea
                  value={formatCsv(zone.regions)}
                  onChange={(e) =>
                    updateZone(zone.id, { regions: parseCsv(e.target.value) })
                  }
                  placeholder="CA, NY, TX"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">Rates</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => addRate(zone.id)}
              >
                <Plus className="h-4 w-4 mr-2" /> Add rate
              </Button>
            </div>

            {(zone.rates || []).map((rate) => (
              <div key={rate.id} className="rounded-md border p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Rate name</Label>
                      <Input
                        value={rate.name}
                        onChange={(e) =>
                          updateRate(zone.id, rate.id, { name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={rate.type}
                        onValueChange={(v) =>
                          updateRate(zone.id, rate.id, {
                            type: v as VendorShippingRate["type"],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat rate</SelectItem>
                          <SelectItem value="free_over">
                            Free over subtotal
                          </SelectItem>
                          <SelectItem value="subtotal_range">
                            Subtotal range
                          </SelectItem>
                          <SelectItem value="weight_range">Weight range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      updateZone(zone.id, {
                        rates: (zone.rates || []).filter((r) => r.id !== rate.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input
                      type="number"
                      value={rate.price ?? 0}
                      disabled={rate.type === "free_over"}
                      onChange={(e) =>
                        updateRate(zone.id, rate.id, {
                          price: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  {rate.type === "free_over" ? (
                    <div className="space-y-2">
                      <Label>Free over</Label>
                      <Input
                        type="number"
                        value={rate.freeOver ?? 0}
                        onChange={(e) =>
                          updateRate(zone.id, rate.id, {
                            freeOver: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {rate.type === "subtotal_range" ? (
                    <>
                      <div className="space-y-2">
                        <Label>Min subtotal</Label>
                        <Input
                          type="number"
                          value={rate.minSubtotal ?? 0}
                          onChange={(e) =>
                            updateRate(zone.id, rate.id, {
                              minSubtotal: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max subtotal</Label>
                        <Input
                          type="number"
                          value={rate.maxSubtotal ?? 0}
                          onChange={(e) =>
                            updateRate(zone.id, rate.id, {
                              maxSubtotal: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </>
                  ) : null}

                  {rate.type === "weight_range" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{`Min weight (${weightUnit})`}</Label>
                        <Input
                          type="number"
                          value={rate.minWeight ?? 0}
                          onChange={(e) =>
                            updateRate(zone.id, rate.id, {
                              minWeight: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{`Max weight (${weightUnit})`}</Label>
                        <Input
                          type="number"
                          value={rate.maxWeight ?? 0}
                          onChange={(e) =>
                            updateRate(zone.id, rate.id, {
                              maxWeight: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{`Price per ${weightUnit}`}</Label>
                        <Input
                          type="number"
                          value={rate.pricePerWeightUnit ?? 0}
                          onChange={(e) =>
                            updateRate(zone.id, rate.id, {
                              pricePerWeightUnit: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Delivery days (min)</Label>
                    <Input
                      type="number"
                      value={rate.minDays ?? 0}
                      onChange={(e) =>
                        updateRate(zone.id, rate.id, {
                          minDays: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery days (max)</Label>
                    <Input
                      type="number"
                      value={rate.maxDays ?? 0}
                      onChange={(e) =>
                        updateRate(zone.id, rate.id, {
                          maxDays: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between md:col-span-2">
                    <p className="text-sm font-medium">Active</p>
                    <Switch
                      checked={rate.active ?? true}
                      onCheckedChange={(v) =>
                        updateRate(zone.id, rate.id, { active: v })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">Fallback rate</p>
          <Switch
            checked={Boolean(profile.fallbackRate?.enabled)}
            onCheckedChange={(v) =>
              patch({
                fallbackRate: {
                  ...(profile.fallbackRate || { name: "Standard", price: 0 }),
                  enabled: v,
                },
              })
            }
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={profile.fallbackRate?.name || ""}
              disabled={!profile.fallbackRate?.enabled}
              onChange={(e) =>
                patch({
                  fallbackRate: {
                    ...(profile.fallbackRate || { enabled: true, price: 0 }),
                    name: e.target.value,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Price</Label>
            <Input
              type="number"
              value={profile.fallbackRate?.price ?? 0}
              disabled={!profile.fallbackRate?.enabled}
              onChange={(e) =>
                patch({
                  fallbackRate: {
                    ...(profile.fallbackRate || {
                      enabled: true,
                      name: "Standard",
                    }),
                    price: Number(e.target.value),
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Local pickup</p>
            <p className="text-sm text-muted-foreground">
              Offer local pickup as an alternative to delivery.
            </p>
          </div>
          <Switch
            checked={Boolean(profile.localPickup?.enabled)}
            onCheckedChange={(v) =>
              patch({
                localPickup: { ...(profile.localPickup || {}), enabled: v },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Pickup address</Label>
          <Textarea
            value={profile.localPickup?.pickupAddress || ""}
            disabled={!profile.localPickup?.enabled}
            rows={2}
            onChange={(e) =>
              patch({
                localPickup: {
                  ...(profile.localPickup || { enabled: true }),
                  pickupAddress: e.target.value,
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
