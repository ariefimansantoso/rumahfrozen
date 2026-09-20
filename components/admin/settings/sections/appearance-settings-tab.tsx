"use client";

import {
  Moon,
  Contrast,
  AlignLeft,
  PanelLeftClose,
  Info,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Settings } from "@/components/admin/settings/types";
import { presetColors } from "@/stores/app-settings";
import { useTheme, type Theme } from "@/providers/theme-provider";
import {
  NavColorCard,
  PresetColorCard,
  SectionContainer,
  SettingCard,
} from "@/components/admin/appearance-settings-ui";
import { SettingsTabHeader } from "./settings-tab-header";
import { StickySaveFooter } from "./sticky-save-footer";

export function AppearanceSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const { setTheme } = useTheme();

  const handleThemeChange = (nextTheme: Theme) => {
    props.updateNestedField("appearance.theme", nextTheme);
    setTheme(nextTheme);
  };

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title={t("admin.settings.appearance.title")}
        description={t("admin.settings.appearance.description")}
      />
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">
                {t("admin.settings.appearance.primaryColor")}
              </Label>
              <Input
                id="primaryColor"
                value={props.settings.appearance.primaryColor || ""}
                onChange={(e) =>
                  props.updateNestedField(
                    "appearance.primaryColor",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">
                {t("admin.settings.appearance.secondaryColor")}
              </Label>
              <Input
                id="secondaryColor"
                value={props.settings.appearance.secondaryColor || ""}
                onChange={(e) =>
                  props.updateNestedField(
                    "appearance.secondaryColor",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">
                {t("admin.settings.appearance.accentColor")}
              </Label>
              <Input
                id="accentColor"
                value={props.settings.appearance.accentColor || ""}
                onChange={(e) =>
                  props.updateNestedField(
                    "appearance.accentColor",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.settings.appearance.theme")}</Label>
              <Select
                value={props.settings.appearance.theme || "system"}
                onValueChange={(value) => handleThemeChange(value as Theme)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    {t("admin.settings.appearance.themes.system")}
                  </SelectItem>
                  <SelectItem value="light">
                    {t("admin.settings.appearance.themes.light")}
                  </SelectItem>
                  <SelectItem value="dark">
                    {t("admin.settings.appearance.themes.dark")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <SettingCard
                icon={<Moon className="h-5 w-5" strokeWidth={1.5} />}
                label={t("admin.settings.appearance.mode")}
                checked={props.settings.appearance.theme === "dark"}
                onCheckedChange={(checked) =>
                  handleThemeChange(checked ? "dark" : "light")
                }
              />
              <SettingCard
                icon={<Contrast className="h-5 w-5" strokeWidth={1.5} />}
                label={t("admin.settings.appearance.contrast")}
                checked={Boolean(props.settings.appearance.contrast)}
                onCheckedChange={(checked) =>
                  props.updateNestedField("appearance.contrast", checked)
                }
              />
              <SettingCard
                icon={<AlignLeft className="h-5 w-5" strokeWidth={1.5} />}
                label={t("admin.settings.appearance.rtl")}
                checked={Boolean(props.settings.appearance.rtl)}
                onCheckedChange={(checked) =>
                  props.updateNestedField("appearance.rtl", checked)
                }
              />
              <SettingCard
                icon={<PanelLeftClose className="h-5 w-5" strokeWidth={1.5} />}
                label={t("admin.settings.appearance.collapsedSidebar")}
                checked={Boolean(props.settings.appearance.collapsedSidebar)}
                onCheckedChange={(checked) =>
                  props.updateNestedField(
                    "appearance.collapsedSidebar",
                    checked,
                  )
                }
                hasInfo
              />
            </div>

            <SectionContainer
              label={t("admin.settings.appearance.nav")}
              icon={<Info className="h-2.5 w-2.5" />}
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t("admin.settings.appearance.color")}
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <NavColorCard
                      label={t("admin.settings.appearance.navColor.integrate")}
                      isActive={
                        props.settings.appearance.navColor === "integrate"
                      }
                      onClick={() =>
                        props.updateNestedField(
                          "appearance.navColor",
                          "integrate",
                        )
                      }
                    />
                    <NavColorCard
                      label={t("admin.settings.appearance.navColor.apparent")}
                      isActive={
                        props.settings.appearance.navColor === "apparent"
                      }
                      onClick={() =>
                        props.updateNestedField("appearance.navColor", "apparent")
                      }
                    />
                  </div>
                </div>
              </div>
            </SectionContainer>

            <SectionContainer
              label={t("admin.settings.appearance.presets")}
              icon={<RefreshCw className="h-2.5 w-2.5" />}
            >
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
                {(
                  Object.keys(presetColors) as Array<keyof typeof presetColors>
                ).map((key) => (
                  <PresetColorCard
                    key={key}
                    color={presetColors[key].primary}
                    isActive={props.settings.appearance.presetColor === key}
                    onClick={() =>
                      props.updateNestedField("appearance.presetColor", key)
                    }
                  />
                ))}
              </div>
            </SectionContainer>
          </div>
          <StickySaveFooter
            label={t("admin.settings.appearance.save")}
            isSaving={props.isSaving}
            isDirty={props.isDirty}
            onSave={props.onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
