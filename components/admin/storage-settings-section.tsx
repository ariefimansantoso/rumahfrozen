"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  TestTube,
  Check,
  X,
  CircleCheck,
  CircleX,
  RefreshCw,
  Settings2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast-notification";
import {
  StorageProviderToggle,
  type StorageProvider,
} from "@/components/admin/storage-provider-toggle";
import { ConfirmDialog } from "@/components/ui/confirmation-dialog";
import { AwsS3ConfigPanel } from "@/components/admin/aws-s3-config-panel";
import { CloudflareR2ConfigPanel } from "@/components/admin/cloudflare-r2-config-panel";
import { LocalStorageConfigPanel } from "@/components/admin/local-storage-config-panel";
import { SettingsTabHeader } from "@/components/admin/settings/sections/settings-tab-header";
import { StickySaveFooter } from "@/components/admin/settings/sections/sticky-save-footer";
import type { CredentialEnvSources } from "@/lib/credentials";

interface StorageSettings {
  provider: "cloudflare_r2" | "s3" | "local";
  accountId?: string;
  endpoint?: string;
  region?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  maxFileSizeMB: number;
  maxImageSizeMB?: number;
  maxVideoSizeMB?: number;
  maxModelSizeMB?: number;
  allowedMimeTypes: string[];
  pathPrefix?: string;
}

interface StorageSettingsSectionProps {
  storage: StorageSettings;
  onUpdate: (storage: StorageSettings) => void;
  onSave: () => void;
  isSaving: boolean;
  envSources?: CredentialEnvSources["storage"];
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function StorageSettingsSection({
  storage,
  onUpdate,
  onSave,
  isSaving,
  envSources,
}: StorageSettingsSectionProps) {
  const t = useTranslations();
  const [isTesting, setIsTesting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<boolean | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingProvider, setPendingProvider] =
    useState<StorageProvider>("cloudflare_r2");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const updateField = <K extends keyof StorageSettings>(
    field: K,
    value: StorageSettings[K],
  ) => {
    onUpdate({ ...storage, [field]: value });
    setTestResult(null);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/settings/test-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storage),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message,
      });

      if (data.success) {
        toast.success(data.message || "Storage connection successful!");
      } else {
        toast.error(data.message || "Connection failed");
      }
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: getErrorMessage(error, "Failed to test connection"),
      });
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const activeProvider: StorageProvider = storage.provider || "cloudflare_r2";

  const refreshStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    setStatusSuccess(null);
    try {
      const res = await fetch("/api/admin/storage/status");
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to check storage status");
      }
      const isConnected = json?.data?.connection?.success;
      const msg =
        json?.data?.connection?.message ||
        (isConnected
          ? t("admin.settings.storage.connected")
          : t("admin.settings.storage.notConnected"));
      setStatusMessage(msg);
      setStatusSuccess(isConnected ?? null);
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Failed to check storage status"));
      setStatusSuccess(false);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshStatus();
  }, [activeProvider, refreshStatus]);

  // Refresh the status chip after a save completes so it reflects the newly
  // persisted provider/credentials.
  const wasSaving = useRef(isSaving);
  useEffect(() => {
    if (wasSaving.current && !isSaving) {
      void refreshStatus();
    }
    wasSaving.current = isSaving;
  }, [isSaving, refreshStatus]);

  // Selecting a provider only updates the draft: the config panel appears
  // immediately so credentials can be entered and tested, and the switch
  // takes effect when the section is saved. (The previous flow activated the
  // provider via an API that required a passing connection test against the
  // *saved* settings — making it impossible to ever enter credentials for a
  // not-yet-configured provider.)
  const selectProvider = (next: StorageProvider) => {
    updateField("provider", next);
    setConfirmOpen(false);
  };

  const requestProviderChange = (next: StorageProvider) => {
    if (next === activeProvider) return;
    setPendingProvider(next);
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={t("admin.settings.storage.title")}
        description={t("admin.settings.storage.description")}
        meta={
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              statusSuccess === true
                ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                : statusSuccess === false
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {isCheckingStatus ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : statusSuccess === true ? (
              <CircleCheck className="h-3 w-3" />
            ) : statusSuccess === false ? (
              <CircleX className="h-3 w-3" />
            ) : null}
            {isCheckingStatus
              ? t("admin.settings.storage.checking")
              : statusMessage || "—"}
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-6">
        {/* Provider Selection Cards */}
        <StorageProviderToggle
          value={activeProvider}
          onChange={requestProviderChange}
          disabled={isSaving}
        />

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          type="warning"
          title={t("admin.settings.storage.switchDialog.title")}
          description={t("admin.settings.storage.switchDialog.description")}
          confirmText={t("admin.settings.storage.switchDialog.confirm")}
          cancelText={t("admin.settings.storage.switchDialog.cancel")}
          onConfirm={() => selectProvider(pendingProvider)}
        />

        {/* Provider Configuration */}
        <div className="rounded-xl border bg-muted/30 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">
              {activeProvider === "cloudflare_r2"
                ? t("admin.settings.storage.r2Config")
                : activeProvider === "s3"
                  ? t("admin.settings.storage.s3Config")
                  : t("admin.settings.storage.localConfig", {
                      defaultMessage: "Local Storage Configuration",
                    })}
            </h4>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {activeProvider === "cloudflare_r2" ? (
              <CloudflareR2ConfigPanel
                accountId={storage.accountId}
                bucketName={storage.bucketName || ""}
                accessKeyId={storage.accessKeyId || ""}
                secretAccessKey={storage.secretAccessKey || ""}
                publicUrl={storage.publicUrl}
                envSources={envSources}
                onChange={(field, value) => {
                  if (field === "accountId") updateField("accountId", value);
                  if (field === "bucketName") updateField("bucketName", value);
                  if (field === "accessKeyId")
                    updateField("accessKeyId", value);
                  if (field === "secretAccessKey")
                    updateField("secretAccessKey", value);
                  if (field === "publicUrl") updateField("publicUrl", value);
                }}
              />
            ) : activeProvider === "s3" ? (
              <AwsS3ConfigPanel
                region={storage.region || ""}
                bucketName={storage.bucketName || ""}
                accessKeyId={storage.accessKeyId || ""}
                secretAccessKey={storage.secretAccessKey || ""}
                publicUrl={storage.publicUrl}
                envSources={envSources}
                onChange={(field, value) => {
                  if (field === "region") updateField("region", value);
                  if (field === "bucketName") updateField("bucketName", value);
                  if (field === "accessKeyId")
                    updateField("accessKeyId", value);
                  if (field === "secretAccessKey")
                    updateField("secretAccessKey", value);
                  if (field === "publicUrl") updateField("publicUrl", value);
                }}
              />
            ) : (
              <LocalStorageConfigPanel />
            )}
          </div>

          {/* Test result banner */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                testResult.success
                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
              }`}
            >
              {testResult.success ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <X className="h-4 w-4 shrink-0" />
              )}
              <span className="text-xs font-medium">{testResult.message}</span>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={
                isTesting ||
                (activeProvider !== "local" &&
                  (!storage.bucketName ||
                    !storage.accessKeyId ||
                    !storage.secretAccessKey))
              }
              className="gap-2"
            >
              {isTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TestTube className="h-3.5 w-3.5" />
              )}
              {t("admin.settings.storage.testConnection")}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={refreshStatus}
              disabled={isCheckingStatus}
              className="gap-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isCheckingStatus ? "animate-spin" : ""}`}
              />
              {t("admin.settings.storage.refresh")}
            </Button>
          </div>
        </div>

        {/* Upload Settings */}
        <div className="rounded-xl border bg-muted/30 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">
              {t("admin.settings.storage.uploadSettings")}
            </h4>
          </div>

          {/* Per-media-type size limits — Shopify pattern. Each type has its
              own ceiling so admins can be permissive with videos/3D without
              also allowing huge images. */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="maxImageSizeMB"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Max Image Size (MB)
              </Label>
              <Input
                id="maxImageSizeMB"
                type="number"
                min={1}
                max={2048}
                value={storage.maxImageSizeMB ?? 20}
                onChange={(e) =>
                  updateField(
                    "maxImageSizeMB",
                    parseInt(e.target.value) || 20,
                  )
                }
                className="bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="maxVideoSizeMB"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Max Video Size (MB)
              </Label>
              <Input
                id="maxVideoSizeMB"
                type="number"
                min={1}
                max={2048}
                value={storage.maxVideoSizeMB ?? 1024}
                onChange={(e) =>
                  updateField(
                    "maxVideoSizeMB",
                    parseInt(e.target.value) || 1024,
                  )
                }
                className="bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="maxModelSizeMB"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Max 3D Model Size (MB)
              </Label>
              <Input
                id="maxModelSizeMB"
                type="number"
                min={1}
                max={2048}
                value={storage.maxModelSizeMB ?? 500}
                onChange={(e) =>
                  updateField(
                    "maxModelSizeMB",
                    parseInt(e.target.value) || 500,
                  )
                }
                className="bg-background"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="pathPrefix"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                {t("admin.settings.storage.pathPrefix")}
              </Label>
              <Input
                id="pathPrefix"
                value={storage.pathPrefix || "uploads/"}
                onChange={(e) => updateField("pathPrefix", e.target.value)}
                placeholder="uploads/"
                className="bg-background"
              />
            </div>
          </div>
        </div>

          <StickySaveFooter
            label={t("admin.settings.storage.save")}
            isSaving={isSaving}
            onSave={onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
