"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  User,
  Package,
  Heart,
  MapPin,
  LogOut,
  Pencil,
  Loader2,
  LayoutDashboard,
  Shield,
  Settings2,
  Star,
  Bell,
  MessageSquare,
} from "lucide-react";
import type { LoyaltyTier } from "@/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast-notification";
import {
  DEFAULT_PROFILE_DEMO_MODE,
  normalizeDemoModeState,
} from "@/lib/demo-mode-shared";

const tierColors: Record<LoyaltyTier, string> = {
  bronze:
    "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-500/30",
  silver:
    "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-500/20 dark:text-gray-200 dark:border-gray-500/30",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-500/30",
  platinum:
    "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-500/30",
};

interface AccountSidebarProps {
  locale: string;
  stats?: {
    ordersCount?: number;
    wishlistCount?: number;
    addressesCount?: number;
    notificationsCount?: number;
    loyaltyTier?: LoyaltyTier;
    loyaltyPoints?: number;
  };
}

const dashboardLinks = [
  {
    labelKey: "common.overview",
    href: "/account",
    icon: LayoutDashboard,
  },
  {
    labelKey: "account.orders",
    href: "/account/orders",
    icon: Package,
    countKey: "ordersCount",
  },
  {
    labelKey: "common.notifications",
    href: "/account/notifications",
    icon: Bell,
    countKey: "notificationsCount",
  },
  {
    labelKey: "account.inbox",
    labelFallback: "Inbox",
    href: "/account/inbox",
    icon: MessageSquare,
  },
  {
    labelKey: "account.wishlist",
    href: "/account/wishlist",
    icon: Heart,
    countKey: "wishlistCount",
  },
];

const settingsLinks = [
  {
    labelKey: "account.profile",
    href: "/account/profile",
    icon: User,
  },
  {
    labelKey: "customerProfile.preferences",
    href: "/account/preferences",
    icon: Settings2,
  },
  {
    labelKey: "account.addresses",
    href: "/account/addresses",
    icon: MapPin,
    countKey: "addressesCount",
  },
  {
    labelKey: "account.security",
    href: "/account/security",
    icon: Shield,
  },
];

export function AccountSidebar({ locale, stats = {} }: AccountSidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user } = useAuth();
  const [liveStats, setLiveStats] = useState(stats);
  const [demoMode, setDemoMode] = useState(DEFAULT_PROFILE_DEMO_MODE);
  const isProfilePage = pathname === `/${locale}/account/profile`;
  const isProfileDemoMode = isProfilePage && demoMode.enabled;

  useEffect(() => {
    let isActive = true;

    const refresh = async () => {
      try {
        const res = await fetch("/api/user/account-stats");
        const json = await res.json().catch(() => null);
        if (!isActive) return;
        if (!res.ok || !json?.success) return;
        const nextStats = json?.data?.stats;
        if (nextStats) setLiveStats(nextStats);
      } catch {}
    };

    const onStatsChanged = () => {
      refresh();
    };

    refresh();
    window.addEventListener("account:stats-changed", onStatsChanged as EventListener);

    return () => {
      isActive = false;
      window.removeEventListener("account:stats-changed", onStatsChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isProfilePage) return;

    let isActive = true;

    const loadDemoMode = async () => {
      try {
        const res = await fetch("/api/user/profile");
        const json = await res.json().catch(() => null);
        const loadedDemoMode = json?.data?.demoMode;
        if (!isActive) {
          return;
        }

        setDemoMode(normalizeDemoModeState(loadedDemoMode));
      } catch {}
    };

    void loadDemoMode();

    return () => {
      isActive = false;
    };
  }, [isProfilePage]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isActive = (href: string) => {
    const fullPath = `/${locale}${href}`;
    // Exact match for /account (Overview), prefix match for sub-pages
    if (href === "/account") {
      return pathname === fullPath;
    }
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    if (isProfileDemoMode) {
      toast.error(demoMode.message);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProfileDemoMode) {
      toast.error(demoMode.message);
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
    if (!file.type.startsWith("image/")) {
      toast.error(`"${file.name}" is not an image file. Please select an image.`);
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        // Surface the server's exact reason (size limit, disallowed type,
        // storage misconfiguration, …) instead of failing silently.
        const serverError =
          Array.isArray(json?.errors) && json.errors.length > 0
            ? json.errors.join(", ")
            : json?.message;
        throw new Error(
          serverError || `Upload failed for ${file.name} (${fileSizeMB}MB)`,
        );
      }

      const uploadedUrl =
        (Array.isArray(json?.data) ? json.data?.[0]?.url : json?.url) ??
        undefined;
      if (!uploadedUrl) {
        throw new Error("Upload succeeded but URL is missing");
      }

      await authClient.updateUser({ image: uploadedUrl }).catch(() => null);

      const profileRes = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedUrl }),
      });
      const profileJson = await profileRes.json().catch(() => null);
      if (!profileRes.ok || profileJson?.success === false) {
        throw new Error(
          profileJson?.message || "Failed to save the new avatar to your profile",
        );
      }

      window.location.reload();
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to upload avatar",
      );
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="w-full lg:w-64 lg:shrink-0">
      <div className="bg-card sticky top-[calc(var(--storefront-header-height,5rem)+1rem)] max-h-[calc(100vh-var(--storefront-header-height,5rem)-2rem)] overflow-y-auto rounded-lg border p-4">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={user?.image || undefined}
                alt={user?.name}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback className="text-base font-semibold bg-primary text-primary-foreground">
                {user?.name ? getInitials(user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handleAvatarClick}
              disabled={isUploading || isProfileDemoMode}
              className="absolute -right-1 -bottom-1 p-1 rounded-full bg-background border shadow-sm hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              title={t("account.changePhoto")}
            >
              {isUploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Pencil className="h-3 w-3" />
              )}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">
              {user?.name || "Guest"}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
            {liveStats.loyaltyTier && (
              <Badge
                variant="outline"
                className={cn(
                  "mt-1 px-1.5 py-0 text-[10px]",
                  tierColors[liveStats.loyaltyTier],
                )}
              >
                <Star className="h-2.5 w-2.5 mr-1" />
                {t(`customerProfile.${liveStats.loyaltyTier}`)}
              </Badge>
            )}
          </div>
        </div>

        <Separator className="mb-3" />

        {/* Dashboard Section */}
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-2">
            {t("common.dashboard")}
          </p>
          <nav className="space-y-1">
            {dashboardLinks.map((link) => {
              const Icon = link.icon;
              const count =
                link.countKey &&
                liveStats[link.countKey as keyof typeof liveStats];
              return (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className={cn(
                    "flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>
                      {"labelFallback" in link && link.labelFallback
                        ? t.has(link.labelKey)
                          ? t(link.labelKey)
                          : link.labelFallback
                        : t(link.labelKey)}
                    </span>
                  </div>
                  {typeof count === "number" && count > 0 && (
                    <Badge
                      variant={isActive(link.href) ? "secondary" : "outline"}
                      className="ml-auto"
                    >
                      {count}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Account Settings Section */}
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-2">
            {t("admin.settings.title")}
          </p>
          <nav className="space-y-1">
            {settingsLinks.map((link) => {
              const Icon = link.icon;
              const count =
                link.countKey &&
                liveStats[link.countKey as keyof typeof liveStats];
              return (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className={cn(
                    "flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{t(link.labelKey)}</span>
                  </div>
                  {typeof count === "number" && count > 0 && (
                    <Badge
                      variant={isActive(link.href) ? "secondary" : "outline"}
                      className="ml-auto"
                    >
                      {count}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <Separator className="mb-3" />

        {/* Logout Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:border-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("auth.signOut")}
        </Button>
      </div>
    </div>
  );
}
