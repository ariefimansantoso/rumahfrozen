"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";

export function LocalStorageConfigPanel() {
  const t = useTranslations();

  return (
    <>
      {/* Explainer — local storage needs no credentials or public URL: files
          are written under public/ and served same-site with relative URLs. */}
      <div className="md:col-span-2 flex items-start gap-2 rounded-lg border border-dashed bg-background/60 p-3">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("admin.settings.storage.help.local", {
            defaultMessage:
              "Files are stored on this server under the public/ folder (configurable via Path Prefix below) and served directly from your site. Best for single-server or self-hosted setups — make sure the folder persists across deployments.",
          })}
        </p>
      </div>
    </>
  );
}
