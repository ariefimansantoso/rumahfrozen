"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KeyRound, Globe, HardDrive, MapPin } from "lucide-react";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import type { CredentialEnvSources } from "@/lib/credentials";

interface AwsS3ConfigPanelProps {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
  envSources?: CredentialEnvSources["storage"];
  onChange: (
    field:
      | "region"
      | "bucketName"
      | "accessKeyId"
      | "secretAccessKey"
      | "publicUrl",
    value: string,
  ) => void;
}

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
];

export function AwsS3ConfigPanel({
  region,
  bucketName,
  accessKeyId,
  secretAccessKey,
  publicUrl,
  envSources,
  onChange,
}: AwsS3ConfigPanelProps) {
  const t = useTranslations();

  return (
    <>
      {/* Region & Bucket */}
      <div className="space-y-1.5">
        <Label
          htmlFor="region"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          <MapPin className="h-3 w-3" />
          {t("admin.settings.storage.region")}
        </Label>
        <Select
          value={region}
          onValueChange={(value) => onChange("region", value)}
        >
          <SelectTrigger className="bg-background">
            <SelectValue
              placeholder={t("admin.settings.storage.placeholder.region")}
            />
          </SelectTrigger>
          <SelectContent>
            {AWS_REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <EnvSourceHint show={Boolean(envSources?.region)} />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="bucketName"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          <HardDrive className="h-3 w-3" />
          {t("admin.settings.storage.bucketName")}
        </Label>
        <Input
          id="bucketName"
          value={bucketName}
          onChange={(e) => onChange("bucketName", e.target.value)}
          placeholder={t("admin.settings.storage.placeholder.bucket")}
          className="bg-background"
        />
        <EnvSourceHint show={Boolean(envSources?.bucketName)} />
      </div>

      {/* Credentials */}
      <div className="md:col-span-2">
        <div className="h-px bg-border my-1" />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="accessKeyId"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          <KeyRound className="h-3 w-3" />
          {t("admin.settings.storage.accessKeyId")}
        </Label>
        <Input
          id="accessKeyId"
          value={accessKeyId}
          onChange={(e) => onChange("accessKeyId", e.target.value)}
          placeholder={t("admin.settings.storage.placeholder.accessKeyId")}
          className="bg-background font-mono text-sm"
        />
        <EnvSourceHint show={Boolean(envSources?.accessKeyId)} />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="secretAccessKey"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          <KeyRound className="h-3 w-3" />
          {t("admin.settings.storage.secretAccessKey")}
        </Label>
        <Input
          id="secretAccessKey"
          type="password"
          value={secretAccessKey}
          onChange={(e) => onChange("secretAccessKey", e.target.value)}
          placeholder={t("admin.settings.storage.placeholder.secretKey")}
          className="bg-background"
        />
        <EnvSourceHint show={Boolean(envSources?.secretAccessKey)} />
      </div>

      {/* Public URL */}
      <div className="md:col-span-2">
        <div className="h-px bg-border my-1" />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label
          htmlFor="publicUrl"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          <Globe className="h-3 w-3" />
          {t("admin.settings.storage.publicUrl")}
        </Label>
        <Input
          id="publicUrl"
          value={publicUrl || ""}
          onChange={(e) => onChange("publicUrl", e.target.value)}
          placeholder={t("admin.settings.storage.placeholder.cdnUrl")}
          className="bg-background"
        />
        <p className="text-[11px] text-muted-foreground/70">
          {t("admin.settings.storage.help.cloudfront")}
        </p>
        <EnvSourceHint show={Boolean(envSources?.publicUrl)} />
      </div>
    </>
  );
}
