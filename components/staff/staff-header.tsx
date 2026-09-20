"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, LogOut, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";
import { locales, localeConfig, type Locale } from "@/config/i18n.config";
import { cn } from "@/lib/utils";

interface StaffHeaderProps {
  user: {
    name: string;
    email: string;
    image?: string;
  };
  locale: Locale;
  posEnabled?: boolean;
}

export function StaffHeader({ user, locale, posEnabled }: StaffHeaderProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();

  const tf = React.useCallback(
    (key: string, fallback: string) => {
      const msg = t(key as never);
      return msg === key ? fallback : msg;
    },
    [t],
  );

  const basePath = React.useMemo(() => {
    const prefix = `/${locale}`;
    if (pathname?.startsWith(prefix)) {
      const stripped = pathname.slice(prefix.length);
      return stripped.length ? stripped : "/";
    }
    return pathname || "/";
  }, [pathname, locale]);

  const isPosTerminal = basePath === "/staff/pos";

  const handleLogout = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const handleLocaleChange = (newLocale: Locale) => {
    if (!pathname) return;
    const currentPrefix = `/${locale}`;
    const newPathname = pathname.startsWith(currentPrefix)
      ? pathname.replace(currentPrefix, `/${newLocale}`)
      : `/${newLocale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
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
          : "border-b bg-background/95 supports-[backdrop-filter]:bg-background/80",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="size-9" />
      </div>

      {/* Center quick actions */}
      <div className="hidden items-center justify-center gap-2 justify-self-center sm:flex">
        {isPosTerminal ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2"
            asChild
          >
            <Link href={`/${locale}/staff/dashboard`}>
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">
                {tf("common.backToDashboard", "Dashboard")}
              </span>
            </Link>
          </Button>
        ) : posEnabled ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 border-primary/20 text-primary hover:bg-primary/5"
            asChild
          >
            <Link href={`/${locale}/staff/pos`}>
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">
                {tf("admin.sidebar.pos", "POS")}
              </span>
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
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
          <DropdownMenuContent
            align="start"
            sideOffset={10}
            collisionPadding={12}
            className="w-48 max-h-[min(22rem,var(--radix-dropdown-menu-content-available-height))] rounded-xl border-border/60 bg-popover/95 shadow-xl backdrop-blur"
          >
            <DropdownMenuLabel>
              {tf("common.selectLanguage", "Select Language")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {locales.map((loc) => (
              <DropdownMenuItem
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className="flex min-h-9 items-center justify-between cursor-pointer"
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
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            collisionPadding={12}
            className="w-56 max-w-[calc(100vw-1.5rem)] rounded-xl border-border/60 bg-popover/95 shadow-xl backdrop-blur"
          >
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
                href={`/${locale}/staff/profile`}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span>{tf("common.profile", "Profile")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{tf("common.logout", "Log out")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
