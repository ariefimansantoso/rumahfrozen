"use client";

import { ShippingSettingsTab } from "@/components/admin/settings/sections/shipping-settings-tab";
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
        <ShippingSettingsTab
          shipping={loadedSettings.shipping}
          isSaving={isSaving}
          isDirty={dirtySections.has("shipping")}
          updateField={updateNestedField}
          onSave={() => saveSection("shipping", loadedSettings.shipping)}
        />
      )}
    </SectionLoader>
  );
}
