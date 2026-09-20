"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";

interface Location {
  _id: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
}

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onSuccess: () => void;
}

export function LocationFormDialog({
  open,
  onOpenChange,
  location,
  onSuccess,
}: LocationFormDialogProps) {
  const t = useTranslations();
  const isEditing = Boolean(location);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens/closes or location changes
  useEffect(() => {
    if (open && location) {
      setName(location.name);
      setAddress(location.address || "");
      setIsDefault(location.isDefault);
      setIsActive(location.isActive);
    } else if (open && !location) {
      setName("");
      setAddress("");
      setIsDefault(false);
      setIsActive(true);
    }
  }, [open, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t("locations.nameRequired"));
      return;
    }

    setIsSaving(true);

    try {
      const url = isEditing
        ? `/api/admin/locations/${location!._id}`
        : "/api/admin/locations";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          isDefault,
          ...(isEditing && { isActive }),
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success(
          isEditing ? t("locations.updated") : t("locations.created")
        );
        onSuccess();
      } else {
        toast.error(json.message || t("locations.saveError"));
      }
    } catch {
      toast.error(t("locations.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t("locations.editLocation")
                : t("locations.addLocation")}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? t("locations.editDescription")
                : t("locations.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="location-name">{t("locations.name")}</Label>
              <Input
                id="location-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("locations.namePlaceholder")}
                autoFocus
              />
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <Label htmlFor="location-address">{t("locations.address")}</Label>
              <Textarea
                id="location-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("locations.addressPlaceholder")}
                rows={3}
              />
            </div>

            {/* Default toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="location-default" className="text-sm font-medium">
                  {t("locations.defaultLocation")}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("locations.defaultHint")}
                </p>
              </div>
              <Switch
                id="location-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>

            {/* Active toggle (only for editing) */}
            {isEditing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="location-active" className="text-sm font-medium">
                    {t("locations.activeLocation")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("locations.activeHint")}
                  </p>
                </div>
                <Switch
                  id="location-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t("common.save") : t("locations.addLocation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
