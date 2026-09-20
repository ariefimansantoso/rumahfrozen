"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Store,
  ImageIcon,
  Globe,
  Languages,
  CircleDollarSign,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppImage } from "@/components/ui/app-image";
import type { Settings } from "@/components/admin/settings/types";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { CURRENCY_OPTIONS } from "@/components/admin/settings/general/constants";
import { isValidLocale } from "@/config/i18n.config";

const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "bn", name: "Bengali" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "zu", name: "Zulu" },
  { code: "xh", name: "Xhosa" },
  { code: "af", name: "Afrikaans" },
  { code: "sw", name: "Swahili" },
  { code: "ha", name: "Hausa" },
  { code: "yo", name: "Yoruba" },
  { code: "ig", name: "Igbo" },
];

type UploadResponse = {
  success?: boolean;
  message?: unknown;
  data?: unknown;
};

type UploadedFile = {
  url?: unknown;
  key?: unknown;
};

function BrandAssetCard(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  alt: string;
  replaceText: string;
  maxSize: string;
  formats: string;
  recommended: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as UploadResponse;
      if (json?.success !== true) {
        const msg =
          typeof json?.message === "string" ? json.message : "Upload failed";
        setError(msg);
        return;
      }
      const items = Array.isArray(json.data) ? (json.data as unknown[]) : [];
      const first = (items[0] || {}) as UploadedFile;
      const url = typeof first.url === "string" ? first.url : "";
      if (!url) {
        setError("Upload failed");
        return;
      }
      props.onChange(url);
    } catch {
      setError("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const onPick = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const looksLikeImage =
      (file.type && file.type.startsWith("image/")) ||
      /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(file.name);
    if (!looksLikeImage) {
      setError("Please select an image file");
      return;
    }
    await uploadFile(file);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploading) return;
    void onPick(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <span className="text-sm font-semibold">{props.label}</span>

      {/* Upload zone */}
      <div
        className="relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 transition-colors cursor-pointer hover:border-primary/40 hover:bg-muted/30"
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void onPick(e.target.files)}
          disabled={isUploading}
          className="hidden"
          aria-label={`${props.label}-file`}
        />

        {/* Preview image with remove badge */}
        {props.value && (
          <div className="relative">
            <div className="h-16 w-16 overflow-hidden rounded-lg border bg-muted/50">
              <AppImage
                src={props.value}
                alt={props.alt}
                className="h-full w-full object-contain"
                width={64}
                height={64}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onChange("");
              }}
              disabled={isUploading}
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-transform hover:scale-110"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Upload icon */}
        {isUploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}

        {/* Action text */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {props.value
              ? props.replaceText
              : `Upload ${props.label.toLowerCase()}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag and drop or click to select
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Metadata */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Max size:</span>
          <span className="font-medium">{props.maxSize}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Formats:</span>
          <span className="font-medium">{props.formats}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Recommended:</span>
          <span className="font-medium">{props.recommended}</span>
        </div>
      </div>
    </div>
  );
}

export function GeneralSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => Promise<boolean> | boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();

  const defaultLanguage = props.settings.general.defaultLanguage || "en";
  const defaultCurrency = props.settings.general.defaultCurrency || "USD";

  const supportedLanguages = Array.from(
    new Set([
      ...(props.settings.general.supportedLanguages?.length
        ? props.settings.general.supportedLanguages
        : ["en"]),
      defaultLanguage,
    ]),
  );
  const supportedCurrencies = Array.from(
    new Set([
      ...(props.settings.general.supportedCurrencies?.length
        ? props.settings.general.supportedCurrencies
        : ["USD"]),
      defaultCurrency,
    ]),
  );

  const handleToggleInList = (
    path: "general.supportedLanguages" | "general.supportedCurrencies",
    current: string[],
    value: string,
    checked: boolean,
  ) => {
    const next = checked
      ? Array.from(new Set([...current, value]))
      : current.filter((v) => v !== value);
    if (next.length === 0) return;

    props.updateNestedField(path, next);

    if (path === "general.supportedLanguages") {
      const defaultLang = props.settings.general.defaultLanguage || "en";
      if (!next.includes(defaultLang)) {
        props.updateNestedField("general.defaultLanguage", next[0]);
      }
    }

    if (path === "general.supportedCurrencies") {
      const defaultCurr = props.settings.general.defaultCurrency || "USD";
      if (!next.includes(defaultCurr)) {
        props.updateNestedField("general.defaultCurrency", next[0]);
      }
    }
  };

  const handleSave = async () => {
    const didSave = await props.onSave();
    if (!didSave || !pathname) return;

    const nextLocale = props.settings.general.defaultLanguage || "en";
    const currentLocale = pathname.split("/").filter(Boolean)[0];

    if (!isValidLocale(nextLocale) || currentLocale === nextLocale) {
      return;
    }

    const currentPrefix = `/${currentLocale}`;
    const nextPathname = pathname.startsWith(currentPrefix)
      ? pathname.replace(currentPrefix, `/${nextLocale}`)
      : `/${nextLocale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;

    router.push(nextPathname);
  };

  return (
    <div className="relative">
      <div className="space-y-6">
        <SettingsTabHeader
          title={t("admin.settings.general.title")}
          description={t("admin.settings.general.description")}
        />

        {/* Section 1 -- Store Information */}
        <div className="rounded-lg border bg-card text-card-foreground">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Store Information</h3>
              <p className="text-xs text-muted-foreground">
                Basic details about your store
              </p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="storeName">
                  {t("admin.settings.general.storeName")}
                </Label>
                <Input
                  id="storeName"
                  value={props.settings.general.storeName || ""}
                  onChange={(e) =>
                    props.updateNestedField("general.storeName", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storeEmail">
                  {t("admin.settings.general.storeEmail")}
                </Label>
                <Input
                  id="storeEmail"
                  value={props.settings.general.storeEmail || ""}
                  onChange={(e) =>
                    props.updateNestedField(
                      "general.storeEmail",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storePhone">
                  {t("admin.settings.general.phone")}
                </Label>
                <Input
                  id="storePhone"
                  value={props.settings.general.storePhone || ""}
                  onChange={(e) =>
                    props.updateNestedField(
                      "general.storePhone",
                      e.target.value,
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeDomain">
                {t("admin.settings.general.storeDomain")}
              </Label>
              <Input
                id="storeDomain"
                value={props.settings.general.storeDomain || ""}
                onChange={(e) =>
                  props.updateNestedField("general.storeDomain", e.target.value)
                }
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeDescription">
                {t("admin.settings.general.storeDescription")}
              </Label>
              <Textarea
                id="storeDescription"
                value={props.settings.general.storeDescription || ""}
                onChange={(e) =>
                  props.updateNestedField(
                    "general.storeDescription",
                    e.target.value,
                  )
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeAddress">
                {t("admin.settings.general.address")}
              </Label>
              <Textarea
                id="storeAddress"
                value={props.settings.general.storeAddress || ""}
                onChange={(e) =>
                  props.updateNestedField(
                    "general.storeAddress",
                    e.target.value,
                  )
                }
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Section 2 -- Brand Assets */}
        <div className="rounded-lg border bg-card text-card-foreground">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ImageIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Brand Assets</h3>
              <p className="text-xs text-muted-foreground">
                Upload your store logo and favicon
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="grid gap-6 md:grid-cols-3">
              <BrandAssetCard
                label="Light Theme Logo"
                value={props.settings.general.logoUrl || ""}
                onChange={(v) => props.updateNestedField("general.logoUrl", v)}
                alt="Light theme logo"
                replaceText="Replace light logo"
                maxSize="5 MB"
                formats="PNG, JPG, JPEG, SVG, WEBP"
                recommended="400x120px"
              />
              <BrandAssetCard
                label="Dark Theme Logo"
                value={props.settings.general.darkModeLogoUrl || ""}
                onChange={(v) =>
                  props.updateNestedField("general.darkModeLogoUrl", v)
                }
                alt="Dark theme logo"
                replaceText="Replace dark logo"
                maxSize="5 MB"
                formats="PNG, JPG, JPEG, SVG, WEBP"
                recommended="400x120px"
              />
              <BrandAssetCard
                label="Favicon"
                value={props.settings.general.faviconUrl || ""}
                onChange={(v) =>
                  props.updateNestedField("general.faviconUrl", v)
                }
                alt="Store favicon"
                replaceText="Replace favicon"
                maxSize="1 MB"
                formats="PNG, ICO, SVG, JPG, JPEG, WEBP"
                recommended="32x32px"
              />
            </div>
          </div>
        </div>

        {/* Section 3 -- Regional Defaults */}
        <div className="rounded-lg border bg-card text-card-foreground">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Regional Defaults</h3>
              <p className="text-xs text-muted-foreground">
                Timezone, language, and currency preferences
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="timezone">
                  {t("admin.settings.general.timezone")}
                </Label>
                <Input
                  id="timezone"
                  value={props.settings.general.timezone || "UTC"}
                  onChange={(e) =>
                    props.updateNestedField("general.timezone", e.target.value)
                  }
                  placeholder={t("admin.settings.general.timezonePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.settings.general.defaultLanguage")}</Label>
                <Select
                  value={props.settings.general.defaultLanguage || "en"}
                  onValueChange={(v) =>
                    props.updateNestedField("general.defaultLanguage", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguages.map((code) => {
                      const label =
                        LANGUAGE_OPTIONS.find((x) => x.code === code)?.name ||
                        code;
                      return (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultCurrency">
                  {t("admin.settings.general.defaultCurrency")}
                </Label>
                <Select
                  value={props.settings.general.defaultCurrency || "USD"}
                  onValueChange={(v) =>
                    props.updateNestedField("general.defaultCurrency", v)
                  }
                >
                  <SelectTrigger id="defaultCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedCurrencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4 -- Supported Languages */}
        <div className="rounded-lg border bg-card text-card-foreground">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Languages className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("admin.settings.general.supportedLanguages")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("admin.settings.general.supportedLanguagesDesc")}
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {LANGUAGE_OPTIONS.map((l) => {
                const isDefault = l.code === defaultLanguage;
                const isChecked = supportedLanguages.includes(l.code);
                return (
                  <label
                    key={l.code}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors cursor-pointer hover:bg-muted/50 ${
                      isChecked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) =>
                          handleToggleInList(
                            "general.supportedLanguages",
                            supportedLanguages,
                            l.code,
                            Boolean(v),
                          )
                        }
                      />
                      <span className="font-medium">{l.name}</span>
                    </span>
                    {isDefault && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        Default
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 5 -- Supported Currencies */}
        <div className="rounded-lg border bg-card text-card-foreground">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CircleDollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("admin.settings.general.supportedCurrencies")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("admin.settings.general.supportedCurrenciesDesc")}
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {CURRENCY_OPTIONS.map((c) => {
                const isDefault = c.code === defaultCurrency;
                const isChecked = supportedCurrencies.includes(c.code);
                return (
                  <label
                    key={c.code}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors cursor-pointer hover:bg-muted/50 ${
                      isChecked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) =>
                          handleToggleInList(
                            "general.supportedCurrencies",
                            supportedCurrencies,
                            c.code,
                            Boolean(v),
                          )
                        }
                      />
                      <span className="font-medium">{c.code}</span>
                    </span>
                    {isDefault && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        Default
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <StickySaveFooter
        label={t("admin.settings.general.save")}
        isSaving={props.isSaving}
        isDirty={props.isDirty}
        onSave={handleSave}
      />
    </div>
  );
}
