"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { HardDrive, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { StorageSettingsSection } from "@/components/admin/storage-settings-section";
import { MediaLibrarySection } from "@/components/admin/media-library-section";
import { useAdminSettingsContext } from "@/components/admin/settings/admin-settings-context";
import { SectionLoader } from "@/components/admin/settings/section-loader";

type StorageTab = "storage" | "library";

function StorageTabs({
  tab,
  onChange,
}: {
  tab: StorageTab;
  onChange: (tab: StorageTab) => void;
}) {
  const t = useTranslations();
  const tabs: { value: StorageTab; label: string; icon: typeof HardDrive }[] = [
    {
      value: "storage",
      label: t("admin.media.tabStorage"),
      icon: HardDrive,
    },
    {
      value: "library",
      label: t("admin.media.tabLibrary"),
      icon: Images,
    },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-1">
      {tabs.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  const {
    isSaving,
    updateNestedField,
    saveSection,
    refetch,
    hasUnsaved,
  } = useAdminSettingsContext();
  const [tab, setTab] = useState<StorageTab>("storage");

  // The settings draft is fetched once when the settings shell mounts, so
  // values changed elsewhere (another tab, env fallback, a direct DB edit)
  // go stale — and saving a stale draft would overwrite them. Re-sync when
  // entering this page unless there are unsaved edits to protect.
  useEffect(() => {
    if (!hasUnsaved()) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SectionLoader>
      {(loadedSettings) => (
        <div className="space-y-4">
          {tab === "library" ? (
            <MediaLibrarySection
              tabBar={<StorageTabs tab={tab} onChange={setTab} />}
            />
          ) : (
            <>
              <StorageTabs tab={tab} onChange={setTab} />
              <StorageSettingsSection
                storage={
                  loadedSettings.storage || {
                    provider: "cloudflare_r2",
                    maxFileSizeMB: 20,
                    maxImageSizeMB: 20,
                    maxVideoSizeMB: 1024,
                    maxModelSizeMB: 500,
                    allowedMimeTypes: [
                      "image/jpeg",
                      "image/png",
                      "image/gif",
                      "image/webp",
                    ],
                    pathPrefix: "uploads/",
                  }
                }
                onUpdate={(newStorage) => {
                  updateNestedField("storage", newStorage);
                }}
                onSave={() => saveSection("storage", loadedSettings.storage)}
                isSaving={isSaving}
                envSources={loadedSettings._meta?.envSources?.storage}
              />
            </>
          )}
        </div>
      )}
    </SectionLoader>
  );
}
