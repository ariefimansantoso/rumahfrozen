"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Settings } from "@/components/admin/settings/types";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

export function OrdersSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const { settings, isSaving, isDirty, updateNestedField, onSave } = props;
  const currencyCode = settings.general.defaultCurrency || "USD";
  const withCurrency = (label: string) =>
    `${label.replace(/\s*\([^)]*\)\s*$/, "")} (${currencyCode})`;
  const taxPercent = Number((settings.orders.taxRate * 100).toFixed(4));

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={t("admin.settings.orders.title")}
        description={t("admin.settings.orders.description")}
      />
      <Card>
        <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="orderPrefix">
              {t("admin.settings.orders.prefix")}
            </Label>
            <Input
              id="orderPrefix"
              value={settings.orders.prefix}
              onChange={(e) =>
                updateNestedField("orders.prefix", e.target.value.toUpperCase())
              }
              placeholder="ORD"
              minLength={2}
              maxLength={10}
              pattern="[A-Z0-9]{2,10}"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxRate">
              {t("admin.settings.orders.taxRate")}
            </Label>
            <Input
              id="taxRate"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={taxPercent}
              onChange={(e) =>
                updateNestedField(
                  "orders.taxRate",
                  (Number(e.target.value) || 0) / 100,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultShippingCost">
              {withCurrency(t("admin.settings.orders.shippingCost"))}
            </Label>
            <Input
              id="defaultShippingCost"
              type="number"
              min={0}
              step={0.01}
              value={settings.orders.defaultShippingCost}
              onChange={(e) =>
                updateNestedField(
                  "orders.defaultShippingCost",
                  Number(e.target.value) || 0,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="freeShippingThreshold">
              {withCurrency(t("admin.settings.orders.freeShippingThreshold"))}
            </Label>
            <Input
              id="freeShippingThreshold"
              type="number"
              min={0}
              step={0.01}
              value={settings.orders.freeShippingThreshold ?? 0}
              placeholder={t("admin.settings.orders.freeShippingPlaceholder")}
              onChange={(e) =>
                updateNestedField(
                  "orders.freeShippingThreshold",
                  Number(e.target.value) || 0,
                )
              }
            />
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vendorCommissionRate">
              {t("admin.settings.orders.commissionRate")}
            </Label>
            <Input
              id="vendorCommissionRate"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={settings.orders.commission?.vendorRate ?? 0}
              onChange={(e) =>
                updateNestedField(
                  "orders.commission.vendorRate",
                  Number(e.target.value) || 0,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minWithdrawalAmount">
              {withCurrency(t("admin.settings.orders.minWithdrawal"))}
            </Label>
            <Input
              id="minWithdrawalAmount"
              type="number"
              min={0}
              step={0.01}
              value={settings.orders.commission?.minWithdrawalAmount ?? 0}
              onChange={(e) =>
                updateNestedField(
                  "orders.commission.minWithdrawalAmount",
                  Number(e.target.value) || 0,
                )
              }
            />
          </div>
        </div>
          <StickySaveFooter
            label={t("admin.settings.general.save")}
            isSaving={isSaving}
            isDirty={isDirty}
            onSave={onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
