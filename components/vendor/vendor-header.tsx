"use client";

import Link from "next/link";
import { signOut } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useRouter, usePathname } from "next/navigation";
import {
  User,
  Settings,
  LogOut,
  Store,
  LayoutDashboard,
  Globe,
  ShoppingCart,
} from "lucide-react";
import { SettingsDrawer } from "@/components/admin/settings-drawer";
import { locales, localeConfig, type Locale } from "@/config/i18n.config";
import { NotificationDrawer } from "@/components/admin/notification-drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";
import { DEFAULT_STORE_NAME } from "@/config/branding.config";

interface VendorHeaderProps {
  user: {
    name: string;
    email: string;
    image?: string;
  };
  locale: Locale;
  storeName?: string;
  storeLogo?: string;
  storeDomain?: string;
  posEnabled?: boolean;
}

export function VendorHeader({
  user,
  locale,
  storeName,
  storeLogo,
  storeDomain,
  posEnabled,
}: VendorHeaderProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const isPosTerminal = pathname?.startsWith(`/${locale}/vendor/pos`) ?? false;

  const handleLogout = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const handleLocaleChange = (newLocale: Locale) => {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const currentLocaleConfig = localeConfig[locale];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 backdrop-blur transition-[width,height] ease-linear sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
        isPosTerminal
          ? "bg-card"
          : "bg-background/50"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isPosTerminal ? (
          <Link
            href={`/${locale}/vendor/dashboard`}
            className="flex items-center gap-2 shrink-0 mr-1"
            aria-label={
              typeof storeName === "string" && storeName.trim()
                ? storeName
                : DEFAULT_STORE_NAME
            }
          >
            {typeof storeLogo === "string" && storeLogo.trim() ? (
              <span className="relative block h-8 w-32 overflow-hidden">
                <AppImage
                  src={storeLogo}
                  alt={`${storeName || "Store"} logo`}
                  width={128}
                  height={32}
                  className="h-8 w-full object-contain object-left"
                />
              </span>
            ) : (
              <span className="bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent text-lg font-bold truncate">
                {typeof storeName === "string" && storeName.trim()
                  ? storeName
                  : DEFAULT_STORE_NAME}
              </span>
            )}
          </Link>
        ) : (
          <>
            <SidebarTrigger className="size-9" />
            {storeName && (
              <div className="flex items-center gap-2 ml-2">
                <Store className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg hidden sm:block">
                  {storeName}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="hidden items-center justify-center gap-2 justify-self-center sm:flex">
        {isPosTerminal ? (
          <Button variant="outline" size="sm" className="rounded-xl gap-2" asChild>
            <Link href={`/${locale}/vendor/dashboard`}>
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("common.backToDashboard")}
              </span>
            </Link>
          </Button>
        ) : posEnabled ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/5 dark:border-border dark:text-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
            asChild
          >
            <Link href={`/${locale}/vendor/pos`}>
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">POS</span>
            </Link>
          </Button>
        ) : null}
        {storeDomain && (
          <Button variant="outline" size="sm" className="rounded-xl gap-2" asChild>
            <a
              href={storeDomain.startsWith("http") ? storeDomain : `https://${storeDomain}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("admin.browseWebsite")}
              </span>
            </a>
          </Button>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
            >
              <span className="text-xl">{currentLocaleConfig.flag}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              {t("common.selectLanguage")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {locales.map((loc) => (
              <DropdownMenuItem
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className="flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">{localeConfig[loc].flag}</span>
                  <span>{localeConfig[loc].nativeName}</span>
                </span>
                {locale === loc && (
                  <span className="text-primary font-bold">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Drawer */}
        <NotificationDrawer locale={locale} />

        {/* Settings Drawer */}
        <SettingsDrawer locale={locale} />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10 border border-border p-1"
            >
              <Avatar className="h-full w-full">
                <AvatarImage src={user.image} alt={user.name} />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={`/${locale}/vendor/settings?tab=account`}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span>
                  {t("common.profile")}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/${locale}/vendor/settings?tab=store`}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>
                  {t("common.settings")}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${locale}`} className="cursor-pointer">
                <Store className="mr-2 h-4 w-4" />
                <span>{t("vendor.viewStore")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("auth.signOut")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
