"use client";

import { useParams } from "next/navigation";
import { useMultiVendorMode } from "@/providers/app-settings-provider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminSettingsContext } from "@/components/admin/settings/admin-settings-context";
import { SectionLoader } from "@/components/admin/settings/section-loader";
import { SubPageShell } from "@/components/admin/settings/drill/sub-page-shell";
import { CURRENCY_OPTIONS } from "@/components/admin/settings/general/constants";

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
        const defaultCurrency = g.defaultCurrency || "USD";
        const supported = Array.from(
          new Set([
            ...(g.supportedCurrencies?.length
              ? g.supportedCurrencies
              : ["USD"]),
            defaultCurrency,
          ]),
        );

        const toggle = (code: string, checked: boolean) => {
          const next = checked
            ? Array.from(new Set([...supported, code]))
            : supported.filter((v) => v !== code);
          if (next.length === 0) return;
          updateNestedField("general.supportedCurrencies", next);
          if (!next.includes(defaultCurrency)) {
            updateNestedField("general.defaultCurrency", next[0]);
          }
        };

        return (
          <SubPageShell
            backHref={`/${locale}/admin/settings/general`}
            title="Supported currencies"
            description="Currencies customers can pay in"
            isSaving={isSaving}
            isDirty={dirtySections.has("general")}
            onSave={async () => {
              const ok = await saveSection("general", g);
              if (ok) await refreshSettings();
            }}
          >
            <div className="rounded-xl bg-card p-2 ring-1 ring-border/70">
              <ul className="divide-y divide-border/60">
                {CURRENCY_OPTIONS.map((c) => {
                  const isDefault = c.code === defaultCurrency;
                  const isChecked = supported.includes(c.code);
                  return (
                    <li key={c.code}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 hover:bg-muted/50">
                        <span className="flex items-center gap-3">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(v) => toggle(c.code, Boolean(v))}
                          />
                          <span className="text-sm">
                            <span className="font-medium">{c.code}</span>
                            <span className="ml-2 text-muted-foreground">
                              {c.name}
                            </span>
                          </span>
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
                    </li>
                  );
                })}
              </ul>
            </div>
          </SubPageShell>
        );
      }}
    </SectionLoader>
  );
}
