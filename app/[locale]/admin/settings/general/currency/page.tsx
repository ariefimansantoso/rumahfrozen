"use client";

import { useParams } from "next/navigation";
import { useMultiVendorMode } from "@/providers/app-settings-provider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminSettingsContext } from "@/components/admin/settings/admin-settings-context";
import { SectionLoader } from "@/components/admin/settings/section-loader";
import { SubPageShell } from "@/components/admin/settings/drill/sub-page-shell";

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
        const supported = Array.from(
          new Set([
            ...(g.supportedCurrencies?.length
              ? g.supportedCurrencies
              : ["USD"]),
            g.defaultCurrency || "USD",
          ]),
        );
        return (
          <SubPageShell
            backHref={`/${locale}/admin/settings/general`}
            title="Default currency"
            description="Used for prices and reports"
            isSaving={isSaving}
            isDirty={dirtySections.has("general")}
            onSave={async () => {
              const ok = await saveSection("general", g);
              if (ok) await refreshSettings();
            }}
          >
            <div className="rounded-xl bg-card p-5 ring-1 ring-border/70">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={g.defaultCurrency || "USD"}
                  onValueChange={(v) =>
                    updateNestedField("general.defaultCurrency", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supported.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Manage the full list under Markets → Supported currencies.
                </p>
              </div>
            </div>
          </SubPageShell>
        );
      }}
    </SectionLoader>
  );
}
