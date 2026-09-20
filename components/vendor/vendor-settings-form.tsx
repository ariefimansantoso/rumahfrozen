"use client";

import { useEffect, useMemo, useState } from "react";
import { useMessages, useTranslations } from "next-intl";
import {
  Store,
  CreditCard,
  Bell,
  User,
  Loader2,
  Lock,
  Save,
  Share2,
  Truck,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MediaUploader } from "@/components/ui/media-uploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast-notification";
import { authClient } from "@/lib/auth-client";
import { TwoFactorManagementCard } from "@/components/account/two-factor-management-card";
import {
  VendorShippingEditor,
  EMPTY_VENDOR_SHIPPING,
} from "@/components/vendor/vendor-shipping-settings";
import { VendorShareSettings } from "@/components/vendor/vendor-share-settings";
import type { VendorShippingProfile } from "@/types";
import {
  DEFAULT_SHARE_SETTINGS,
  type ShareSettings,
} from "@/lib/share-config";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PROFILE_DEMO_MODE,
  normalizeDemoModeState,
  type DemoModeState,
} from "@/lib/demo-mode-shared";

type SettingsTab =
  | "store"
  | "payment"
  | "share"
  | "notifications"
  | "account"
  | "shipping";

const VENDOR_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const VENDOR_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

interface VendorSettingsState {
  vendor: {
    storeName: string;
    slug: string;
    description: string;
    logo: string;
    banner: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone: string;
    };
    socialLinks: {
      website: string;
      facebook: string;
      instagram: string;
      twitter: string;
    };
    shareSettings: ShareSettings;
    bankDetails: {
      accountName: string;
      accountNumber: string;
      bankName: string;
      routingNumber: string;
      swiftCode: string;
    };
    notificationPreferences: {
      newOrders: boolean;
      orderUpdates: boolean;
      lowStock: boolean;
      marketing: boolean;
    };
    payoutSettings: {
      schedule: "weekly" | "biweekly" | "monthly";
      minimumAmount: number;
    };
    shipping?: VendorShippingProfile | null;
  };
  user: {
    name: string;
    email: string;
    phone: string;
    image: string;
  };
}

interface VendorSettingsFormProps {
  initialTab?: string;
  canEdit?: boolean;
}

const DEFAULT_SETTINGS: VendorSettingsState = {
  vendor: {
    storeName: "",
    slug: "",
    description: "",
    logo: "",
    banner: "",
    address: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      phone: "",
    },
    socialLinks: {
      website: "",
      facebook: "",
      instagram: "",
      twitter: "",
    },
    shareSettings: DEFAULT_SHARE_SETTINGS,
    bankDetails: {
      accountName: "",
      accountNumber: "",
      bankName: "",
      routingNumber: "",
      swiftCode: "",
    },
    notificationPreferences: {
      newOrders: true,
      orderUpdates: true,
      lowStock: true,
      marketing: false,
    },
    payoutSettings: {
      schedule: "weekly",
      minimumAmount: 0,
    },
    shipping: null,
  },
  user: {
    name: "",
    email: "",
    phone: "",
    image: "",
  },
};

function normalizeTab(value?: string): SettingsTab {
  if (value === "store") return "store";
  if (value === "payment") return "payment";
  if (value === "share") return "share";
  if (value === "notifications") return "notifications";
  if (value === "account") return "account";
  if (value === "shipping") return "shipping";
  return "store";
}

function normalizeSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .slice(0, 120);
}

export function VendorSettingsForm({
  initialTab,
  canEdit = false,
}: VendorSettingsFormProps) {
  const t = useTranslations();
  const messages = useMessages();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    normalizeTab(initialTab),
  );
  const [settings, setSettings] = useState<VendorSettingsState>(DEFAULT_SETTINGS);
  const [vendorShippingEnabled, setVendorShippingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [demoMode, setDemoMode] = useState(DEFAULT_PROFILE_DEMO_MODE);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const isAccountDemoMode = demoMode.enabled && activeTab === "account";

  const hasMessage = (key: string): boolean => {
    const parts = key.split(".");
    let current: unknown = messages;

    for (const part of parts) {
      if (typeof current !== "object" || current === null) return false;
      const record = current as Record<string, unknown>;
      if (!(part in record)) return false;
      current = record[part];
    }

    return typeof current === "string";
  };

  const tSafe = (key: string, fallback: string) => {
    try {
      if (!hasMessage(key)) return fallback;
      const translate = t as unknown as (k: string) => string;
      const result = translate(key);
      return result && result !== key ? result : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/vendor/settings");
        const json = (await res.json()) as {
          success?: boolean;
          data?: VendorSettingsState & {
            vendorShippingEnabled?: boolean;
            demoMode?: DemoModeState;
          };
          message?: string;
          error?: string;
        };

        if (!res.ok || !json.success || !json.data) {
          throw new Error(
            json.message || json.error || "Failed to load vendor settings",
          );
        }

        const enabled = Boolean(json.data.vendorShippingEnabled);
        setVendorShippingEnabled(enabled);
        if (json.data.demoMode) {
          setDemoMode(normalizeDemoModeState(json.data.demoMode));
        }
        setSettings({ vendor: json.data.vendor, user: json.data.user });
        // If the admin disabled shipping but the URL pointed at that tab, fall
        // back to the store tab so there's always visible content.
        if (!enabled) {
          setActiveTab((prev) => (prev === "shipping" ? "store" : prev));
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load vendor settings",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSettings();
  }, []);

  const saveSection = async (
    section: SettingsTab,
    data: Record<string, unknown>,
  ) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/vendor/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        data?: VendorSettingsState & { vendorShippingEnabled?: boolean };
        message?: string;
        error?: string;
      };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || json.error || "Failed to save settings");
      }

      setVendorShippingEnabled(Boolean(json.data.vendorShippingEnabled));
      setSettings({ vendor: json.data.vendor, user: json.data.user });

      if (section === "account") {
        await authClient
          .updateUser({
            name: json.data.user.name,
            image: json.data.user.image || undefined,
          })
          .catch(() => null);
      }

      toast.success(tSafe("common.saved", "Saved"));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const onStoreSave = async () => {
    await saveSection("store", {
      storeName: settings.vendor.storeName,
      slug: settings.vendor.slug,
      description: settings.vendor.description,
      logo: settings.vendor.logo,
      banner: settings.vendor.banner,
      address: settings.vendor.address,
      socialLinks: settings.vendor.socialLinks,
    });
  };

  const onPaymentSave = async () => {
    await saveSection("payment", {
      bankDetails: settings.vendor.bankDetails,
      payoutSettings: settings.vendor.payoutSettings,
    });
  };

  const onShareSave = async () => {
    await saveSection("share", {
      shareSettings: settings.vendor.shareSettings,
    });
  };

  const onNotificationsSave = async () => {
    await saveSection("notifications", {
      notificationPreferences: settings.vendor.notificationPreferences,
    });
  };

  const onAccountSave = async () => {
    if (demoMode.enabled) {
      toast.error(demoMode.message);
      return;
    }

    await saveSection("account", {
      name: settings.user.name,
      phone: settings.user.phone,
      image: settings.user.image,
    });
  };

  const onShippingSave = async () => {
    await saveSection("shipping", {
      shipping: settings.vendor.shipping || EMPTY_VENDOR_SHIPPING,
    });
  };

  const onPasswordSave = async () => {
    if (demoMode.enabled) {
      toast.error(demoMode.message);
      return;
    }

    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      toast.error(
        tSafe(
          "vendor.settingsForm.passwordMinLength",
          "New password must be at least 8 characters",
        ),
      );
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(
        tSafe("vendor.settingsForm.passwordsDoNotMatch", "Passwords do not match"),
      );
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword || undefined,
          newPassword: passwordForm.newPassword,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || "Failed to update password");
      }

      toast.success(json.message || "Password updated successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update password",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const minPayoutValue = useMemo(
    () => String(settings.vendor.payoutSettings.minimumAmount ?? 0),
    [settings.vendor.payoutSettings.minimumAmount],
  );

  const handleActiveTabSave = async () => {
    if (activeTab === "store") {
      await onStoreSave();
      return;
    }
    if (activeTab === "payment") {
      await onPaymentSave();
      return;
    }
    if (activeTab === "share") {
      await onShareSave();
      return;
    }
    if (activeTab === "notifications") {
      await onNotificationsSave();
      return;
    }
    if (activeTab === "shipping") {
      await onShippingSave();
      return;
    }
    if (demoMode.enabled) {
      toast.error(demoMode.message);
      return;
    }
    await onAccountSave();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">
          {tSafe("common.loading", "Loading...")}
        </CardContent>
      </Card>
    );
  }

  const tabs = [
    {
      value: "store" as const,
      label: tSafe("vendor.storeProfile", "Store"),
      icon: Store,
    },
    {
      value: "payment" as const,
      label: tSafe("vendor.payment", "Payment"),
      icon: CreditCard,
    },
    {
      value: "share" as const,
      label: tSafe("vendor.settingsForm.shareButtons", "Share Buttons"),
      icon: Share2,
    },
    {
      value: "notifications" as const,
      label: tSafe("common.notifications", "Notifications"),
      icon: Bell,
    },
    ...(vendorShippingEnabled
      ? [
          {
            value: "shipping" as const,
            label: tSafe("admin.sidebar.shipping", "Shipping"),
            icon: Truck,
          },
        ]
      : []),
    {
      value: "account" as const,
      label: tSafe("common.account", "Account"),
      icon: User,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {tSafe("vendor.settings", "Store Settings")}
          </h1>
          <p className="text-muted-foreground">
            {tSafe(
              "vendor.settingsDesc",
              "Manage your store profile and preferences",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleActiveTabSave}
            disabled={isSaving || !canEdit || isAccountDemoMode}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {tSafe("common.saveChanges", "Save changes")}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(normalizeTab(v))}
        className="gap-6"
      >
        <div className="scrollbar-hide -mx-1 flex overflow-x-auto border-b">
          <TabsList className="h-auto w-fit min-w-full justify-start gap-1 rounded-none bg-transparent p-0 px-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "-mb-px h-auto flex-none gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium shadow-none transition-colors",
                    "text-muted-foreground hover:text-foreground",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="store" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {tSafe("vendor.storeProfile", "Store Profile")}
            </CardTitle>
            <CardDescription>
              {tSafe(
                "vendor.storeProfileDesc",
                "Manage your store details and branding",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>{tSafe("vendor.storeName", "Store Name")}</Label>
                <Input
                  value={settings.vendor.storeName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: { ...prev.vendor, storeName: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{tSafe("vendor.settingsForm.storeSlug", "Store slug")}</Label>
                <Input
                  value={settings.vendor.slug}
                  placeholder={normalizeSlugInput(settings.vendor.storeName) || "store-slug"}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        slug: normalizeSlugInput(e.target.value),
                      },
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {tSafe(
                    "vendor.settingsForm.storeSlugHelp",
                    "Used in your public shop URL.",
                  )}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{tSafe("vendor.storeDescription", "Description")}</Label>
                <Textarea
                  value={settings.vendor.description}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: { ...prev.vendor, description: e.target.value },
                    }))
                  }
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.settingsForm.logoUrl", "Store logo")}</Label>
                <MediaUploader
                  value={
                    settings.vendor.logo
                      ? [
                          {
                            _id: "vendor-logo",
                            url: settings.vendor.logo,
                            type: "image",
                            mimeType: "image/*",
                            alt: `${settings.vendor.storeName || "Store"} logo`,
                            position: 0,
                          },
                        ]
                      : []
                  }
                  onChange={(items) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        logo:
                          items.find((item) => item.type === "image")?.url || "",
                      },
                    }))
                  }
                  maxFiles={1}
                  acceptTypes={["image"]}
                  accept={VENDOR_IMAGE_ACCEPT}
                  allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                  uploadTitle="Drag and drop image, or click to browse"
                  uploadDescription="Image format: JPG, PNG, JPEG, WEBP."
                  sizeGuide="Recommended size: 512 x 512 px"
                  mediaGridClassName="grid-cols-1 md:grid-cols-1 max-w-32"
                  previewAspectRatio="1 / 1"
                  previewFit="contain"
                  previewTileClassName="bg-slate-50"
                  showCoverBadge={false}
                  coverHint={false}
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.settingsForm.bannerUrl", "Store banner")}</Label>
                <MediaUploader
                  value={
                    settings.vendor.banner
                      ? [
                          {
                            _id: "vendor-banner",
                            url: settings.vendor.banner,
                            type: "image",
                            mimeType: "image/*",
                            alt: `${settings.vendor.storeName || "Store"} banner`,
                            position: 0,
                          },
                        ]
                      : []
                  }
                  onChange={(items) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        banner:
                          items.find((item) => item.type === "image")?.url || "",
                      },
                    }))
                  }
                  maxFiles={1}
                  acceptTypes={["image"]}
                  accept={VENDOR_IMAGE_ACCEPT}
                  allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                  uploadTitle="Drag and drop image, or click to browse"
                  uploadDescription="Image format: JPG, PNG, JPEG, WEBP."
                  sizeGuide="Recommended size: 1360 x 314 px"
                  mediaGridClassName="grid-cols-1 md:grid-cols-1"
                  previewAspectRatio="1360 / 314"
                  previewFit="contain"
                  previewTileClassName="bg-slate-50"
                  showCoverBadge={false}
                  coverHint={false}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>{tSafe("vendor.registration.streetLabel", "Street")}</Label>
                <Input
                  value={settings.vendor.address.street}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        address: { ...prev.vendor.address, street: e.target.value },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.registration.cityLabel", "City")}</Label>
                <Input
                  value={settings.vendor.address.city}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        address: { ...prev.vendor.address, city: e.target.value },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.registration.stateLabel", "State")}</Label>
                <Input
                  value={settings.vendor.address.state}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        address: { ...prev.vendor.address, state: e.target.value },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {tSafe("vendor.registration.postalCodeLabel", "Postal Code")}
                </Label>
                <Input
                  value={settings.vendor.address.postalCode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        address: {
                          ...prev.vendor.address,
                          postalCode: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.registration.countryLabel", "Country")}</Label>
                <Input
                  value={settings.vendor.address.country}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        address: { ...prev.vendor.address, country: e.target.value },
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tSafe("vendor.settingsForm.website", "Website")}</Label>
                <Input
                  value={settings.vendor.socialLinks.website}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        socialLinks: {
                          ...prev.vendor.socialLinks,
                          website: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.settingsForm.facebook", "Facebook")}</Label>
                <Input
                  value={settings.vendor.socialLinks.facebook}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        socialLinks: {
                          ...prev.vendor.socialLinks,
                          facebook: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.settingsForm.instagram", "Instagram")}</Label>
                <Input
                  value={settings.vendor.socialLinks.instagram}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        socialLinks: {
                          ...prev.vendor.socialLinks,
                          instagram: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.settingsForm.twitter", "X / Twitter")}</Label>
                <Input
                  value={settings.vendor.socialLinks.twitter}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        socialLinks: {
                          ...prev.vendor.socialLinks,
                          twitter: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

        <TabsContent value="share" className="space-y-6">
          <VendorShareSettings
            value={settings.vendor.shareSettings}
            onChange={(shareSettings) =>
              setSettings((prev) => ({
                ...prev,
                vendor: {
                  ...prev.vendor,
                  shareSettings,
                },
              }))
            }
          />
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {tSafe("vendor.paymentSettings", "Payment Settings")}
            </CardTitle>
            <CardDescription>
              {tSafe(
                "vendor.paymentSettingsDesc",
                "Manage your payout details",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  {tSafe("vendor.settingsForm.accountName", "Account Name")}
                </Label>
                <Input
                  value={settings.vendor.bankDetails.accountName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        bankDetails: {
                          ...prev.vendor.bankDetails,
                          accountName: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {tSafe("vendor.settingsForm.accountNumber", "Account Number")}
                </Label>
                <Input
                  value={settings.vendor.bankDetails.accountNumber}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        bankDetails: {
                          ...prev.vendor.bankDetails,
                          accountNumber: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("vendor.settingsForm.bankName", "Bank Name")}</Label>
                <Input
                  value={settings.vendor.bankDetails.bankName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        bankDetails: {
                          ...prev.vendor.bankDetails,
                          bankName: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {tSafe("vendor.settingsForm.routingNumber", "Routing Number")}
                </Label>
                <Input
                  value={settings.vendor.bankDetails.routingNumber}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        bankDetails: {
                          ...prev.vendor.bankDetails,
                          routingNumber: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{tSafe("vendor.settingsForm.swiftCode", "SWIFT Code")}</Label>
                <Input
                  value={settings.vendor.bankDetails.swiftCode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        bankDetails: {
                          ...prev.vendor.bankDetails,
                          swiftCode: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  {tSafe("vendor.settingsForm.payoutSchedule", "Payout Schedule")}
                </Label>
                <Select
                  value={settings.vendor.payoutSettings.schedule}
                  onValueChange={(value: "weekly" | "biweekly" | "monthly") =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        payoutSettings: {
                          ...prev.vendor.payoutSettings,
                          schedule: value,
                        },
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">
                      {tSafe("vendor.settingsForm.payoutWeekly", "Weekly")}
                    </SelectItem>
                    <SelectItem value="biweekly">
                      {tSafe("vendor.settingsForm.payoutBiweekly", "Biweekly")}
                    </SelectItem>
                    <SelectItem value="monthly">
                      {tSafe("vendor.settingsForm.payoutMonthly", "Monthly")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {tSafe(
                    "vendor.settingsForm.minimumPayoutAmount",
                    "Minimum Payout Amount",
                  )}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={minPayoutValue}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: {
                        ...prev.vendor,
                        payoutSettings: {
                          ...prev.vendor.payoutSettings,
                          minimumAmount:
                            Number.isFinite(Number(e.target.value))
                              ? Number(e.target.value)
                              : 0,
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {tSafe("vendor.notificationSettings", "Notification Settings")}
            </CardTitle>
            <CardDescription>
              {tSafe(
                "vendor.notificationSettingsDesc",
                "Control how you receive updates",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">
                  {tSafe("vendor.settingsForm.newOrders", "New Orders")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tSafe(
                    "vendor.settingsForm.newOrdersDesc",
                    "Receive alerts when customers place a new order.",
                  )}
                </p>
              </div>
              <Switch
                checked={settings.vendor.notificationPreferences.newOrders}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    vendor: {
                      ...prev.vendor,
                      notificationPreferences: {
                        ...prev.vendor.notificationPreferences,
                        newOrders: checked,
                      },
                    },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">
                  {tSafe(
                    "vendor.settingsForm.orderStatusUpdates",
                    "Order Status Updates",
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tSafe(
                    "vendor.settingsForm.orderStatusUpdatesDesc",
                    "Get reminders and status updates for your active orders.",
                  )}
                </p>
              </div>
              <Switch
                checked={settings.vendor.notificationPreferences.orderUpdates}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    vendor: {
                      ...prev.vendor,
                      notificationPreferences: {
                        ...prev.vendor.notificationPreferences,
                        orderUpdates: checked,
                      },
                    },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">
                  {tSafe("vendor.settingsForm.lowStockAlerts", "Low Stock Alerts")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tSafe(
                    "vendor.settingsForm.lowStockAlertsDesc",
                    "Notify me when products are running low.",
                  )}
                </p>
              </div>
              <Switch
                checked={settings.vendor.notificationPreferences.lowStock}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    vendor: {
                      ...prev.vendor,
                      notificationPreferences: {
                        ...prev.vendor.notificationPreferences,
                        lowStock: checked,
                      },
                    },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">
                  {tSafe(
                    "vendor.settingsForm.productTipsAndUpdates",
                    "Product Tips and Updates",
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tSafe(
                    "vendor.settingsForm.productTipsAndUpdatesDesc",
                    "Receive product announcements and vendor improvement tips.",
                  )}
                </p>
              </div>
              <Switch
                checked={settings.vendor.notificationPreferences.marketing}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    vendor: {
                      ...prev.vendor,
                      notificationPreferences: {
                        ...prev.vendor.notificationPreferences,
                        marketing: checked,
                      },
                    },
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

        {vendorShippingEnabled ? (
          <TabsContent value="shipping" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {tSafe("admin.settings.shipping.title", "Shipping & Delivery")}
                </CardTitle>
                <CardDescription>
                  {tSafe(
                    "vendor.shippingSettingsDesc",
                    "Configure how your own products are shipped. These rates apply to your items in customer carts.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VendorShippingEditor
                  value={settings.vendor.shipping || EMPTY_VENDOR_SHIPPING}
                  onChange={(next) =>
                    setSettings((prev) => ({
                      ...prev,
                      vendor: { ...prev.vendor, shipping: next },
                    }))
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="account" className="space-y-6">
        {demoMode.enabled && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5">Demo mode</p>
              <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                {demoMode.message}
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{tSafe("vendor.accountSettings", "Account")}</CardTitle>
            <CardDescription>
              {tSafe(
                "vendor.accountSettingsDesc",
                "Manage your personal account details",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center">
              <div className="w-24 shrink-0">
                <MediaUploader
                  value={
                    settings.user.image
                      ? [
                          {
                            _id: "vendor-profile-image",
                            url: settings.user.image,
                            type: "image",
                            mimeType: "image/*",
                            alt: `${settings.user.name || "Vendor"} profile image`,
                            position: 0,
                          },
                        ]
                      : []
                  }
                  onChange={(items) =>
                    setSettings((prev) => ({
                      ...prev,
                      user: {
                        ...prev.user,
                        image:
                          items.find((item) => item.type === "image")?.url || "",
                      },
                    }))
                  }
                  maxFiles={1}
                  acceptTypes={["image"]}
                  accept={VENDOR_IMAGE_ACCEPT}
                  allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                  disabled={demoMode.enabled}
                  uploadTitle="Upload"
                  uploadDescription=""
                  mediaGridClassName="grid-cols-1 md:grid-cols-1"
                  uploadZoneClassName="aspect-square rounded-full p-2"
                  previewAspectRatio="1 / 1"
                  previewFit="cover"
                  previewTileClassName="rounded-full overflow-hidden bg-slate-100"
                  showCoverBadge={false}
                  coverHint={false}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {tSafe("profile.profileImage", "Profile image")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tSafe(
                    "profile.profileImageHint",
                    "This photo appears on your account and storefront. JPG, PNG or WEBP — recommended 512 × 512 px.",
                  )}
                </p>
              </div>
            </div>
            <fieldset disabled={demoMode.enabled} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tSafe("profile.fullName", "Full Name")}</Label>
                <Input
                  value={settings.user.name}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      user: { ...prev.user, name: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("profile.email", "Email")}</Label>
                <Input value={settings.user.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>{tSafe("profile.phone", "Phone")}</Label>
                <Input
                  value={settings.user.phone}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      user: { ...prev.user, phone: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {tSafe("profile.changePassword", "Change Password")}
            </CardTitle>
            <CardDescription>
              {tSafe(
                "vendor.settingsForm.changePasswordDesc",
                "Update your password to keep your vendor account secure.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset disabled={demoMode.enabled} className="space-y-4">
            <div className="space-y-2">
              <Label>{tSafe("profile.oldPassword", "Current Password")}</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tSafe("profile.newPassword", "New Password")}</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tSafe("profile.confirmPassword", "Confirm Password")}</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                />
            </div>

            <Button
              onClick={onPasswordSave}
              disabled={demoMode.enabled || isChangingPassword}
            >
              {isChangingPassword && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tSafe("profile.updatePassword", "Update Password")}
            </Button>
            </fieldset>
          </CardContent>
        </Card>

        {/* Two-factor authentication (personal preference; only shown when the
            administrator has enabled the 2FA feature). */}
        <TwoFactorManagementCard
          disabled={demoMode.enabled}
          disabledMessage={demoMode.enabled ? demoMode.message : undefined}
        />
        </TabsContent>
      </Tabs>
    </div>
  );
}
