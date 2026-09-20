"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/components/admin/settings/types";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { useTranslations } from "next-intl";

export function SecuritySettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const security = props.settings.security;

  const tSafe = (key: string, fallback: string) => {
    try {
      const translate = t as unknown as (k: string) => string;
      const res = translate(key);
      return typeof res === "string" && res !== key ? res : fallback;
    } catch {
      return fallback;
    }
  };

  const clampInt = (
    raw: string,
    fallback: number,
    min: number,
    max: number,
  ) => {
    if (raw.trim() === "") return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  const rateLimiting = security.rateLimiting ?? {
    enabled: true,
    ipPreset: "default",
    adminPreset: "default",
    vendorPreset: "default",
    checkoutPreset: "default",
    cartPreset: "default",
    couponPreset: "default",
    authPreset: "default",
  };

  const presetOptions: Array<{ value: string; label: string }> = [
    { value: "default", label: "Default" },
    { value: "lenient", label: "Lenient (100/15m)" },
    { value: "moderate", label: "Moderate (20/15m)" },
    { value: "strict", label: "Strict (5/15m)" },
  ];

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={tSafe("admin.settings.security.title", "Security & Access Control")}
        description={tSafe(
          "admin.settings.security.description",
          "Configure session security and password policies",
        )}
      />
      <Card>
        <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>
              {tSafe("admin.settings.security.session.duration", "Session Duration (days)")}
            </Label>
            <Input
              type="number"
              value={security.sessionMaxAgeDays ?? 7}
              onChange={(e) =>
                props.updateField(
                  "security.sessionMaxAgeDays",
                  clampInt(
                    e.target.value,
                    security.sessionMaxAgeDays ?? 7,
                    1,
                    365,
                  ),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label>
              {tSafe("admin.settings.security.session.maxAttempts", "Max Login Attempts")}
            </Label>
            <Input
              type="number"
              value={security.maxLoginAttempts ?? 5}
              onChange={(e) =>
                props.updateField(
                  "security.maxLoginAttempts",
                  clampInt(
                    e.target.value,
                    security.maxLoginAttempts ?? 5,
                    1,
                    50,
                  ),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label>
              {tSafe("admin.settings.security.session.lockout", "Lockout Duration (min)")}
            </Label>
            <Input
              type="number"
              value={security.lockoutDurationMinutes ?? 15}
              onChange={(e) =>
                props.updateField(
                  "security.lockoutDurationMinutes",
                  clampInt(
                    e.target.value,
                    security.lockoutDurationMinutes ?? 15,
                    1,
                    10080,
                  ),
                )
              }
            />
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {tSafe(
                "admin.settings.security.rateLimiting.enabled",
                "Enable Rate Limiting",
              )}
            </span>
            <Switch
              checked={Boolean(rateLimiting.enabled)}
              onCheckedChange={(v) =>
                props.updateField("security.rateLimiting.enabled", v)
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>
                {tSafe(
                  "admin.settings.security.rateLimiting.adminPreset",
                  "Admin API",
                )}
              </Label>
              <Select
                value={String(rateLimiting.adminPreset ?? "default")}
                onValueChange={(v) =>
                  props.updateField("security.rateLimiting.adminPreset", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {tSafe(
                  "admin.settings.security.rateLimiting.vendorPreset",
                  "Vendor API",
                )}
              </Label>
              <Select
                value={String(rateLimiting.vendorPreset ?? "default")}
                onValueChange={(v) =>
                  props.updateField("security.rateLimiting.vendorPreset", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {tSafe(
                  "admin.settings.security.rateLimiting.checkoutPreset",
                  "Checkout / Payments",
                )}
              </Label>
              <Select
                value={String(rateLimiting.checkoutPreset ?? "default")}
                onValueChange={(v) =>
                  props.updateField("security.rateLimiting.checkoutPreset", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {tSafe("admin.settings.security.rateLimiting.cartPreset", "Cart")}
              </Label>
              <Select
                value={String(rateLimiting.cartPreset ?? "default")}
                onValueChange={(v) =>
                  props.updateField("security.rateLimiting.cartPreset", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {tSafe(
                  "admin.settings.security.rateLimiting.couponPreset",
                  "Coupons",
                )}
              </Label>
              <Select
                value={String(rateLimiting.couponPreset ?? "default")}
                onValueChange={(v) =>
                  props.updateField("security.rateLimiting.couponPreset", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {tSafe(
                  "admin.settings.security.rateLimiting.authPreset",
                  "Auth / Login",
                )}
              </Label>
              <Select
                value={String(rateLimiting.authPreset ?? "default")}
                onValueChange={(v) =>
                  props.updateField("security.rateLimiting.authPreset", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>
                {tSafe(
                  "admin.settings.security.rateLimiting.ipPreset",
                  "Guest / Public (IP-based)",
                )}
              </Label>
              <Select
                value={String(rateLimiting.ipPreset ?? "default")}
                onValueChange={(v) =>
                  props.updateField("security.rateLimiting.ipPreset", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>
              {tSafe(
                "admin.settings.security.passwordPolicy.minLength",
                "Minimum Password Length",
              )}
            </Label>
            <Input
              type="number"
              value={security.minPasswordLength ?? 8}
              onChange={(e) =>
                props.updateField(
                  "security.minPasswordLength",
                  clampInt(
                    e.target.value,
                    security.minPasswordLength ?? 8,
                    6,
                    128,
                  ),
                )
              }
            />
          </div>
        </div>
        <Separator />
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {tSafe("admin.settings.security.passwordPolicy.uppercase", "Require Uppercase")}
            </span>
            <Switch
              checked={Boolean(security.requireUppercase)}
              onCheckedChange={(v) =>
                props.updateField("security.requireUppercase", v)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {tSafe("admin.settings.security.passwordPolicy.numbers", "Require Numbers")}
            </span>
            <Switch
              checked={Boolean(security.requireNumbers)}
              onCheckedChange={(v) =>
                props.updateField("security.requireNumbers", v)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {tSafe(
                "admin.settings.security.passwordPolicy.specialChars",
                "Require Special Characters",
              )}
            </span>
            <Switch
              checked={Boolean(security.requireSpecialChars)}
              onCheckedChange={(v) =>
                props.updateField("security.requireSpecialChars", v)
              }
            />
          </div>
        </div>
          <StickySaveFooter
            label={tSafe("admin.settings.security.save", "Save Security Settings")}
            isSaving={props.isSaving}
            isDirty={props.isDirty}
            onSave={props.onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
