"use client";

import { OAuthSettingsTab } from "@/components/admin/settings/sections/oauth-settings-tab";
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
        <OAuthSettingsTab
          settings={loadedSettings}
          isSaving={isSaving}
          isDirty={dirtySections.has("oauth")}
          updateField={(path, value) =>
            updateFieldInSection("oauth", path, value)
          }
          onSave={() =>
            saveSection("oauth", {
              googleOAuthEnabled:
                loadedSettings.security?.googleOAuthEnabled ?? false,
              googleClientId: loadedSettings.security?.googleClientId,
              googleClientSecret: loadedSettings.security?.googleClientSecret,
              facebookOAuthEnabled:
                loadedSettings.security?.facebookOAuthEnabled ?? false,
              facebookAppId: loadedSettings.security?.facebookAppId,
              facebookAppSecret: loadedSettings.security?.facebookAppSecret,
            })
          }
        />
      )}
    </SectionLoader>
  );
}
