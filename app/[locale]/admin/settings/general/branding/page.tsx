"use client";

import { useParams } from "next/navigation";
import { useMultiVendorMode } from "@/providers/app-settings-provider";
import { SectionLoader } from "@/components/admin/settings/section-loader";
import { SubPageShell } from "@/components/admin/settings/drill/sub-page-shell";
import { BrandAssetCard } from "@/components/admin/settings/general/brand-asset-card";
import { useAdminSettingsContext } from "@/components/admin/settings/admin-settings-context";

export default function Page() {
  const { locale } = useParams<{ locale: string }>();
  const { refreshSettings } = useMultiVendorMode();
  const {
    isSaving,
    dirtySections,
    updateNestedField,
    saveSection,
  } = useAdminSettingsContext();

  return (
    <SectionLoader>
      {(loadedSettings) => {
        const g = loadedSettings.general;
        return (
          <SubPageShell
            backHref={`/${locale}/admin/settings/general`}
            title="Brand assets"
            description="Logos and favicon used across your storefront"
            isSaving={isSaving}
            isDirty={dirtySections.has("general")}
            onSave={async () => {
              const ok = await saveSection("general", g);
              if (ok) await refreshSettings();
            }}
          >
            <div className="rounded-xl bg-card p-5 ring-1 ring-border/70">
              <div className="grid gap-6 md:grid-cols-3">
                <BrandAssetCard
                  label="Light Theme Logo"
                  value={g.logoUrl || ""}
                  onChange={(v) => updateNestedField("general.logoUrl", v)}
                  alt="Light theme logo"
                  replaceText="Replace light logo"
                  maxSize="5 MB"
                  formats="PNG, JPG, JPEG, SVG, WEBP"
                  recommended="400x120px"
                />
                <BrandAssetCard
                  label="Dark Theme Logo"
                  value={g.darkModeLogoUrl || ""}
                  onChange={(v) =>
                    updateNestedField("general.darkModeLogoUrl", v)
                  }
                  alt="Dark theme logo"
                  replaceText="Replace dark logo"
                  maxSize="5 MB"
                  formats="PNG, JPG, JPEG, SVG, WEBP"
                  recommended="400x120px"
                />
                <BrandAssetCard
                  label="Favicon"
                  value={g.faviconUrl || ""}
                  onChange={(v) => updateNestedField("general.faviconUrl", v)}
                  alt="Store favicon"
                  replaceText="Replace favicon"
                  maxSize="1 MB"
                  formats="PNG, ICO, SVG, JPG, JPEG, WEBP"
                  recommended="32x32px"
                />
              </div>
            </div>
          </SubPageShell>
        );
      }}
    </SectionLoader>
  );
}
