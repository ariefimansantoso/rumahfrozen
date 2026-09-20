"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loader2, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Settings } from "@/components/admin/settings/types";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { EmailDeliveryLogs } from "../email-delivery-logs";

export function EmailSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  isTestingEmail: boolean;
  testEmail: string;
  setTestEmail: (v: string) => void;
  updateNestedField: (path: string, value: unknown) => void;
  updateFieldInSection: (
    section: string,
    path: string,
    value: unknown,
  ) => void;
  onSave: () => void | Promise<unknown>;
  onTestSmtp: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const {
    settings,
    isSaving,
    isDirty,
    isTestingEmail,
    testEmail,
    setTestEmail,
    updateNestedField,
    updateFieldInSection,
    onSave,
    onTestSmtp,
  } = props;
  const [smtpPasswordTouched, setSmtpPasswordTouched] = useState(false);
  const envEmail = settings._meta?.envSources?.email;

  const tSafe = (
    key: string,
    fallback: string,
    values?: Record<string, unknown>,
  ) => {
    try {
      const translate = t as unknown as (
        k: string,
        v?: Record<string, unknown>,
      ) => string;
      const res = translate(key, values);
      return typeof res === "string" && res !== key ? res : fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={t("admin.settings.email.title")}
        description={t("admin.settings.email.description")}
      />
      <Card>
        <CardContent className="space-y-4">
        <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
          <div>
            <p className="font-medium">
              {tSafe(
                "admin.settings.security.emailVerification.title",
                "Email verification",
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {tSafe(
                "admin.settings.security.emailVerification.requiredDesc",
                "Require verification before allowing account actions.",
              )}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="emailVerificationRequired">
              {tSafe(
                "admin.settings.security.emailVerification.required",
                "Require email verification",
              )}
            </Label>
            <Switch
              id="emailVerificationRequired"
              checked={settings.security?.emailVerificationRequired ?? false}
              onCheckedChange={(v) =>
                updateFieldInSection(
                  "emailVerification",
                  "security.emailVerificationRequired",
                  v,
                )
              }
            />
          </div>

          {Boolean(settings.multiVendorMode?.enabled) && (
            <div className="flex items-center justify-between">
              <Label htmlFor="emailVerificationForVendors">
                {tSafe(
                  "admin.settings.security.emailVerification.vendorRequired",
                  "Require for vendors",
                )}
              </Label>
              <Switch
                id="emailVerificationForVendors"
                checked={
                  settings.security?.emailVerificationForVendors ?? false
                }
                onCheckedChange={(v) =>
                  updateFieldInSection(
                    "emailVerification",
                    "security.emailVerificationForVendors",
                    v,
                  )
                }
              />
            </div>
          )}

        </div>

        <Separator />
        <div className="flex items-center justify-between">
          <Label htmlFor="smtpEnabled">
            {t("admin.settings.email.enable")}
          </Label>
          <Switch
            id="smtpEnabled"
            checked={settings.email.enabled}
            onCheckedChange={(v) => updateNestedField("email.enabled", v)}
          />
        </div>
        <EnvSourceHint
          show={
            !settings.email.enabled &&
            Boolean(envEmail?.user || envEmail?.password || envEmail?.host)
          }
        />
        {settings.email.enabled && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">
                  {t("admin.settings.email.host")}
                </Label>
                <Input
                  id="smtpHost"
                  value={settings.email.smtp.host || ""}
                  onChange={(e) =>
                    updateNestedField("email.smtp.host", e.target.value)
                  }
                  placeholder="smtp.gmail.com"
                />
                <EnvSourceHint show={Boolean(envEmail?.host)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">
                  {t("admin.settings.email.port")}
                </Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={settings.email.smtp.port || 587}
                  onChange={(e) =>
                    updateNestedField(
                      "email.smtp.port",
                      parseInt(e.target.value),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUser">
                  {t("admin.settings.email.username")}
                </Label>
                <Input
                  id="smtpUser"
                  value={settings.email.smtp.user || ""}
                  onChange={(e) =>
                    updateNestedField("email.smtp.user", e.target.value)
                  }
                  placeholder="your-email@gmail.com"
                />
                <EnvSourceHint show={Boolean(envEmail?.user)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPassword">
                  {t("admin.settings.email.password")}
                </Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  value={settings.email.smtp.password || ""}
                  onFocus={() => setSmtpPasswordTouched(true)}
                  onChange={(e) => {
                    if (
                      !smtpPasswordTouched &&
                      document.activeElement !== e.currentTarget
                    ) {
                      return;
                    }
                    setSmtpPasswordTouched(true);
                    updateNestedField("email.smtp.password", e.target.value);
                  }}
                  placeholder="Enter password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                />
                <EnvSourceHint show={Boolean(envEmail?.password)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpFromEmail">
                  {t("admin.settings.email.fromEmail")}
                </Label>
                <Input
                  id="smtpFromEmail"
                  value={settings.email.fromEmail || ""}
                  onChange={(e) =>
                    updateNestedField("email.fromEmail", e.target.value)
                  }
                  placeholder="noreply@yourstore.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpFromName">
                  {t("admin.settings.email.fromName")}
                </Label>
                <Input
                  id="smtpFromName"
                  value={settings.email.fromName || ""}
                  onChange={(e) =>
                    updateNestedField("email.fromName", e.target.value)
                  }
                  placeholder="Your Store Name"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Encryption is automatic: port 465 uses implicit TLS and port 587
              requires STARTTLS.
            </p>
            <Separator />
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="testEmail">
                  {t("admin.settings.email.test.label")}
                </Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder={t("admin.settings.email.test.placeholder")}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => onTestSmtp()}
                disabled={isTestingEmail}
              >
                {isTestingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                {t("admin.settings.email.test.button")}
              </Button>
            </div>
          </>
        )}
          <StickySaveFooter
            label={t("admin.settings.email.save")}
            isSaving={isSaving}
            isDirty={isDirty}
            onSave={onSave}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <EmailDeliveryLogs
            retentionDays={settings.email.logRetentionDays ?? 30}
            onRetentionDaysChange={(days) =>
              updateNestedField("email.logRetentionDays", days)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
