"use client";

import { SecuritySettingsTab } from "@/components/admin/settings/sections/security-settings-tab";
import { useAdminSettingsContext } from "@/components/admin/settings/admin-settings-context";
import { SectionLoader } from "@/components/admin/settings/section-loader";

export default function Page() {
  const {
    isSaving,
    dirtySections,
    updateFieldInSection,
    saveSection,
  } = useAdminSettingsContext();

  return (
    <SectionLoader>
      {(loadedSettings) => (
        <SecuritySettingsTab
          settings={loadedSettings}
          isSaving={isSaving}
          isDirty={dirtySections.has("security")}
          updateField={(path, value) =>
            updateFieldInSection("security", path, value)
          }
          onSave={() =>
            saveSection("security", {
              sessionMaxAgeDays: loadedSettings.security?.sessionMaxAgeDays ?? 7,
              maxLoginAttempts: loadedSettings.security?.maxLoginAttempts ?? 5,
              lockoutDurationMinutes:
                loadedSettings.security?.lockoutDurationMinutes ?? 15,
              minPasswordLength: loadedSettings.security?.minPasswordLength ?? 8,
              requireUppercase: loadedSettings.security?.requireUppercase ?? false,
              requireNumbers: loadedSettings.security?.requireNumbers ?? false,
              requireSpecialChars:
                loadedSettings.security?.requireSpecialChars ?? false,
            })
          }
        />
      )}
    </SectionLoader>
  );
}
