"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LocationItem {
  _id: string;
  name: string;
}

interface CatalogItem {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  availableAtSource: number;
}

export function TransferCreateForm({ locale }: { locale: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationTarget, setLocationTarget] = useState<"from" | "to">("from");
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [creatingLocation, setCreatingLocation] = useState(false);

  const loadLocations = async () => {
    try {
      const res = await fetch("/api/admin/locations");
      const json = await res.json();
      if (json.success) {
        const rows = Array.isArray(json.data) ? json.data : [];
        setLocations(
          rows.map((row: { _id: string; name: string }) => ({
            _id: String(row._id),
            name: row.name,
          })),
        );
      }
    } catch {
      toast.error(t("admin.transfers.create.toasts.loadLocationsError"));
    }
  };

  useEffect(() => {
    void loadLocations();
  }, []);

  useEffect(() => {
    if (!fromLocationId) {
      setCatalog([]);
      return;
    }

    let ignore = false;
    const run = async () => {
      setLoadingCatalog(true);
      try {
        const params = new URLSearchParams({ fromLocationId });
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(
          `/api/admin/transfers/catalog?${params.toString()}`,
        );
        const json = await res.json();
        if (!ignore && json.success) {
          const rows = json.data?.items;
          setCatalog(Array.isArray(rows) ? rows : []);
        }
      } finally {
        if (!ignore) setLoadingCatalog(false);
      }
    };

    void run();
    return () => {
      ignore = true;
    };
  }, [fromLocationId, search]);

  const selectedItems = useMemo(() => {
    return catalog
      .map((item) => {
        const key = `${item.productId}:${item.variantId}`;
        const qty = Math.max(0, Number(quantities[key] || 0));
        return { item, qty, key };
      })
      .filter((entry) => entry.qty > 0);
  }, [catalog, quantities]);

  const handleCreate = async () => {
    if (!fromLocationId || !toLocationId) {
      toast.error(t("admin.transfers.create.toasts.selectBothLocations"));
      return;
    }

    if (fromLocationId === toLocationId) {
      toast.error(t("admin.transfers.create.toasts.locationsMustDiffer"));
      return;
    }

    if (!selectedItems.length) {
      toast.error(t("admin.transfers.create.toasts.selectItems"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fromLocationId,
        toLocationId,
        reference,
        note,
        items: selectedItems.map((entry) => ({
          productId: entry.item.productId,
          variantId: entry.item.variantId,
          quantity: entry.qty,
          productTitle: entry.item.productTitle,
          variantTitle: entry.item.variantTitle,
          sku: entry.item.sku,
        })),
      };

      const res = await fetch("/api/admin/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(
          json.message || t("admin.transfers.create.toasts.createError"),
        );
      }

      toast.success(t("admin.transfers.create.toasts.createSuccess"));
      const transferId = json.data?.transferId;
      if (transferId) {
        router.push(`/${locale}/admin/transfers/${transferId}`);
      } else {
        router.push(`/${locale}/admin/transfers`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.transfers.create.toasts.createError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const openLocationDialog = (target: "from" | "to") => {
    setLocationTarget(target);
    setNewLocationName("");
    setNewLocationAddress("");
    setLocationDialogOpen(true);
  };

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      toast.error(t("admin.transfers.create.toasts.locationNameRequired"));
      return;
    }

    setCreatingLocation(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLocationName.trim(),
          address: newLocationAddress.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(
          json.message ||
            t("admin.transfers.create.toasts.createLocationError"),
        );
      }

      const createdId = String(json.data?._id || "");
      await loadLocations();
      if (createdId) {
        if (locationTarget === "from") {
          setFromLocationId(createdId);
        } else {
          setToLocationId(createdId);
        }
      }
      setLocationDialogOpen(false);
      toast.success(t("admin.transfers.create.toasts.createLocationSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.transfers.create.toasts.createLocationError"),
      );
    } finally {
      setCreatingLocation(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={t("admin.transfers.create.title")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${locale}/admin/transfers`)}
            >
              {t("admin.transfers.create.cancel")}
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("admin.transfers.create.createTransfer")}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {t("admin.transfers.create.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="from-location">
                  {t("admin.transfers.create.fromLocation")}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openLocationDialog("from")}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("admin.transfers.create.addLocation")}
                </Button>
              </div>
              <select
                id="from-location"
                value={fromLocationId}
                onChange={(event) => setFromLocationId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {t("admin.transfers.create.selectSourceLocation")}
                </option>
                {locations.map((location) => (
                  <option key={location._id} value={location._id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="to-location">
                  {t("admin.transfers.create.toLocation")}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openLocationDialog("to")}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("admin.transfers.create.addLocation")}
                </Button>
              </div>
              <select
                id="to-location"
                value={toLocationId}
                onChange={(event) => setToLocationId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {t("admin.transfers.create.selectDestinationLocation")}
                </option>
                {locations.map((location) => (
                  <option key={location._id} value={location._id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reference">
                {t("admin.transfers.create.reference")}
              </Label>
              <Input
                id="reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={t("admin.transfers.create.referencePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">
                {t("admin.transfers.create.internalNote")}
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t(
                  "admin.transfers.create.internalNotePlaceholder",
                )}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin.transfers.create.searchPlaceholder")}
                className="pl-9"
                disabled={!fromLocationId}
              />
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">
                      {t("admin.transfers.create.columns.product")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.transfers.create.columns.variant")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.transfers.create.columns.sku")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.transfers.create.columns.available")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.transfers.create.columns.transferQty")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!fromLocationId ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        {t("admin.transfers.create.selectSourceToLoad")}
                      </td>
                    </tr>
                  ) : loadingCatalog ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                        {t("admin.transfers.create.loadingInventory")}
                      </td>
                    </tr>
                  ) : catalog.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        {t("admin.transfers.create.noVariants")}
                      </td>
                    </tr>
                  ) : (
                    catalog.map((row) => {
                      const key = `${row.productId}:${row.variantId}`;
                      return (
                        <tr key={key} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-3">{row.productTitle}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.variantTitle}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {row.sku || "-"}
                          </td>
                          <td className="px-4 py-3">{row.availableAtSource}</td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              max={row.availableAtSource}
                              value={quantities[key] ?? ""}
                              onChange={(event) => {
                                const next = Math.max(
                                  0,
                                  Math.min(
                                    row.availableAtSource,
                                    Number(event.target.value || 0),
                                  ),
                                );
                                setQuantities((prev) => ({
                                  ...prev,
                                  [key]: next,
                                }));
                              }}
                              className="w-28"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("admin.transfers.create.selectionSummary", {
                lines: selectedItems.length,
                units: selectedItems.reduce((sum, entry) => sum + entry.qty, 0),
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.transfers.create.dialog.addLocationTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.transfers.create.dialog.addLocationDescription", {
                target: locationTarget,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-location-name">
                {t("admin.transfers.create.dialog.locationName")}
              </Label>
              <Input
                id="new-location-name"
                value={newLocationName}
                onChange={(event) => setNewLocationName(event.target.value)}
                placeholder={t(
                  "admin.transfers.create.dialog.locationNamePlaceholder",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-location-address">
                {t("admin.transfers.create.dialog.addressOptional")}
              </Label>
              <Textarea
                id="new-location-address"
                value={newLocationAddress}
                onChange={(event) => setNewLocationAddress(event.target.value)}
                placeholder={t(
                  "admin.transfers.create.dialog.addressPlaceholder",
                )}
                className="min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocationDialogOpen(false)}
            >
              {t("admin.transfers.create.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCreateLocation}
              disabled={creatingLocation}
            >
              {creatingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("admin.transfers.create.dialog.saveLocation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
