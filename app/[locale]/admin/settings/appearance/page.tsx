"use client";

import { AppearanceSettingsTab } from "@/components/admin/settings/sections/appearance-settings-tab";
import { useAdminSettingsContext } from "@/components/admin/settings/admin-settings-context";
import { SectionLoader } from "@/components/admin/settings/section-loader";

export default function Page() {
  const {
    isSaving,
    dirtySections,
    updateNestedField,
    saveSection,
  } = useAdminSettingsContext();

  return (
    <SectionLoader>
      {(loadedSettings) => (
        <AppearanceSettingsTab
          settings={loadedSettings}
          isSaving={isSaving}
          isDirty={dirtySections.has("appearance")}
          updateNestedField={updateNestedField}
          onSave={() => saveSection("appearance", loadedSettings.appearance)}
        />
      )}
    </SectionLoader>
  );
}
