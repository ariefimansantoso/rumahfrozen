"use client";

import { useState } from "react";
import { Save, Loader2, Shield, Key, Users, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast-notification";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SecuritySettings {
  emailVerificationRequired: boolean;
  emailVerificationForVendors: boolean;
  twoFactorEnabled: boolean;
  twoFactorRequiredForAdmin: boolean;
  twoFactorRequiredForVendors: boolean;
  twoFactorRequiredForStaff: boolean;
  googleOAuthEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  facebookOAuthEnabled: boolean;
  facebookAppId?: string;
  facebookAppSecret?: string;
  sessionMaxAgeDays: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

interface POSSettings {
  enabled: boolean;
  allowAdminSales: boolean;
  allowVendorSales: boolean;
  allowSellerSales: boolean;
}

interface VendorPermissionSettings {
  canManageProducts: boolean;
  canViewOrders: boolean;
  canManageOrders: boolean;
  canManageStoreSettings: boolean;
  canViewAnalytics: boolean;
  canManagePayouts: boolean;
  canAccessPOS: boolean;
}

import { useTranslations } from "next-intl";

interface SecuritySettingsSectionProps {
  security: SecuritySettings;
  pos: POSSettings;
  vendorPermissions: VendorPermissionSettings;
  multiVendorEnabled: boolean;
  onSecurityChange: (field: keyof SecuritySettings, value: any) => void;
  onPOSChange: (field: keyof POSSettings, value: any) => void;
  onVendorPermissionChange: (
    field: keyof VendorPermissionSettings,
    value: any,
  ) => void;
  onMultiVendorChange: (value: boolean) => void;
  onSave: (section: string) => Promise<void>;
  isSaving: boolean;
}

export function SecuritySettingsSection({
  security,
  pos,
  vendorPermissions,
  multiVendorEnabled,
  onSecurityChange,
  onPOSChange,
  onVendorPermissionChange,
  onMultiVendorChange,
  onSave,
  isSaving,
}: SecuritySettingsSectionProps) {
  const t = useTranslations();
  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
        <TabsTrigger value="general">
          {t("admin.settings.security.tabs.general")}
        </TabsTrigger>
        <TabsTrigger value="2fa">
          {t("admin.settings.security.tabs.2fa")}
        </TabsTrigger>
        <TabsTrigger value="oauth">
          {t("admin.settings.security.tabs.oauth")}
        </TabsTrigger>
        <TabsTrigger value="pos">
          {t("admin.settings.security.tabs.pos")}
        </TabsTrigger>
        <TabsTrigger value="vendor">
          {t("admin.settings.security.tabs.vendor")}
        </TabsTrigger>
      </TabsList>

      {/* General Security Settings */}
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("admin.settings.security.title")}
            </CardTitle>
            <CardDescription>
              {t("admin.settings.security.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Multi-Vendor Mode */}
            <div className="space-y-4">
              <h4 className="font-medium">
                {t("admin.settings.security.multiVendor.title")}
              </h4>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div>
                  <Label htmlFor="multiVendorEnabled" className="font-medium">
                    {t("admin.settings.security.multiVendor.label")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.settings.security.multiVendor.description")}
                  </p>
                </div>
                <Switch
                  id="multiVendorEnabled"
                  checked={multiVendorEnabled}
                  onCheckedChange={onMultiVendorChange}
                />
              </div>
            </div>

            <Separator />

            {/* Email Verification */}
            <div className="space-y-4">
              <h4 className="font-medium">
                {t("admin.settings.security.emailVerification.title")}
              </h4>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailVerificationRequired">
                      {t("admin.settings.security.emailVerification.required")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "admin.settings.security.emailVerification.requiredDesc",
                      )}
                    </p>
                  </div>
                  <Switch
                    id="emailVerificationRequired"
                    checked={security.emailVerificationRequired}
                    onCheckedChange={(v) =>
                      onSecurityChange("emailVerificationRequired", v)
                    }
                  />
                </div>
                {multiVendorEnabled && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="emailVerificationForVendors">
                        {t(
                          "admin.settings.security.emailVerification.vendorRequired",
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t(
                          "admin.settings.security.emailVerification.vendorRequiredDesc",
                        )}
                      </p>
                    </div>
                    <Switch
                      id="emailVerificationForVendors"
                      checked={security.emailVerificationForVendors}
                      onCheckedChange={(v) =>
                        onSecurityChange("emailVerificationForVendors", v)
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Session Security */}
            <div className="space-y-4">
              <h4 className="font-medium">
                {t("admin.settings.security.session.title")}
              </h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sessionMaxAgeDays">
                    {t("admin.settings.security.session.duration")}
                  </Label>
                  <Input
                    id="sessionMaxAgeDays"
                    type="number"
                    min={1}
                    max={30}
                    value={security.sessionMaxAgeDays}
                    onChange={(e) =>
                      onSecurityChange(
                        "sessionMaxAgeDays",
                        parseInt(e.target.value),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">
                    {t("admin.settings.security.session.maxAttempts")}
                  </Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    min={3}
                    max={10}
                    value={security.maxLoginAttempts}
                    onChange={(e) =>
                      onSecurityChange(
                        "maxLoginAttempts",
                        parseInt(e.target.value),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lockoutDurationMinutes">
                    {t("admin.settings.security.session.lockout")}
                  </Label>
                  <Input
                    id="lockoutDurationMinutes"
                    type="number"
                    min={5}
                    max={60}
                    value={security.lockoutDurationMinutes}
                    onChange={(e) =>
                      onSecurityChange(
                        "lockoutDurationMinutes",
                        parseInt(e.target.value),
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Password Policy */}
            <div className="space-y-4">
              <h4 className="font-medium">
                {t("admin.settings.security.passwordPolicy.title")}
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minPasswordLength">
                    {t("admin.settings.security.passwordPolicy.minLength")}
                  </Label>
                  <Input
                    id="minPasswordLength"
                    type="number"
                    min={6}
                    max={32}
                    value={security.minPasswordLength}
                    onChange={(e) =>
                      onSecurityChange(
                        "minPasswordLength",
                        parseInt(e.target.value),
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireUppercase">
                    {t("admin.settings.security.passwordPolicy.uppercase")}
                  </Label>
                  <Switch
                    id="requireUppercase"
                    checked={security.requireUppercase}
                    onCheckedChange={(v) =>
                      onSecurityChange("requireUppercase", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireNumbers">
                    {t("admin.settings.security.passwordPolicy.numbers")}
                  </Label>
                  <Switch
                    id="requireNumbers"
                    checked={security.requireNumbers}
                    onCheckedChange={(v) =>
                      onSecurityChange("requireNumbers", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireSpecialChars">
                    {t("admin.settings.security.passwordPolicy.specialChars")}
                  </Label>
                  <Switch
                    id="requireSpecialChars"
                    checked={security.requireSpecialChars}
                    onCheckedChange={(v) =>
                      onSecurityChange("requireSpecialChars", v)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => onSave("security")} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("admin.settings.security.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Two-Factor Authentication */}
      <TabsContent value="2fa">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              {t("admin.settings.twoFactor.title")}
            </CardTitle>
            <CardDescription>
              {t("admin.settings.twoFactor.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div>
                <Label htmlFor="twoFactorEnabled" className="font-medium">
                  {t("admin.settings.twoFactor.enable")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.settings.twoFactor.enableDesc")}
                </p>
              </div>
              <Switch
                id="twoFactorEnabled"
                checked={security.twoFactorEnabled}
                onCheckedChange={(v) => onSecurityChange("twoFactorEnabled", v)}
              />
            </div>

            {security.twoFactorEnabled && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium">
                    {t("admin.settings.twoFactor.requirements")}
                  </h4>
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="twoFactorRequiredForAdmin">
                          {t("admin.settings.twoFactor.admin")}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("admin.settings.twoFactor.adminDesc")}
                        </p>
                      </div>
                      <Switch
                        id="twoFactorRequiredForAdmin"
                        checked={security.twoFactorRequiredForAdmin}
                        onCheckedChange={(v) =>
                          onSecurityChange("twoFactorRequiredForAdmin", v)
                        }
                      />
                    </div>
                    {multiVendorEnabled && (
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="twoFactorRequiredForVendors">
                            {t("admin.settings.twoFactor.vendor")}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {t("admin.settings.twoFactor.vendorDesc")}
                          </p>
                        </div>
                        <Switch
                          id="twoFactorRequiredForVendors"
                          checked={security.twoFactorRequiredForVendors}
                          onCheckedChange={(v) =>
                            onSecurityChange("twoFactorRequiredForVendors", v)
                          }
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="twoFactorRequiredForStaff">
                          {t("admin.settings.twoFactor.staff")}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("admin.settings.twoFactor.staffDesc")}
                        </p>
                      </div>
                      <Switch
                        id="twoFactorRequiredForStaff"
                        checked={security.twoFactorRequiredForStaff}
                        onCheckedChange={(v) =>
                          onSecurityChange("twoFactorRequiredForStaff", v)
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onSave("security")} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("admin.settings.twoFactor.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* OAuth Settings */}
      <TabsContent value="oauth">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t("admin.settings.oauth.title")}
            </CardTitle>
            <CardDescription>
              {t("admin.settings.oauth.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google OAuth */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="googleOAuthEnabled" className="font-medium">
                    {t("admin.settings.oauth.google.label")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.settings.oauth.google.description")}
                  </p>
                </div>
                <Switch
                  id="googleOAuthEnabled"
                  checked={security.googleOAuthEnabled}
                  onCheckedChange={(v) =>
                    onSecurityChange("googleOAuthEnabled", v)
                  }
                />
              </div>
              {security.googleOAuthEnabled && (
                <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="googleClientId">
                      {t("admin.settings.oauth.google.clientId")}
                    </Label>
                    <Input
                      id="googleClientId"
                      value={security.googleClientId || ""}
                      onChange={(e) =>
                        onSecurityChange("googleClientId", e.target.value)
                      }
                      placeholder="xxxx.apps.googleusercontent.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="googleClientSecret">
                      {t("admin.settings.oauth.google.clientSecret")}
                    </Label>
                    <Input
                      id="googleClientSecret"
                      type="password"
                      placeholder="Enter client secret"
                      onChange={(e) =>
                        onSecurityChange("googleClientSecret", e.target.value)
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Facebook OAuth */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="facebookOAuthEnabled" className="font-medium">
                    {t("admin.settings.oauth.facebook.label")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.settings.oauth.facebook.description")}
                  </p>
                </div>
                <Switch
                  id="facebookOAuthEnabled"
                  checked={security.facebookOAuthEnabled}
                  onCheckedChange={(v) =>
                    onSecurityChange("facebookOAuthEnabled", v)
                  }
                />
              </div>
              {security.facebookOAuthEnabled && (
                <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="facebookAppId">
                      {t("admin.settings.oauth.facebook.appId")}
                    </Label>
                    <Input
                      id="facebookAppId"
                      value={security.facebookAppId || ""}
                      onChange={(e) =>
                        onSecurityChange("facebookAppId", e.target.value)
                      }
                      placeholder="Enter App ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebookAppSecret">
                      {t("admin.settings.oauth.facebook.appSecret")}
                    </Label>
                    <Input
                      id="facebookAppSecret"
                      type="password"
                      placeholder="Enter App Secret"
                      onChange={(e) =>
                        onSecurityChange("facebookAppSecret", e.target.value)
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => onSave("security")} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("admin.settings.oauth.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* POS Settings */}
      <TabsContent value="pos">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("admin.settings.pos.title")}
            </CardTitle>
            <CardDescription>
              {t("admin.settings.pos.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div>
                <Label htmlFor="posEnabled" className="font-medium">
                  {t("admin.settings.pos.enable")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.settings.pos.enableDesc")}
                </p>
              </div>
              <Switch
                id="posEnabled"
                checked={pos.enabled}
                onCheckedChange={(v) => onPOSChange("enabled", v)}
              />
            </div>

            {pos.enabled && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium">
                    {t("admin.settings.pos.access")}
                  </h4>
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="allowAdminSales">
                          {t("admin.settings.pos.admin")}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("admin.settings.pos.adminDesc")}
                        </p>
                      </div>
                      <Switch
                        id="allowAdminSales"
                        checked={pos.allowAdminSales}
                        onCheckedChange={(v) =>
                          onPOSChange("allowAdminSales", v)
                        }
                      />
                    </div>
                    {multiVendorEnabled && (
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="allowVendorSales">
                            {t("admin.settings.pos.vendor")}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {t("admin.settings.pos.vendorDesc")}
                          </p>
                        </div>
                        <Switch
                          id="allowVendorSales"
                          checked={pos.allowVendorSales}
                          onCheckedChange={(v) =>
                            onPOSChange("allowVendorSales", v)
                          }
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="allowSellerSales">
                          {t("admin.settings.pos.seller")}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("admin.settings.pos.sellerDesc")}
                        </p>
                      </div>
                      <Switch
                        id="allowSellerSales"
                        checked={pos.allowSellerSales}
                        onCheckedChange={(v) =>
                          onPOSChange("allowSellerSales", v)
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onSave("pos")} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("admin.settings.pos.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Vendor Permission Defaults */}
      <TabsContent value="vendor">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.vendorPermissions.title")}</CardTitle>
            <CardDescription>
              {t("admin.settings.vendorPermissions.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!multiVendorEnabled && (
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t("admin.settings.vendorPermissions.warning")}
                </p>
              </div>
            )}

            {multiVendorEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor="canManageProducts">
                    {t("admin.settings.vendorPermissions.manageProducts")}
                  </Label>
                  <Switch
                    id="canManageProducts"
                    checked={vendorPermissions.canManageProducts}
                    onCheckedChange={(v) =>
                      onVendorPermissionChange("canManageProducts", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor="canViewOrders">
                    {t("admin.settings.vendorPermissions.viewOrders")}
                  </Label>
                  <Switch
                    id="canViewOrders"
                    checked={vendorPermissions.canViewOrders}
                    onCheckedChange={(v) =>
                      onVendorPermissionChange("canViewOrders", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor="canManageOrders">
                    {t("admin.settings.vendorPermissions.manageOrders")}
                  </Label>
                  <Switch
                    id="canManageOrders"
                    checked={vendorPermissions.canManageOrders}
                    onCheckedChange={(v) =>
                      onVendorPermissionChange("canManageOrders", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor="canManageStoreSettings">
                    {t("admin.settings.vendorPermissions.manageSettings")}
                  </Label>
                  <Switch
                    id="canManageStoreSettings"
                    checked={vendorPermissions.canManageStoreSettings}
                    onCheckedChange={(v) =>
                      onVendorPermissionChange("canManageStoreSettings", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor="canViewAnalytics">
                    {t("admin.settings.vendorPermissions.viewAnalytics")}
                  </Label>
                  <Switch
                    id="canViewAnalytics"
                    checked={vendorPermissions.canViewAnalytics}
                    onCheckedChange={(v) =>
                      onVendorPermissionChange("canViewAnalytics", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor="canManagePayouts">
                    {t("admin.settings.vendorPermissions.managePayouts")}
                  </Label>
                  <Switch
                    id="canManagePayouts"
                    checked={vendorPermissions.canManagePayouts}
                    onCheckedChange={(v) =>
                      onVendorPermissionChange("canManagePayouts", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor="canAccessPOS">
                    {t("admin.settings.vendorPermissions.accessPOS")}
                  </Label>
                  <Switch
                    id="canAccessPOS"
                    checked={vendorPermissions.canAccessPOS}
                    onCheckedChange={(v) =>
                      onVendorPermissionChange("canAccessPOS", v)
                    }
                  />
                </div>
              </div>
            )}

            {multiVendorEnabled && (
              <div className="flex justify-end">
                <Button
                  onClick={() => onSave("vendorPermissions")}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {t("admin.settings.vendorPermissions.save")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
