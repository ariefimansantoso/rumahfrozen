"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/components/admin/settings/types";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { useTranslations } from "next-intl";

export function VendorPermissionsSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const perms = props.settings.multiVendorMode;
  const items: { key: keyof Settings["multiVendorMode"]; label: string }[] = [
    {
      key: "canManageProducts",
      label: t("admin.settings.vendorPermissions.manageProducts"),
    },
    {
      key: "canViewOrders",
      label: t("admin.settings.vendorPermissions.viewOrders"),
    },
    {
      key: "canManageOrders",
      label: t("admin.settings.vendorPermissions.manageOrders"),
    },
    {
      key: "canManageStoreSettings",
      label: t("admin.settings.vendorPermissions.manageSettings"),
    },
    {
      key: "canViewAnalytics",
      label: t("admin.settings.vendorPermissions.viewAnalytics"),
    },
    {
      key: "canManageDiscounts",
      label: t("admin.settings.vendorPermissions.manageDiscounts"),
    },
    {
      key: "canManagePayouts",
      label: t("admin.settings.vendorPermissions.managePayouts"),
    },
    {
      key: "canAccessPOS",
      label: t("admin.settings.vendorPermissions.accessPOS"),
    },
  ];

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={t("admin.settings.vendorPermissions.title")}
        description={t("admin.settings.vendorPermissions.description")}
      />
      <Card>
        <CardContent className="space-y-4">
          {props.disabled ? (
            <p className="text-sm text-muted-foreground">
              {t("admin.settings.vendorPermissions.warning")}
            </p>
          ) : null}
          <div className="grid gap-3">
            {items.map((it) => (
              <div key={it.key} className="flex items-center justify-between">
                <span className="text-sm">{it.label}</span>
                <Switch
                  checked={Boolean(perms[it.key])}
                  disabled={Boolean(props.disabled)}
                  onCheckedChange={(v) =>
                    props.updateField(`multiVendorMode.${it.key}`, v)
                  }
                />
              </div>
            ))}
          </div>
          <StickySaveFooter
            label="Save changes"
            isSaving={props.isSaving}
            isDirty={props.isDirty}
            disabled={props.isSaving || !props.isDirty}
            onSave={props.onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
