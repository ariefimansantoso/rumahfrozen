"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Settings } from "@/components/admin/settings/types";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

type ShippingSettings = Settings["shipping"];
type ShippingRate = ShippingSettings["zones"][number]["rates"][number];

function newId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function formatCsv(values: string[] | undefined) {
  return Array.isArray(values) ? values.join(", ") : "";
}

export function ShippingSettingsTab(props: {
  shipping: ShippingSettings;
  isSaving: boolean;
  isDirty: boolean;
  updateField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const tSafe = (
    key: string,
    fallback: string,
    values?: Record<string, string | number | Date>,
  ) => {
    try {
      const res = values ? t(key, values) : t(key);
      return typeof res === "string" && res !== key ? res : fallback;
    } catch {
      return fallback;
    }
  };

  const shipping = props.shipping;
  const zones = Array.isArray(shipping.zones) ? shipping.zones : [];

  const origin = shipping.origin || {
    country: "",
    state: "",
    city: "",
    postalCode: "",
    address1: "",
    address2: "",
  };

  const delivery = shipping.delivery || {
    processingDaysMin: 0,
    processingDaysMax: 0,
    showEstimatedDelivery: true,
  };

  const fallbackRate = shipping.fallbackRate || {
    enabled: false,
    name: "Standard",
    price: 0,
  };

  const localPickup = shipping.localPickup || {
    enabled: false,
    pickupAddress: "",
    instructions: "",
  };

  const customs = shipping.customs || {
    enabled: false,
    dutyMode: "DDU" as const,
  };

  const vendorShipping = shipping.vendorShipping || { enabled: false };

  const weightUnit = shipping.weightUnit || "kg";

  const setZones = (nextZones: ShippingSettings["zones"]) => {
    props.updateField("shipping.zones", nextZones);
  };

  const updateZone = (
    zoneId: string,
    patch: Partial<(typeof zones)[number]>,
  ) => {
    setZones(zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z)));
  };

  const removeZone = (zoneId: string) => {
    setZones(zones.filter((z) => z.id !== zoneId));
  };

  const addZone = () => {
    setZones([
      ...zones,
      { id: newId(), name: "", countries: [], regions: [], rates: [] },
    ]);
  };

  const addRate = (zoneId: string) => {
    updateZone(zoneId, {
      rates: [
        ...(zones.find((z) => z.id === zoneId)?.rates || []),
        {
          id: newId(),
          name: "Standard",
          type: "flat",
          price: 0,
          active: true,
        },
      ],
    });
  };

  const updateRate = (
    zoneId: string,
    rateId: string,
    patch: Partial<(typeof zones)[number]["rates"][number]>,
  ) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    updateZone(zoneId, {
      rates: (zone.rates || []).map((r) =>
        r.id === rateId ? { ...r, ...patch } : r,
      ),
    });
  };

  const removeRate = (zoneId: string, rateId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    updateZone(zoneId, {
      rates: (zone.rates || []).filter((r) => r.id !== rateId),
    });
  };

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={tSafe("admin.settings.shipping.title", "Shipping & Delivery")}
        description={tSafe(
          "admin.settings.shipping.description",
          "Configure shipping zones, rates, and delivery estimates like Shopify.",
        )}
      />
      <Card>
        <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium">
              {tSafe(
                "admin.settings.shipping.enable.label",
                "Enable shipping rates",
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {tSafe(
                "admin.settings.shipping.enable.help",
                "When enabled, checkout uses your shipping zones and rates. Otherwise it falls back to flat shipping in Order Settings.",
              )}
            </p>
          </div>
          <Switch
            checked={Boolean(shipping.enabled)}
            onCheckedChange={(v) => props.updateField("shipping.enabled", v)}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium">
              {tSafe("admin.settings.shipping.weightUnit.label", "Weight unit")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tSafe(
                "admin.settings.shipping.weightUnit.help",
                "Unit used for product weights and weight-based shipping rates.",
              )}
            </p>
          </div>
          <Select
            value={weightUnit}
            onValueChange={(v) => props.updateField("shipping.weightUnit", v)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">
                {tSafe("admin.settings.shipping.weightUnit.kg", "Kilograms (kg)")}
              </SelectItem>
              <SelectItem value="lb">
                {tSafe("admin.settings.shipping.weightUnit.lb", "Pounds (lb)")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <p className="font-medium">
              {tSafe("admin.settings.shipping.origin.title", "Shipping origin")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tSafe(
                "admin.settings.shipping.origin.description",
                "Used for operational reference and future carrier integrations.",
              )}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shippingOriginCountry">
                {tSafe("admin.settings.shipping.origin.country", "Country")}
              </Label>
              <Input
                id="shippingOriginCountry"
                value={origin.country || ""}
                onChange={(e) =>
                  props.updateField("shipping.origin.country", e.target.value)
                }
                placeholder={tSafe(
                  "admin.settings.shipping.origin.countryPlaceholder",
                  "United States",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingOriginState">
                {tSafe(
                  "admin.settings.shipping.origin.state",
                  "State / Province",
                )}
              </Label>
              <Input
                id="shippingOriginState"
                value={origin.state || ""}
                onChange={(e) =>
                  props.updateField("shipping.origin.state", e.target.value)
                }
                placeholder={tSafe(
                  "admin.settings.shipping.origin.statePlaceholder",
                  "CA",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingOriginCity">
                {tSafe("admin.settings.shipping.origin.city", "City")}
              </Label>
              <Input
                id="shippingOriginCity"
                value={origin.city || ""}
                onChange={(e) =>
                  props.updateField("shipping.origin.city", e.target.value)
                }
                placeholder={tSafe(
                  "admin.settings.shipping.origin.cityPlaceholder",
                  "San Francisco",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingOriginPostalCode">
                {tSafe(
                  "admin.settings.shipping.origin.postalCode",
                  "Postal code",
                )}
              </Label>
              <Input
                id="shippingOriginPostalCode"
                value={origin.postalCode || ""}
                onChange={(e) =>
                  props.updateField(
                    "shipping.origin.postalCode",
                    e.target.value,
                  )
                }
                placeholder={tSafe(
                  "admin.settings.shipping.origin.postalCodePlaceholder",
                  "94105",
                )}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="shippingOriginAddress1">
                {tSafe(
                  "admin.settings.shipping.origin.address1",
                  "Address line 1",
                )}
              </Label>
              <Input
                id="shippingOriginAddress1"
                value={origin.address1 || ""}
                onChange={(e) =>
                  props.updateField("shipping.origin.address1", e.target.value)
                }
                placeholder={tSafe(
                  "admin.settings.shipping.origin.address1Placeholder",
                  "123 Market St",
                )}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="shippingOriginAddress2">
                {tSafe(
                  "admin.settings.shipping.origin.address2",
                  "Address line 2",
                )}
              </Label>
              <Input
                id="shippingOriginAddress2"
                value={origin.address2 || ""}
                onChange={(e) =>
                  props.updateField("shipping.origin.address2", e.target.value)
                }
                placeholder={tSafe(
                  "admin.settings.shipping.origin.address2Placeholder",
                  "Suite 100 (optional)",
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <p className="font-medium">
              {tSafe(
                "admin.settings.shipping.delivery.title",
                "Delivery estimates",
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {tSafe(
                "admin.settings.shipping.delivery.description",
                "Set processing time that will be added to rate delivery times when displayed.",
              )}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="processingDaysMin">
                {tSafe(
                  "admin.settings.shipping.delivery.processingMin",
                  "Processing days (min)",
                )}
              </Label>
              <Input
                id="processingDaysMin"
                type="number"
                value={delivery.processingDaysMin ?? 0}
                onChange={(e) =>
                  props.updateField(
                    "shipping.delivery.processingDaysMin",
                    Number(e.target.value),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processingDaysMax">
                {tSafe(
                  "admin.settings.shipping.delivery.processingMax",
                  "Processing days (max)",
                )}
              </Label>
              <Input
                id="processingDaysMax"
                type="number"
                value={delivery.processingDaysMax ?? 0}
                onChange={(e) =>
                  props.updateField(
                    "shipping.delivery.processingDaysMax",
                    Number(e.target.value),
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between md:col-span-1">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {tSafe(
                    "admin.settings.shipping.delivery.showEstimated",
                    "Show estimates in checkout",
                  )}
                </p>
              </div>
              <Switch
                checked={delivery.showEstimatedDelivery ?? true}
                onCheckedChange={(v) =>
                  props.updateField(
                    "shipping.delivery.showEstimatedDelivery",
                    v,
                  )
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                {tSafe("admin.settings.shipping.zones.title", "Shipping zones")}
              </p>
              <p className="text-sm text-muted-foreground">
                {tSafe(
                  "admin.settings.shipping.zones.description",
                  "Create zones and define rates. Select countries from the list; regions are comma-separated and matched case-insensitively against the customer address.",
                )}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addZone}>
              <Plus className="h-4 w-4 mr-2" />
              {tSafe("admin.settings.shipping.zones.add", "Add zone")}
            </Button>
          </div>

          <div className="space-y-6">
            {zones.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {tSafe(
                  "admin.settings.shipping.zones.empty",
                  "No zones yet. Add a zone to start configuring shipping rates.",
                )}
              </div>
            ) : null}

            {zones.map((zone) => (
              <div key={zone.id} className="rounded-lg border p-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor={`zoneName-${zone.id}`}>
                      {tSafe("admin.settings.shipping.zone.name", "Zone name")}
                    </Label>
                    <Input
                      id={`zoneName-${zone.id}`}
                      value={zone.name}
                      onChange={(e) =>
                        updateZone(zone.id, { name: e.target.value })
                      }
                      placeholder={tSafe(
                        "admin.settings.shipping.zone.namePlaceholder",
                        "Domestic",
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeZone(zone.id)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {tSafe("admin.settings.shipping.zone.remove", "Remove")}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`zoneCountries-${zone.id}`}>
                      {tSafe(
                        "admin.settings.shipping.zone.countries",
                        "Countries",
                      )}
                    </Label>
                    <CountryMultiSelect
                      id={`zoneCountries-${zone.id}`}
                      value={zone.countries || []}
                      onChange={(countries) =>
                        updateZone(zone.id, {
                          countries,
                        })
                      }
                      placeholder={tSafe(
                        "admin.settings.shipping.zone.countriesPlaceholder",
                        "Select countries",
                      )}
                      searchPlaceholder={tSafe(
                        "admin.settings.shipping.zone.searchCountries",
                        "Search countries...",
                      )}
                      emptyText={tSafe(
                        "admin.settings.shipping.zone.noCountryMatches",
                        "No countries found.",
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`zoneRegions-${zone.id}`}>
                      {tSafe(
                        "admin.settings.shipping.zone.regions",
                        "Regions (optional)",
                      )}
                    </Label>
                    <Textarea
                      id={`zoneRegions-${zone.id}`}
                      value={formatCsv(zone.regions)}
                      onChange={(e) =>
                        updateZone(zone.id, {
                          regions: parseCsv(e.target.value),
                        })
                      }
                      placeholder={tSafe(
                        "admin.settings.shipping.zone.regionsPlaceholder",
                        "CA, NY, TX",
                      )}
                      rows={3}
                    />
                  </div>
                </div>

                {(!zone.countries || zone.countries.length === 0) && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-400">
                    {tSafe(
                      "admin.settings.shipping.zone.noCountriesWarning",
                      "⚠️ This zone has no countries configured. It will not match any customer addresses and the fallback rate will be used instead.",
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">
                    {tSafe("admin.settings.shipping.rates.title", "Rates")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addRate(zone.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {tSafe("admin.settings.shipping.rates.add", "Add rate")}
                  </Button>
                </div>

                <div className="space-y-3">
                  {(zone.rates || []).length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      {tSafe(
                        "admin.settings.shipping.rates.empty",
                        "No rates in this zone yet. Add a rate (e.g., Standard or Express).",
                      )}
                    </div>
                  ) : null}

                  {(zone.rates || []).map((rate) => (
                    <div
                      key={rate.id}
                      className="rounded-md border p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`rateName-${rate.id}`}>
                              {tSafe(
                                "admin.settings.shipping.rate.name",
                                "Rate name",
                              )}
                            </Label>
                            <Input
                              id={`rateName-${rate.id}`}
                              value={rate.name}
                              onChange={(e) =>
                                updateRate(zone.id, rate.id, {
                                  name: e.target.value,
                                })
                              }
                              placeholder={tSafe(
                                "admin.settings.shipping.rate.namePlaceholder",
                                "Standard",
                              )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`rateType-${rate.id}`}>
                              {tSafe(
                                "admin.settings.shipping.rate.typeLabel",
                                "Type",
                              )}
                            </Label>
                            <Select
                              value={rate.type}
                              onValueChange={(v) =>
                                updateRate(zone.id, rate.id, {
                                  type: v as ShippingRate["type"],
                                })
                              }
                            >
                              <SelectTrigger id={`rateType-${rate.id}`}>
                                <SelectValue
                                  placeholder={tSafe(
                                    "admin.settings.shipping.rate.typePlaceholder",
                                    "Select type",
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flat">
                                  {tSafe(
                                    "admin.settings.shipping.rate.type.flat",
                                    "Flat rate",
                                  )}
                                </SelectItem>
                                <SelectItem value="free_over">
                                  {tSafe(
                                    "admin.settings.shipping.rate.type.freeOver",
                                    "Free over subtotal",
                                  )}
                                </SelectItem>
                                <SelectItem value="subtotal_range">
                                  {tSafe(
                                    "admin.settings.shipping.rate.type.subtotalRange",
                                    "Subtotal range",
                                  )}
                                </SelectItem>
                                <SelectItem value="weight_range">
                                  {tSafe(
                                    "admin.settings.shipping.rate.type.weightRange",
                                    "Weight range",
                                  )}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeRate(zone.id, rate.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor={`ratePrice-${rate.id}`}>
                            {tSafe(
                              "admin.settings.shipping.rate.price",
                              "Price",
                            )}
                          </Label>
                          <Input
                            id={`ratePrice-${rate.id}`}
                            type="number"
                            value={rate.price ?? 0}
                            onChange={(e) =>
                              updateRate(zone.id, rate.id, {
                                price: Number(e.target.value),
                              })
                            }
                            disabled={rate.type === "free_over"}
                          />
                        </div>

                        {rate.type === "free_over" ? (
                          <div className="space-y-2">
                            <Label htmlFor={`rateFreeOver-${rate.id}`}>
                              {tSafe(
                                "admin.settings.shipping.rate.freeOver",
                                "Free over",
                              )}
                            </Label>
                            <Input
                              id={`rateFreeOver-${rate.id}`}
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
                              <Label htmlFor={`rateMinSubtotal-${rate.id}`}>
                                {tSafe(
                                  "admin.settings.shipping.rate.minSubtotal",
                                  "Min subtotal",
                                )}
                              </Label>
                              <Input
                                id={`rateMinSubtotal-${rate.id}`}
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
                              <Label htmlFor={`rateMaxSubtotal-${rate.id}`}>
                                {tSafe(
                                  "admin.settings.shipping.rate.maxSubtotal",
                                  "Max subtotal",
                                )}
                              </Label>
                              <Input
                                id={`rateMaxSubtotal-${rate.id}`}
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
                              <Label htmlFor={`rateMinWeight-${rate.id}`}>
                                {tSafe(
                                  "admin.settings.shipping.rate.minWeight",
                                  "Min weight",
                                ) + ` (${weightUnit})`}
                              </Label>
                              <Input
                                id={`rateMinWeight-${rate.id}`}
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
                              <Label htmlFor={`rateMaxWeight-${rate.id}`}>
                                {tSafe(
                                  "admin.settings.shipping.rate.maxWeight",
                                  "Max weight",
                                ) + ` (${weightUnit})`}
                              </Label>
                              <Input
                                id={`rateMaxWeight-${rate.id}`}
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
                              <Label htmlFor={`ratePerWeight-${rate.id}`}>
                                {tSafe(
                                  "admin.settings.shipping.rate.pricePerWeightUnit",
                                  "Price per",
                                ) + ` ${weightUnit}`}
                              </Label>
                              <Input
                                id={`ratePerWeight-${rate.id}`}
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
                          <Label htmlFor={`rateMinDays-${rate.id}`}>
                            {tSafe(
                              "admin.settings.shipping.rate.minDays",
                              "Delivery days (min)",
                            )}
                          </Label>
                          <Input
                            id={`rateMinDays-${rate.id}`}
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
                          <Label htmlFor={`rateMaxDays-${rate.id}`}>
                            {tSafe(
                              "admin.settings.shipping.rate.maxDays",
                              "Delivery days (max)",
                            )}
                          </Label>
                          <Input
                            id={`rateMaxDays-${rate.id}`}
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
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {tSafe(
                                "admin.settings.shipping.rate.active",
                                "Active",
                              )}
                            </p>
                          </div>
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
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <p className="font-medium">
              {tSafe("admin.settings.shipping.fallback.title", "Fallback rate")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tSafe(
                "admin.settings.shipping.fallback.description",
                "If no zone matches the address, you can apply a default rate.",
              )}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {tSafe(
                "admin.settings.shipping.fallback.enable",
                "Enable fallback rate",
              )}
            </p>
            <Switch
              checked={Boolean(fallbackRate.enabled)}
              onCheckedChange={(v) =>
                props.updateField("shipping.fallbackRate.enabled", v)
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fallbackName">
                {tSafe("admin.settings.shipping.fallback.name", "Name")}
              </Label>
              <Input
                id="fallbackName"
                value={fallbackRate.name || ""}
                onChange={(e) =>
                  props.updateField(
                    "shipping.fallbackRate.name",
                    e.target.value,
                  )
                }
                disabled={!fallbackRate.enabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallbackPrice">
                {tSafe("admin.settings.shipping.fallback.price", "Price")}
              </Label>
              <Input
                id="fallbackPrice"
                type="number"
                value={fallbackRate.price ?? 0}
                onChange={(e) =>
                  props.updateField(
                    "shipping.fallbackRate.price",
                    Number(e.target.value),
                  )
                }
                disabled={!fallbackRate.enabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallbackMinDays">
                {tSafe("admin.settings.shipping.fallback.minDays", "Min days")}
              </Label>
              <Input
                id="fallbackMinDays"
                type="number"
                value={fallbackRate.minDays ?? 0}
                onChange={(e) =>
                  props.updateField(
                    "shipping.fallbackRate.minDays",
                    Number(e.target.value),
                  )
                }
                disabled={!fallbackRate.enabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallbackMaxDays">
                {tSafe("admin.settings.shipping.fallback.maxDays", "Max days")}
              </Label>
              <Input
                id="fallbackMaxDays"
                type="number"
                value={fallbackRate.maxDays ?? 0}
                onChange={(e) =>
                  props.updateField(
                    "shipping.fallbackRate.maxDays",
                    Number(e.target.value),
                  )
                }
                disabled={!fallbackRate.enabled}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {tSafe("admin.settings.shipping.pickup.title", "Local pickup")}
              </p>
              <p className="text-sm text-muted-foreground">
                {tSafe(
                  "admin.settings.shipping.pickup.description",
                  "Offer local pickup as an alternative fulfillment method.",
                )}
              </p>
            </div>
            <Switch
              checked={Boolean(localPickup.enabled)}
              onCheckedChange={(v) =>
                props.updateField("shipping.localPickup.enabled", v)
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pickupAddress">
                {tSafe(
                  "admin.settings.shipping.pickup.address",
                  "Pickup address",
                )}
              </Label>
              <Textarea
                id="pickupAddress"
                value={localPickup.pickupAddress || ""}
                onChange={(e) =>
                  props.updateField(
                    "shipping.localPickup.pickupAddress",
                    e.target.value,
                  )
                }
                disabled={!localPickup.enabled}
                rows={2}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pickupInstructions">
                {tSafe(
                  "admin.settings.shipping.pickup.instructions",
                  "Instructions",
                )}
              </Label>
              <Textarea
                id="pickupInstructions"
                value={localPickup.instructions || ""}
                onChange={(e) =>
                  props.updateField(
                    "shipping.localPickup.instructions",
                    e.target.value,
                  )
                }
                disabled={!localPickup.enabled}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupReadyMin">
                {tSafe(
                  "admin.settings.shipping.pickup.readyMin",
                  "Ready in (min days)",
                )}
              </Label>
              <Input
                id="pickupReadyMin"
                type="number"
                value={localPickup.readyInDaysMin ?? 0}
                onChange={(e) =>
                  props.updateField(
                    "shipping.localPickup.readyInDaysMin",
                    Number(e.target.value),
                  )
                }
                disabled={!localPickup.enabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupReadyMax">
                {tSafe(
                  "admin.settings.shipping.pickup.readyMax",
                  "Ready in (max days)",
                )}
              </Label>
              <Input
                id="pickupReadyMax"
                type="number"
                value={localPickup.readyInDaysMax ?? 0}
                onChange={(e) =>
                  props.updateField(
                    "shipping.localPickup.readyInDaysMax",
                    Number(e.target.value),
                  )
                }
                disabled={!localPickup.enabled}
              />
            </div>
          </div>
        </div>

          <Separator />

          {/* Multi-vendor shipping */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {tSafe(
                    "admin.settings.shipping.vendorShipping.title",
                    "Per-vendor shipping",
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tSafe(
                    "admin.settings.shipping.vendorShipping.description",
                    "When enabled, each vendor's items in a multi-vendor cart are rated against that vendor's own shipping profile (falling back to this platform profile). Shipping is charged and allocated per vendor.",
                  )}
                </p>
              </div>
              <Switch
                checked={Boolean(vendorShipping.enabled)}
                onCheckedChange={(v) =>
                  props.updateField("shipping.vendorShipping.enabled", v)
                }
              />
            </div>
          </div>

          <Separator />

          {/* Customs & duties */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {tSafe(
                    "admin.settings.shipping.customs.title",
                    "Customs & duties",
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tSafe(
                    "admin.settings.shipping.customs.description",
                    "Handle import duties for cross-border orders. DDP collects an estimated duty at checkout; DDU/DAP leaves duties for the customer to pay on delivery.",
                  )}
                </p>
              </div>
              <Switch
                checked={Boolean(customs.enabled)}
                onCheckedChange={(v) =>
                  props.updateField("shipping.customs.enabled", v)
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(280px,1.15fr)_minmax(0,1fr)] lg:items-end">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="customsDutyMode" className="flex min-h-8 items-end">
                  {tSafe(
                    "admin.settings.shipping.customs.dutyMode",
                    "Duty handling",
                  )}
                </Label>
                <Select
                  value={customs.dutyMode || "DDU"}
                  onValueChange={(v) =>
                    props.updateField("shipping.customs.dutyMode", v)
                  }
                >
                  <SelectTrigger id="customsDutyMode" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DDU">
                      {tSafe(
                        "admin.settings.shipping.customs.ddu",
                        "DDU — customer pays on delivery",
                      )}
                    </SelectItem>
                    <SelectItem value="DDP">
                      {tSafe(
                        "admin.settings.shipping.customs.ddp",
                        "DDP — collect duties at checkout",
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2 sm:items-end">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="customsDutyRate" className="flex min-h-8 items-end">
                    {tSafe(
                      "admin.settings.shipping.customs.dutyRatePercent",
                      "Estimated duty rate (%)",
                    )}
                  </Label>
                  <Input
                    id="customsDutyRate"
                    type="number"
                    value={customs.dutyRatePercent ?? 0}
                    onChange={(e) =>
                      props.updateField(
                        "shipping.customs.dutyRatePercent",
                        Number(e.target.value),
                      )
                    }
                    disabled={!customs.enabled || customs.dutyMode !== "DDP"}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="customsDeMinimis" className="flex min-h-8 items-end">
                    {tSafe(
                      "admin.settings.shipping.customs.deMinimis",
                      "De-minimis (duty-free under)",
                    )}
                  </Label>
                  <Input
                    id="customsDeMinimis"
                    type="number"
                    value={customs.deMinimis ?? 0}
                    onChange={(e) =>
                      props.updateField(
                        "shipping.customs.deMinimis",
                        Number(e.target.value),
                      )
                    }
                    disabled={!customs.enabled || customs.dutyMode !== "DDP"}
                  />
                </div>
              </div>
            </div>
          </div>

          <StickySaveFooter
            label={tSafe("admin.settings.general.save", "Save")}
            isSaving={props.isSaving}
            isDirty={props.isDirty}
            onSave={props.onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
