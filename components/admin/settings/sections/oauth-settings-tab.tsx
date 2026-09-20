"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Settings } from "@/components/admin/settings/types";
import { SecretInput } from "@/components/admin/settings/fields/secret-input";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import { SettingSwitchRow } from "@/components/admin/settings/fields/setting-switch-row";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";
import { useTranslations } from "next-intl";

export function OAuthSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const security = props.settings.security;
  const env = props.settings._meta?.envSources?.security;

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={t("admin.settings.oauth.title")}
        description={t("admin.settings.oauth.description")}
      />
      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <SettingSwitchRow
              title={t("admin.settings.oauth.google.label")}
              checked={Boolean(security.googleOAuthEnabled)}
              onCheckedChange={(v) =>
                props.updateField("security.googleOAuthEnabled", v)
              }
            />
            <EnvSourceHint
              show={!security.googleOAuthEnabled && Boolean(env?.googleClientId || env?.googleClientSecret)}
            />
            {security.googleOAuthEnabled ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("admin.settings.oauth.google.clientId")}</Label>
                  <Input
                    value={security.googleClientId || ""}
                    onChange={(e) =>
                      props.updateField("security.googleClientId", e.target.value)
                    }
                  />
                  <EnvSourceHint show={Boolean(env?.googleClientId)} />
                </div>
                <div className="space-y-2">
                  <SecretInput
                    id="googleClientSecret"
                    label={t("admin.settings.oauth.google.clientSecret")}
                    value={security.googleClientSecret || ""}
                    onChange={(v) =>
                      props.updateField("security.googleClientSecret", v)
                    }
                    secretSet={Boolean(
                      props.settings._meta?.security?.googleClientSecretSet,
                    )}
                    placeholderWhenSet="Saved (leave blank to keep)"
                    helperText="Saved secrets are not shown again for security."
                  />
                  <EnvSourceHint show={Boolean(env?.googleClientSecret)} />
                </div>
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-3">
            <SettingSwitchRow
              title={t("admin.settings.oauth.facebook.label")}
              checked={Boolean(security.facebookOAuthEnabled)}
              onCheckedChange={(v) =>
                props.updateField("security.facebookOAuthEnabled", v)
              }
            />
            <EnvSourceHint
              show={!security.facebookOAuthEnabled && Boolean(env?.facebookAppId || env?.facebookAppSecret)}
            />
            {security.facebookOAuthEnabled ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("admin.settings.oauth.facebook.appId")}</Label>
                  <Input
                    value={security.facebookAppId || ""}
                    onChange={(e) =>
                      props.updateField("security.facebookAppId", e.target.value)
                    }
                  />
                  <EnvSourceHint show={Boolean(env?.facebookAppId)} />
                </div>
                <div className="space-y-2">
                  <SecretInput
                    id="facebookAppSecret"
                    label={t("admin.settings.oauth.facebook.appSecret")}
                    value={security.facebookAppSecret || ""}
                    onChange={(v) =>
                      props.updateField("security.facebookAppSecret", v)
                    }
                    secretSet={Boolean(
                      props.settings._meta?.security?.facebookAppSecretSet,
                    )}
                    placeholderWhenSet="Saved (leave blank to keep)"
                    helperText="Saved secrets are not shown again for security."
                  />
                  <EnvSourceHint show={Boolean(env?.facebookAppSecret)} />
                </div>
              </div>
            ) : null}
          </div>

          <StickySaveFooter
            label={t("admin.settings.oauth.save")}
            isSaving={props.isSaving}
            isDirty={props.isDirty}
            onSave={props.onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
