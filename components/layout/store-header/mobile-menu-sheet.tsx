"use client";

import type { CSSProperties, Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Globe,
  Globe2,
  Heart,
  Home,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  Rss,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Sun,
  User,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  MegaMenuItemVisual,
  getHeaderMenuItemKey,
} from "@/components/layout/store-header/mega-menu";
import type { HeaderMenuItem } from "@/components/layout/store-header";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAppTheme } from "@/providers/theme-provider";
import { useCurrency } from "@/providers/currency-provider";
import { useLanguage } from "@/providers/language-provider";
import type {
  CategoryNode,
  CollectionItem,
  SearchSuggestion,
} from "@/components/layout/store-header/types";

export interface MobileMenuSheetProps {
  locale: string;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  closeMobileMenu: () => void;
  categories: CategoryNode[];
  collections: CollectionItem[];
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  searchSuggestions: SearchSuggestion[];
  searchPlaceholder: string;
  searchInputStyle: CSSProperties;
  showMobileSearch: boolean;
  showAiSearch: boolean;
  showSearchSuggestions: boolean;
  showMobileMarketSelectors: boolean;
  showMobileThemeSelector: boolean;
  showMobileCollections: boolean;
  showMobileAccountSummary: boolean;
  showMobileCategoryShortcuts: boolean;
  showLanguageSelector: boolean;
  showCurrencySelector: boolean;
  showCollectionsMenu: boolean;
  showUtilityMenu: boolean;
  showWishlist: boolean;
  showCart: boolean;
  showAccountMenu: boolean;
  categoryMenuLabel: string;
  collectionsMenuLabel: string;
  categoriesPageHref: string;
  getDashboardLink: () => string | null;
  getSettingsLink: () => string;
  getInitials: (name: string) => string;
  handleLogout: () => void | Promise<void>;
  handleMobileSearch: (e: React.FormEvent) => void;
  handleSearchQueryChange: (value: string) => void;
  handleAISalesAgentOpen: () => void;
  handleMobileLanguageChange: (value: string) => void;
  handleThemeChange: (value: "light" | "dark" | "system") => void;
  setShowSearchSuggestions: Dispatch<SetStateAction<boolean>>;
  setIsCartOpen: Dispatch<SetStateAction<boolean>>;
  isSearching: boolean;
  menuItems: HeaderMenuItem[] | undefined;
  megaMenuRootItems: HeaderMenuItem[];
  hasCustomMegaMenu: boolean;
  hasMegaRootOverflow: boolean;
  hasCategoryOverflow: boolean;
  categoryMobileLimit: number;
  collectionsLimit: number;
  megaMenuRootLimit: number;
}

export function MobileMenuSheet({
  locale,
  isOpen,
  setIsOpen,
  closeMobileMenu,
  categories,
  collections,
  searchQuery,
  setSearchQuery,
  searchSuggestions,
  searchPlaceholder,
  searchInputStyle,
  showMobileSearch,
  showAiSearch,
  showSearchSuggestions,
  showMobileMarketSelectors,
  showMobileThemeSelector,
  showMobileCollections,
  showMobileAccountSummary,
  showMobileCategoryShortcuts,
  showLanguageSelector,
  showCurrencySelector,
  showCollectionsMenu,
  showUtilityMenu,
  showWishlist,
  showCart,
  showAccountMenu,
  categoryMenuLabel,
  collectionsMenuLabel,
  categoriesPageHref,
  getDashboardLink,
  getSettingsLink,
  getInitials,
  handleLogout,
  handleMobileSearch,
  handleSearchQueryChange,
  handleAISalesAgentOpen,
  handleMobileLanguageChange,
  handleThemeChange,
  setShowSearchSuggestions,
  setIsCartOpen,
  isSearching,
  menuItems,
  megaMenuRootItems,
  hasCustomMegaMenu,
  hasMegaRootOverflow,
  hasCategoryOverflow,
  categoryMobileLimit,
  collectionsLimit,
  megaMenuRootLimit,
}: MobileMenuSheetProps) {
  const t = useTranslations();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { totalItems } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { theme, setTheme } = useAppTheme();
  const { currency, currencies, setCurrency } = useCurrency();
  const { language, languages, setLanguage } = useLanguage();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 xl:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(92vw,380px)] gap-0 overflow-y-auto p-0"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex min-h-full flex-col">
          {showMobileAccountSummary && (
            <div className="px-5 pb-4 pt-7">
              {isLoading ? (
                <div className="h-18 animate-pulse rounded-xl bg-muted/70" />
              ) : isAuthenticated && user ? (
                <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage
                      src={user.image || undefined}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                    />
                    <AvatarFallback>
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild className="h-10 rounded-full">
                    <Link
                      href={`/${locale}/login`}
                      onClick={closeMobileMenu}
                    >
                      <LogIn className="h-4 w-4" />
                      {t("common.signIn")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-10 rounded-full"
                  >
                    <Link
                      href={`/${locale}/register`}
                      onClick={closeMobileMenu}
                    >
                      <UserPlus className="h-4 w-4" />
                      {t("common.register")}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {showMobileSearch && (
            <div className="px-5 pb-4 pt-5">
              <form onSubmit={handleMobileSearch}>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={searchPlaceholder}
                  className="h-11 rounded-full border border-[#dddddd] bg-transparent pl-10 pr-11 shadow-none placeholder:opacity-70 focus-visible:border-[#d3d3d3] focus-visible:bg-transparent focus-visible:ring-0 dark:border-white/15 dark:focus-visible:border-white/25"
                  style={searchInputStyle}
                  value={searchQuery}
                  onChange={(e) =>
                    handleSearchQueryChange(e.target.value)
                  }
                />
                {showAiSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      handleAISalesAgentOpen();
                      closeMobileMenu();
                    }}
                    aria-label={t("common.aiSearch")}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full"
                  >
                    <Image
                      src="/AI Icon.png"
                      alt=""
                      height={24}
                      width={24}
                    />
                  </button>
                )}
              </div>
              {showSearchSuggestions &&
                searchQuery.trim().length >= 2 && (
                  <div className="mt-2 overflow-hidden rounded-xl border bg-background shadow-sm">
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {isSearching ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {t("common.loading")}
                        </div>
                      ) : searchSuggestions.length > 0 ? (
                        <div className="space-y-1">
                          {searchSuggestions.map((product) => {
                            const label =
                              product.name ||
                              product.title ||
                              "Product";
                            return (
                              <Link
                                key={product._id}
                                href={`/${locale}/products/${product.slug}`}
                                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                                onClick={() => {
                                  setSearchQuery(label);
                                  setShowSearchSuggestions(false);
                                  closeMobileMenu();
                                }}
                              >
                                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted/40">
                                  {product.images?.[0] ? (
                                    <AppImage
                                      src={product.images[0]}
                                      alt={label}
                                      className="h-full w-full object-cover"
                                      width={36}
                                      height={36}
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-muted/60" />
                                  )}
                                </div>
                                <span className="min-w-0 truncate text-sm font-medium">
                                  {label}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {t("common.noProductsFound")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {(showCart || showWishlist) && (
            <div className="grid grid-cols-2 gap-2 px-5 pb-5">
              {showCart && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-start rounded-xl"
                  onClick={() => {
                    closeMobileMenu();
                    setIsCartOpen(true);
                  }}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span className="flex-1 text-left">
                    {t("common.cart")}
                  </span>
                  {totalItems > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {totalItems > 99 ? "99+" : totalItems}
                    </Badge>
                  )}
                </Button>
              )}
              {showWishlist && (
                <Button
                  asChild
                  variant="outline"
                  className="h-11 justify-start rounded-xl"
                >
                  <Link
                    href={
                      isAuthenticated
                        ? `/${locale}/account/wishlist`
                        : `/${locale}/login?redirect=${encodeURIComponent(
                            `/${locale}/account/wishlist`,
                          )}`
                    }
                    onClick={closeMobileMenu}
                  >
                    <Heart className="h-4 w-4" />
                    <span className="flex-1 text-left">
                      {t("nav.wishlist")}
                    </span>
                    {wishlistItems.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {wishlistItems.length}
                      </Badge>
                    )}
                  </Link>
                </Button>
              )}
            </div>
          )}

          <Separator />

          <nav className="grid gap-1 px-3 py-4 text-sm font-medium">
            <Link
              href={`/${locale}`}
              onClick={closeMobileMenu}
              className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              {t("nav.home")}
            </Link>
            <Link
              href={`/${locale}/products`}
              onClick={closeMobileMenu}
              className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
            >
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              {t("nav.products")}
            </Link>
            {showCollectionsMenu && (
              <Link
                href={`/${locale}/collections`}
                onClick={closeMobileMenu}
                className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
              >
                <Layers className="h-4 w-4 text-muted-foreground" />
                {collectionsMenuLabel}
              </Link>
            )}
            {showUtilityMenu && (menuItems && menuItems.length > 0 ? (
              menuItems.map((item, idx) => {
                const isBlog =
                  item.label.toLowerCase() === "blog" ||
                  item.href.includes("/blog");
                const isTrackOrder =
                  item.label.toLowerCase() === "track order" ||
                  item.href.includes("/track-order");

                return (
                  <Link
                    key={`m-${item.href}-${idx}`}
                    href={item.href}
                    target={item.target}
                    rel={
                      item.target === "_blank"
                        ? "noopener noreferrer"
                        : undefined
                    }
                    onClick={closeMobileMenu}
                    className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                  >
                    {isTrackOrder ? (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    ) : isBlog ? (
                      <Rss className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                    {item.label}
                  </Link>
                );
              })
            ) : (
              <>
                <Link
                  href={`/${locale}/blog`}
                  onClick={closeMobileMenu}
                  className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                >
                  <Rss className="h-4 w-4 text-muted-foreground" />
                  {t("nav.blog")}
                </Link>
                <Link
                  href={`/${locale}/track-order`}
                  onClick={closeMobileMenu}
                  className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Track Order
                </Link>
              </>
            ))}
          </nav>

          {hasCustomMegaMenu ? (
            <>
              <Separator />
              <section className="px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {categoryMenuLabel}
                  </h3>
                  {hasMegaRootOverflow ? (
                    <Link
                      href={categoriesPageHref}
                      onClick={closeMobileMenu}
                      className="text-xs font-medium text-primary"
                    >
                      {t("common.viewAll")}
                    </Link>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {megaMenuRootItems
                    .slice(
                      0,
                      Math.min(
                        categoryMobileLimit,
                        megaMenuRootLimit,
                      ),
                    )
                    .map((item) => (
                    <Link
                      key={getHeaderMenuItemKey(item)}
                      href={item.href}
                      target={item.target}
                      rel={
                        item.target === "_blank"
                          ? "noopener noreferrer"
                          : undefined
                      }
                      onClick={closeMobileMenu}
                      className="flex min-w-0 items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted/60">
                        <MegaMenuItemVisual
                          item={item}
                          className="h-4 w-4"
                        />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : showMobileCategoryShortcuts && categories.length > 0 ? (
            <>
              <Separator />
              <section className="px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {categoryMenuLabel}
                  </h3>
                  {hasCategoryOverflow ? (
                    <Link
                      href={categoriesPageHref}
                      onClick={closeMobileMenu}
                      className="text-xs font-medium text-primary"
                    >
                      {t("common.viewAll")}
                    </Link>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categories
                    .slice(
                      0,
                      Math.min(
                        categoryMobileLimit,
                        megaMenuRootLimit,
                      ),
                    )
                    .map((cat) => (
                    <Link
                      key={cat._id}
                      href={`/${locale}/products?category=${encodeURIComponent(
                        cat.slug,
                      )}`}
                      onClick={closeMobileMenu}
                      className="flex min-w-0 items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted/60">
                        {cat.icon || cat.image ? (
                          <AppImage
                            src={(cat.icon || cat.image) as string}
                            alt={cat.name}
                            className="h-5 w-5 object-contain"
                            width={20}
                            height={20}
                          />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="truncate">{cat.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {showMobileCollections && collections.length > 0 && (
            <>
              <Separator />
              <section className="px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {collectionsMenuLabel}
                  </h3>
                  <Link
                    href={`/${locale}/collections`}
                    onClick={closeMobileMenu}
                    className="text-xs font-medium text-primary"
                  >
                    {t("common.viewAll")}
                  </Link>
                </div>
                <div className="space-y-2">
                  {collections.slice(0, collectionsLimit).map((col) => (
                    <Link
                      key={col._id}
                      href={`/${locale}/collections/${col.slug}`}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 rounded-xl border bg-background p-2.5 transition-colors hover:bg-muted/60"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted/50">
                        {col.image?.url ? (
                          <AppImage
                            src={col.image.url}
                            alt={col.image.alt || col.title}
                            width={40}
                            height={40}
                            className="h-10 w-10 object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-muted-foreground">
                            <Layers className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {col.title}
                        </p>
                        {col.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {col.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}

          {(showMobileThemeSelector || showMobileMarketSelectors) && (
            <>
              <Separator />

              <section className="space-y-4 px-5 py-4">
                <h3 className="text-sm font-semibold">
                  {t("common.settings")}
                </h3>
                {showMobileThemeSelector && (
                  <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    mode: "light" as const,
                    label: "Light",
                    icon: Sun,
                  },
                  {
                    mode: "dark" as const,
                    label: "Dark",
                    icon: Moon,
                  },
                  {
                    mode: "system" as const,
                    label: "System",
                    icon: Monitor,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = theme === item.mode;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => handleThemeChange(item.mode)}
                      className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted/60"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
                )}

                {showMobileMarketSelectors && (
                  <div className="grid gap-3">
                    {showLanguageSelector && (
                      <label className="grid gap-1.5 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  {t("common.language")}
                </span>
                <div className="relative">
                  <select
                    value={language.code}
                    onChange={(event) =>
                      handleMobileLanguageChange(event.target.value)
                    }
                    className="h-11 w-full appearance-none rounded-xl border bg-background px-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </label>
                    )}

                    {showCurrencySelector && (
                      <label className="grid gap-1.5 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  {t("common.currency")}
                </span>
                <div className="relative">
                  <select
                    value={currency.code}
                    onChange={(event) =>
                      setCurrency(event.target.value)
                    }
                    className="h-11 w-full appearance-none rounded-xl border bg-background px-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {currencies.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.code} - {curr.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </label>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {showAccountMenu && (
            <>
              <Separator />

              <section className="px-3 py-4">
                <div className="grid gap-1 text-sm font-medium">
              {isAuthenticated && user ? (
                <>
                  {getDashboardLink() ? (
                    <>
                      <Link
                        href={getDashboardLink()!}
                        onClick={closeMobileMenu}
                        className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                      >
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                        {t("common.dashboard")}
                      </Link>
                      <Link
                        href={getSettingsLink()}
                        onClick={closeMobileMenu}
                        className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        {t("admin.settings.title")}
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/${locale}/account`}
                        onClick={closeMobileMenu}
                        className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        {t("common.account")}
                      </Link>
                      <Link
                        href={`/${locale}/account/orders`}
                        onClick={closeMobileMenu}
                        className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                      >
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {t("orders.myOrders")}
                      </Link>
                      <Link
                        href={`/${locale}/account/profile`}
                        onClick={closeMobileMenu}
                        className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        {t("common.profile")}
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu();
                      void handleLogout();
                    }}
                    className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("common.logout")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/${locale}/login?redirect=${encodeURIComponent(
                      `/${locale}/account`,
                    )}`}
                    onClick={closeMobileMenu}
                    className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    {t("common.dashboard")}
                  </Link>
                  <Link
                    href={`/${locale}/login?redirect=${encodeURIComponent(
                      `/${locale}/account/orders`,
                    )}`}
                    onClick={closeMobileMenu}
                    className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                  >
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {t("common.myOrders")}
                  </Link>
                  <Link
                    href={`/${locale}/login?redirect=${encodeURIComponent(
                      `/${locale}/account/profile`,
                    )}`}
                    onClick={closeMobileMenu}
                    className="flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    {t("common.profile")}
                  </Link>
                </>
              )}
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
