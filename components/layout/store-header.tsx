"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  Search,
  Menu,
  User,
  LayoutDashboard,
  LogOut,
  Package,
  Heart,
  Settings,
  Store,
  ChevronDown,
  Sun,
  Moon,
  Sparkles,
  Rss,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { useWishlist } from "@/hooks/use-wishlist";
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppImage } from "@/components/ui/app-image";
import { usePathname, useRouter } from "next/navigation";
import { useAppTheme } from "@/providers/theme-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { appConfig, USER_ROLES } from "@/config/app.config";
import { isStaffRole } from "@/lib/staff-role";
import { useAppSettings } from "@/providers/app-settings-provider";
import { useCurrency } from "@/providers/currency-provider";
import { useLanguage } from "@/providers/language-provider";
import { type Locale } from "@/config/i18n.config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppSettings as useGlobalAppSettings } from "@/stores/app-settings";
import type { HeaderSettings } from "@/lib/header-config";
import { cn } from "@/lib/utils";
import {
  MAX_MEGA_MENU_LEVEL_2_ITEMS,
  MAX_MEGA_MENU_ROOT_ITEMS,
} from "@/lib/menu-depth";

export interface HeaderMenuItem {
  label: string;
  href: string;
  target?: "_self" | "_blank";
  icon?: string;
  image?: string;
  description?: string;
  badge?: string;
  isFeatured?: boolean;
  columnTitle?: string;
  navPosition?: "left" | "right";
  children?: HeaderMenuItem[];
}

import { MobileMenuSheet } from "@/components/layout/store-header/mobile-menu-sheet";
import {
  CustomMegaMenuPanel,
  findFirstMegaFeature,
  flattenVisibleMegaItems,
  getHeaderMenuItemKey,
  getMegaItemImage,
  getMegaItemPromoImage,
  getVisibleMegaChildren,
} from "@/components/layout/store-header/mega-menu";

interface StoreHeaderProps {
  locale: Locale;
  menuItems?: HeaderMenuItem[];
  megaMenuItems?: HeaderMenuItem[];
  headerSettings?: HeaderSettings;
}

type SearchSuggestion = {
  _id: string;
  slug: string;
  name?: string;
  title?: string;
  images?: string[];
};

type CategoryNode = {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  icon?: string;
  children: CategoryNode[];
};

type CollectionItem = {
  _id: string;
  title: string;
  slug: string;
  handle?: string;
  description?: string;
  image?: { url?: string; alt?: string };
};

const DESKTOP_QUICK_CATEGORY_FULL_LIMIT = 5;
const DESKTOP_QUICK_CATEGORY_PARTIAL_LIMIT = 7;
const DESKTOP_QUICK_CATEGORY_ONLY_LIMIT = 11;

function getDesktopQuickCategoryLimit(visibleNavGroupCount: number) {
  if (visibleNavGroupCount <= 0) return DESKTOP_QUICK_CATEGORY_ONLY_LIMIT;
  if (visibleNavGroupCount >= 3) return DESKTOP_QUICK_CATEGORY_FULL_LIMIT;
  return DESKTOP_QUICK_CATEGORY_PARTIAL_LIMIT;
}

export function StoreHeader({
  locale,
  menuItems,
  megaMenuItems,
  headerSettings,
}: StoreHeaderProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { totalItems } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { storeName, logoUrl, darkModeLogoUrl } = useAppSettings();
  const { isDark, setTheme } = useAppTheme();
  const { setThemeMode } = useGlobalAppSettings();
  const { currency, currencies, setCurrency } = useCurrency();
  const { language, languages, setLanguage } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [isGuestMenuOpen, setIsGuestMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [pendingLanguageCode, setPendingLanguageCode] = useState(language.code);
  const [pendingCurrencyCode, setPendingCurrencyCode] = useState(currency.code);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<
    SearchSuggestion[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [activeMegaRootKey, setActiveMegaRootKey] = useState<string | null>(
    null,
  );
  const [activeMegaChildKey, setActiveMegaChildKey] = useState<string | null>(
    null,
  );
  const [activeMegaFeatureKey, setActiveMegaFeatureKey] = useState<
    string | null
  >(null);
  const [activeRootCategoryId, setActiveRootCategoryId] = useState<
    string | null
  >(null);
  const [activeChildCategoryId, setActiveChildCategoryId] = useState<
    string | null
  >(null);
  const closeSuggestionsTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const categoriesMenuCloseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const megaMenuCloseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const collectionsMenuCloseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const guestMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const userMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const debouncedSearchQuery = useDebounce(searchQuery.trim(), 350);
  const headerFullWidth = headerSettings?.layout.fullWidth ?? false;
  const headerSticky = headerSettings?.layout.sticky ?? true;
  const headerLogoUrl = headerSettings?.brand.logoUrl?.trim() || "";
  const headerDarkLogoUrl = headerSettings?.brand.darkLogoUrl?.trim() || "";
  const headerLogoAlt = headerSettings?.brand.logoAlt?.trim() || "";
  const desktopLogoWidth = headerSettings?.brand.desktopLogoWidth ?? 144;
  const mobileLogoWidth = headerSettings?.brand.mobileLogoWidth ?? 112;
  const showSearch = headerSettings?.search.enabled ?? true;
  const showAiSearch = headerSettings?.search.showAiButton ?? true;
  const searchPlaceholder =
    headerSettings?.search.placeholder?.trim() || t("common.searchPlaceholder");
  const searchDesktopWidth = headerSettings?.search.desktopWidth ?? 640;
  const searchHeight = headerSettings?.search.height ?? 40;
  const searchBorderRadius = headerSettings?.search.borderRadius ?? 999;
  const searchBorderColor =
    headerSettings?.search.borderColor?.trim() || "#dddddd";
  const showLanguageSelector =
    headerSettings?.market.showLanguageSelector ?? true;
  const showCurrencySelector =
    headerSettings?.market.showCurrencySelector ?? true;
  const showMarketSelector = showLanguageSelector || showCurrencySelector;
  const showThemeToggle = headerSettings?.widgets.showThemeToggle ?? true;
  const showAccountMenu = headerSettings?.widgets.showAccountMenu ?? true;
  const showWishlist = headerSettings?.widgets.showWishlist ?? true;
  const showCart = headerSettings?.widgets.showCart ?? true;
  const showCategoryMenu = headerSettings?.categoryMenu.enabled ?? true;
  const categoryMenuPosition =
    headerSettings?.categoryMenu.position ?? "left";
  const showMegaMenu = headerSettings?.categoryMenu.showMegaMenu ?? true;
  const showCategoryQuickLinks =
    headerSettings?.categoryMenu.showQuickLinks ?? true;
  const categoryMenuLabel =
    headerSettings?.categoryMenu.label?.trim() || t("common.allCategories");
  const categoryQuickLimit = headerSettings?.categoryMenu.quickLimit ?? 3;
  const categoryMobileLimit = headerSettings?.categoryMenu.mobileLimit ?? 8;
  const showCollectionsMenu = headerSettings?.collectionsMenu.enabled ?? true;
  const collectionsMenuPosition =
    headerSettings?.collectionsMenu.position ?? "left";
  const collectionsMenuLabel =
    headerSettings?.collectionsMenu.label?.trim() || t("nav.collections");
  const collectionsLimit = headerSettings?.collectionsMenu.limit ?? 12;
  const showUtilityMenu = headerSettings?.utilityMenu.enabled ?? true;
  const showMobileSearch =
    showSearch && (headerSettings?.mobile.showSearch ?? true);
  const showMobileAccountSummary =
    showAccountMenu && (headerSettings?.mobile.showAccountSummary ?? true);
  const showMobileCategoryShortcuts =
    showCategoryMenu && (headerSettings?.mobile.showCategoryShortcuts ?? true);
  const showMobileCollections =
    showCollectionsMenu && (headerSettings?.mobile.showCollections ?? true);
  const showMobileMarketSelectors =
    showMarketSelector && (headerSettings?.mobile.showMarketSelectors ?? true);
  const showMobileThemeSelector =
    showThemeToggle && (headerSettings?.mobile.showThemeSelector ?? true);
  const rawCategoryPromoHref =
    headerSettings?.categoryMenu.promoHref?.trim() || "";
  const categoryPromoHref =
    !rawCategoryPromoHref
      ? `/${locale}/products`
      : rawCategoryPromoHref.startsWith("http://") ||
    rawCategoryPromoHref.startsWith("https://")
      ? rawCategoryPromoHref
      : rawCategoryPromoHref.startsWith(`/${locale}`)
        ? rawCategoryPromoHref
        : rawCategoryPromoHref.startsWith("/")
          ? `/${locale}${rawCategoryPromoHref}`
          : `/${locale}/${rawCategoryPromoHref}`;
  const categoryPromoImageSrc =
    headerSettings?.categoryMenu.promoImageSrc?.trim() || "";
  const categoryPromoTitle =
    headerSettings?.categoryMenu.promoTitle?.trim() || "";
  const categoryPromoSubtitle =
    headerSettings?.categoryMenu.promoSubtitle?.trim() || "";
  const hasCategoryPromoContent = Boolean(
    categoryPromoTitle || categoryPromoSubtitle || categoryPromoImageSrc,
  );
  const showCategoryPromoCard =
    showCategoryMenu &&
    (headerSettings?.categoryMenu.showPromoCard ?? false) &&
    hasCategoryPromoContent;
  const activeHeaderColors = isDark
    ? headerSettings?.colors.dark
    : headerSettings?.colors.light;
  const headerContainerClass = headerFullWidth
    ? "w-full px-4 sm:px-6 lg:px-8"
    : "container mx-auto px-4";
  const headerThemeStyle = activeHeaderColors
    ? ({
        "--background": activeHeaderColors.backgroundColor,
        "--foreground": activeHeaderColors.textColor,
        "--popover": activeHeaderColors.backgroundColor,
        "--popover-foreground": activeHeaderColors.textColor,
        "--muted-foreground": activeHeaderColors.textColor,
        "--header-search-bg": activeHeaderColors.searchBackgroundColor,
        "--header-search-text": activeHeaderColors.searchTextColor,
      } as CSSProperties)
    : undefined;
  const searchInputStyle = {
    ...(activeHeaderColors
      ? {
          backgroundColor: "var(--header-search-bg)",
          color: "var(--header-search-text)",
        }
      : {}),
    borderColor: searchBorderColor,
    borderRadius: searchBorderRadius,
    height: searchHeight,
  } as CSSProperties;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSearchSuggestions(false);
    if (searchQuery.trim()) {
      router.push(
        `/${locale}/products?search=${encodeURIComponent(searchQuery)}`,
      );
    }
  };

  const handleAISalesAgentOpen = () => {
    setShowSearchSuggestions(false);
    window.dispatchEvent(new CustomEvent("ai-sales-agent:open"));
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchSuggestions([]);
      setIsSearching(false);
      setShowSearchSuggestions(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const getDashboardLink = () => {
    if (!user?.role) return null;
    if (user.role === USER_ROLES.ADMIN)
      return `/${locale}${appConfig.urls.adminDashboard}`;
    if (user.role === USER_ROLES.VENDOR)
      return `/${locale}${appConfig.urls.vendorDashboard}`;
    if (isStaffRole(user.role))
      return `/${locale}${appConfig.urls.staffDashboard}`;
    return null;
  };

  const getSettingsLink = () => {
    const role = user?.role;
    if (role === USER_ROLES.ADMIN) return `/${locale}/admin/settings`;
    if (role === USER_ROLES.VENDOR) return `/${locale}/vendor/settings`;
    if (isStaffRole(role)) return `/${locale}/staff/profile`;
    return `/${locale}/account`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const currentLogoUrl =
    (isDark && headerDarkLogoUrl ? headerDarkLogoUrl : headerLogoUrl) ||
    (isDark && typeof darkModeLogoUrl === "string" && darkModeLogoUrl.trim()
      ? darkModeLogoUrl
      : typeof logoUrl === "string" && logoUrl.trim()
        ? logoUrl
        : "");

  const handleThemeToggle = () => {
    const nextMode = isDark ? "light" : "dark";
    setTheme(nextMode);
    setThemeMode(nextMode);
  };

  const handleMarketModalOpenChange = (open: boolean) => {
    setIsMarketModalOpen(open);
    if (open) {
      setPendingLanguageCode(language.code);
      setPendingCurrencyCode(currency.code);
    }
  };

  const handleMarketSettingsSave = () => {
    const newLocale = pendingLanguageCode;
    const currentLocale = language.code;

    if (newLocale !== currentLocale) {
      const currentPath = pathname;
      const newPath = currentPath.replace(`/${currentLocale}`, `/${newLocale}`);
      router.push(newPath);
      setLanguage(newLocale);
    }

    if (pendingCurrencyCode !== currency.code) {
      setCurrency(pendingCurrencyCode);
    }

    setIsMarketModalOpen(false);
  };

  const handleMobileSearch = (event: React.FormEvent) => {
    handleSearch(event);
    if (searchQuery.trim()) {
      setIsOpen(false);
    }
  };

  const handleThemeChange = (nextMode: "light" | "dark" | "system") => {
    setTheme(nextMode);
    setThemeMode(nextMode);
  };

  const handleMobileLanguageChange = (newLocale: string) => {
    const currentLocale = locale || language.code;
    setLanguage(newLocale);

    if (newLocale !== currentLocale) {
      const newPath = pathname.startsWith(`/${currentLocale}`)
        ? pathname.replace(`/${currentLocale}`, `/${newLocale}`)
        : `/${newLocale}`;
      router.push(newPath);
      setIsOpen(false);
    }
  };

  const closeMobileMenu = () => setIsOpen(false);

  const openGuestMenu = () => {
    if (guestMenuCloseTimeoutRef.current) {
      clearTimeout(guestMenuCloseTimeoutRef.current);
    }
    setIsGuestMenuOpen(true);
  };

  const closeGuestMenu = () => {
    if (guestMenuCloseTimeoutRef.current) {
      clearTimeout(guestMenuCloseTimeoutRef.current);
    }

    guestMenuCloseTimeoutRef.current = setTimeout(() => {
      setIsGuestMenuOpen(false);
    }, 120);
  };

  const openUserMenu = () => {
    if (userMenuCloseTimeoutRef.current) {
      clearTimeout(userMenuCloseTimeoutRef.current);
    }
    setIsUserMenuOpen(true);
  };

  const closeUserMenu = () => {
    if (userMenuCloseTimeoutRef.current) {
      clearTimeout(userMenuCloseTimeoutRef.current);
    }

    userMenuCloseTimeoutRef.current = setTimeout(() => {
      setIsUserMenuOpen(false);
    }, 120);
  };

  const openCategoriesMenu = () => {
    if (categoriesMenuCloseTimeoutRef.current) {
      clearTimeout(categoriesMenuCloseTimeoutRef.current);
    }
    setCategoriesOpen(true);
  };

  const closeCategoriesMenu = () => {
    if (categoriesMenuCloseTimeoutRef.current) {
      clearTimeout(categoriesMenuCloseTimeoutRef.current);
    }

    categoriesMenuCloseTimeoutRef.current = setTimeout(() => {
      setCategoriesOpen(false);
    }, 120);
  };

  const openMegaMenu = () => {
    if (megaMenuCloseTimeoutRef.current) {
      clearTimeout(megaMenuCloseTimeoutRef.current);
    }
    setMegaMenuOpen(true);
  };

  const closeMegaMenu = () => {
    if (megaMenuCloseTimeoutRef.current) {
      clearTimeout(megaMenuCloseTimeoutRef.current);
    }

    megaMenuCloseTimeoutRef.current = setTimeout(() => {
      setMegaMenuOpen(false);
    }, 120);
  };

  const openCollectionsMenu = () => {
    if (collectionsMenuCloseTimeoutRef.current) {
      clearTimeout(collectionsMenuCloseTimeoutRef.current);
    }
    setCollectionsOpen(true);
  };

  const closeCollectionsMenu = () => {
    if (collectionsMenuCloseTimeoutRef.current) {
      clearTimeout(collectionsMenuCloseTimeoutRef.current);
    }

    collectionsMenuCloseTimeoutRef.current = setTimeout(() => {
      setCollectionsOpen(false);
    }, 120);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await fetch("/api/categories/public", {
          signal: controller.signal,
        });
        const result = await response.json();
        const data = Array.isArray(result?.data) ? result.data : [];
        setCategories(data);
        const first = data[0];
        setActiveRootCategoryId(first?._id ?? null);
        setActiveChildCategoryId(first?.children?.[0]?._id ?? null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCategories([]);
        }
      } finally {
        setCategoriesLoading(false);
      }
    };

    void fetchCategories();
    return () => controller.abort("cleanup");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchCollections = async () => {
      try {
        const response = await fetch(`/api/collections?limit=${collectionsLimit}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        const data = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
            ? result.data
            : [];
        setCollections(data);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCollections([]);
        }
      }
    };

    void fetchCollections();
    return () => controller.abort("cleanup");
  }, [collectionsLimit]);

  const activeRoot =
    categories.find((c) => c._id === activeRootCategoryId) || categories[0];
  const rootChildren = activeRoot?.children || [];
  const visibleRootChildren = rootChildren.slice(0, MAX_MEGA_MENU_LEVEL_2_ITEMS);
  const rootHasNested = visibleRootChildren.some(
    (c) => (c.children?.length || 0) > 0,
  );
  const isFlatCategoryList =
    categories.length > 0 &&
    categories.every((c) => (c.children?.length || 0) === 0);
  const showPromoCards = showCategoryPromoCard;
  const activeChild =
    visibleRootChildren.find((c) => c._id === activeChildCategoryId) ||
    visibleRootChildren[0];
  const megaSource = (
    rootHasNested ? activeChild?.children || [] : visibleRootChildren
  ).slice(
    0,
    rootHasNested
      ? (activeChild?.children || []).length
      : MAX_MEGA_MENU_LEVEL_2_ITEMS,
  );
  const categoriesPageHref = `/${locale}/categories`;
  const visibleCategoryRoots = categories.slice(0, MAX_MEGA_MENU_ROOT_ITEMS);
  const hasCategoryOverflow = categories.length > MAX_MEGA_MENU_ROOT_ITEMS;
  const megaMenuRootItems = (megaMenuItems || []).filter((item) =>
    item.label.trim(),
  );
  const visibleMegaRootItems = megaMenuRootItems.slice(0, MAX_MEGA_MENU_ROOT_ITEMS);
  const hasMegaRootOverflow = megaMenuRootItems.length > MAX_MEGA_MENU_ROOT_ITEMS;
  const activeMegaRoot =
    visibleMegaRootItems.find(
      (item) => getHeaderMenuItemKey(item) === activeMegaRootKey,
    ) || visibleMegaRootItems[0];
  const megaRootChildren = getVisibleMegaChildren(activeMegaRoot).slice(
    0,
    MAX_MEGA_MENU_LEVEL_2_ITEMS,
  );
  const megaRootHasNested = megaRootChildren.some(
    (item) => getVisibleMegaChildren(item).length > 0,
  );
  const activeMegaChild =
    megaRootChildren.find(
      (item) => getHeaderMenuItemKey(item) === activeMegaChildKey,
    ) || megaRootChildren[0];
  const activeMegaChildChildren = getVisibleMegaChildren(activeMegaChild);
  const customMegaSource = megaRootHasNested
    ? activeMegaChildChildren.length > 0
      ? activeMegaChildChildren
      : activeMegaChild
        ? [activeMegaChild]
        : megaRootChildren.slice(0, MAX_MEGA_MENU_LEVEL_2_ITEMS)
    : megaRootChildren.slice(0, MAX_MEGA_MENU_LEVEL_2_ITEMS);
  // The right promo panel is driven by the active L1 root itself: it renders
  // only when that root has the "Right promo panel" toggle on and a distinct
  // promo image. Each root carries its own promo, so different roots surface
  // different promos as you hover them.
  const customMegaPromo =
    activeMegaRoot?.isFeatured && getMegaItemPromoImage(activeMegaRoot)
      ? activeMegaRoot
      : undefined;
  const customMegaFeatureItems = flattenVisibleMegaItems(customMegaSource);
  const activeMegaFeature =
    customMegaFeatureItems.find(
      (item) => getHeaderMenuItemKey(item) === activeMegaFeatureKey,
    ) ||
    customMegaFeatureItems.find((item) => getMegaItemImage(item)) ||
    customMegaFeatureItems[0] ||
    activeMegaChild ||
    activeMegaRoot;
  const hasCustomMegaMenu =
    showCategoryMenu && showMegaMenu && megaMenuRootItems.length > 0;

  const setActiveRoot = (root: CategoryNode) => {
    setActiveRootCategoryId(root._id);
    setActiveChildCategoryId(
      root.children?.slice(0, MAX_MEGA_MENU_LEVEL_2_ITEMS)[0]?._id ?? null,
    );
  };

  const setActiveMegaRoot = (item: HeaderMenuItem) => {
    const nextRootChildren = getVisibleMegaChildren(item).slice(
      0,
      MAX_MEGA_MENU_LEVEL_2_ITEMS,
    );
    const nextActiveChild = nextRootChildren[0];
    const nextSource = nextActiveChild
      ? getVisibleMegaChildren(nextActiveChild)
      : nextRootChildren;
    setActiveMegaRootKey(getHeaderMenuItemKey(item));
    setActiveMegaChildKey(getHeaderMenuItemKey(nextActiveChild));
    setActiveMegaFeatureKey(getHeaderMenuItemKey(findFirstMegaFeature(nextSource)));
  };

  const setActiveMegaChild = (item: HeaderMenuItem) => {
    const nextSource = getVisibleMegaChildren(item);
    setActiveMegaChildKey(getHeaderMenuItemKey(item));
    setActiveMegaFeatureKey(getHeaderMenuItemKey(findFirstMegaFeature(nextSource)));
  };

  const utilityMenuItems =
    showUtilityMenu && menuItems && menuItems.length > 0 ? menuItems : [];
  const flowingUtilityMenuItems = utilityMenuItems.filter(
    (item) => item.navPosition === "left",
  );
  const fixedUtilityMenuItems = utilityMenuItems.filter(
    (item) => item.navPosition !== "left",
  );
  const hasVisibleCollectionNav = showCollectionsMenu && collections.length > 0;
  const hasVisibleUtilityNav = utilityMenuItems.length > 0;
  const desktopQuickCategoryLimit = getDesktopQuickCategoryLimit(
    [showCategoryMenu, hasVisibleCollectionNav, hasVisibleUtilityNav].filter(
      Boolean,
    ).length,
  );
  const visibleQuickCategoryLimit = Math.min(
    categoryQuickLimit,
    desktopQuickCategoryLimit,
  );
  const navCategories = showCategoryQuickLinks
    ? categories.slice(0, visibleQuickCategoryLimit)
    : [];
  const showBottomNav =
    showCategoryMenu ||
    hasVisibleCollectionNav ||
    navCategories.length > 0 ||
    hasVisibleUtilityNav;

  useEffect(() => {
    if (debouncedSearchQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const fetchSuggestions = async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          search: debouncedSearchQuery,
          limit: "6",
          page: "1",
        });

        const response = await fetch(`/api/products?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        const products = Array.isArray(result?.data?.data)
          ? result.data.data
          : [];
        setSearchSuggestions(products);
        setShowSearchSuggestions(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSearchSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    };

    void fetchSuggestions();
    return () => controller.abort("cleanup");
  }, [debouncedSearchQuery]);

  // Publish the sticky header's real height (top row + optional nav row)
  // so store pages can position their own sticky elements below it.
  const stickyWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stickyWrapperRef.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty(
        "--storefront-header-height",
        `${headerSticky ? el.offsetHeight : 0}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--storefront-header-height");
    };
  }, [headerSticky]);

  useEffect(() => {
    return () => {
      if (closeSuggestionsTimeoutRef.current) {
        clearTimeout(closeSuggestionsTimeoutRef.current);
      }
      if (categoriesMenuCloseTimeoutRef.current) {
        clearTimeout(categoriesMenuCloseTimeoutRef.current);
      }
      if (megaMenuCloseTimeoutRef.current) {
        clearTimeout(megaMenuCloseTimeoutRef.current);
      }
      if (collectionsMenuCloseTimeoutRef.current) {
        clearTimeout(collectionsMenuCloseTimeoutRef.current);
      }
      if (guestMenuCloseTimeoutRef.current) {
        clearTimeout(guestMenuCloseTimeoutRef.current);
      }
      if (userMenuCloseTimeoutRef.current) {
        clearTimeout(userMenuCloseTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={stickyWrapperRef}
        data-sticky-header
        className={`${headerSticky ? "sticky top-0" : "relative"} z-50 w-full`}
      >
        <header
          className="w-full bg-background shadow-[0_2px_10px_rgba(15,23,42,0.06)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.35)] [&_button]:cursor-pointer"
          style={headerThemeStyle}
        >
          <div className={headerContainerClass}>
            {/* Top row: logo / search / right widgets */}
            <div className="flex items-center gap-4 py-3 xl:gap-6">
              <div className="flex min-w-0 flex-1 items-center md:flex-none xl:flex-1">
                <Link
                  href={`/${locale}`}
                  className="flex shrink-0 items-center gap-2"
                >
                  {currentLogoUrl ? (
                    <span
                      className="relative block h-8 w-[var(--header-logo-mobile-width)] overflow-hidden sm:w-[var(--header-logo-desktop-width)]"
                      style={
                        {
                          "--header-logo-mobile-width": `${mobileLogoWidth}px`,
                          "--header-logo-desktop-width": `${desktopLogoWidth}px`,
                        } as CSSProperties
                      }
                    >
                      <AppImage
                        src={currentLogoUrl}
                        alt={headerLogoAlt || storeName || "Logo"}
                        className="h-8 w-full object-contain object-left"
                        width={144}
                        height={32}
                        priority
                      />
                    </span>
                  ) : (
                    <>
                      <Store className="h-6 w-6 text-primary" />
                      <span className="truncate text-xl font-bold">
                        {typeof storeName === "string" && storeName.trim()
                          ? storeName
                          : appConfig.name}
                      </span>
                    </>
                  )}
                </Link>
              </div>

              {/* Pill search bar (tablet / desktop) */}
              {showSearch && (
                <form
                  onSubmit={handleSearch}
                  className="relative hidden min-w-0 flex-1 md:block xl:shrink-0"
                  style={{
                    flexBasis: searchDesktopWidth,
                    maxWidth: searchDesktopWidth,
                    width: "100%",
                  }}
                >
                  <div
                    className="relative"
                    onFocus={() => {
                      if (closeSuggestionsTimeoutRef.current) {
                        clearTimeout(closeSuggestionsTimeoutRef.current);
                      }
                      if (searchQuery.trim().length >= 2) {
                        setShowSearchSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      closeSuggestionsTimeoutRef.current = setTimeout(() => {
                        setShowSearchSuggestions(false);
                      }, 140);
                    }}
                  >
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={searchPlaceholder}
                      className="h-10 w-full rounded-full border border-[#dddddd] bg-transparent pl-11 pr-12 text-sm shadow-none placeholder:opacity-70 focus-visible:border-[#d3d3d3] focus-visible:bg-transparent focus-visible:ring-0 dark:border-white/15 dark:focus-visible:border-white/25"
                      style={searchInputStyle}
                      value={searchQuery}
                      onChange={(e) => handleSearchQueryChange(e.target.value)}
                    />
                    {showAiSearch && (
                      <button
                        type="button"
                        onClick={handleAISalesAgentOpen}
                        aria-label={t("common.aiSearch")}
                        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-fuchsia-500 transition-colors hover:text-fuchsia-600"
                      >
                        <Image
                          src="/AI Icon.png"
                          alt="Search"
                          height={24}
                          width={24}
                        />
                      </button>
                    )}
                  </div>
                  {showSearchSuggestions && searchQuery.trim().length >= 2 && (
                  <div className="absolute left-4 right-4 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-background shadow-lg">
                    <div className="max-h-80 overflow-y-auto p-2">
                      {isSearching ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {t("common.loading")}
                        </div>
                      ) : searchSuggestions.length > 0 ? (
                        <div className="space-y-1">
                          {searchSuggestions.map((product) => {
                            const label =
                              product.name || product.title || "Product";
                            return (
                              <Link
                                key={product._id}
                                href={`/${locale}/products/${product.slug}`}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60"
                                onClick={() => {
                                  setSearchQuery(label);
                                  setShowSearchSuggestions(false);
                                }}
                              >
                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted/40">
                                  {product.images?.[0] ? (
                                    <AppImage
                                      src={product.images[0]}
                                      alt={label}
                                      className="h-full w-full object-cover"
                                      width={40}
                                      height={40}
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-muted/60" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {label}
                                  </p>
                                </div>
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
                    {!isSearching && searchSuggestions.length > 0 && (
                      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                        {t("common.pressEnterToSearch")} &quot;{searchQuery}
                        &quot;
                      </div>
                    )}
                  </div>
                  )}
                </form>
              )}

              {/* Right widgets cluster */}
              <div className="flex flex-1 shrink-0 items-center justify-end gap-4 md:flex-none xl:flex-1 xl:gap-6">
                {/* Theme toggle */}
                {showThemeToggle && (
                  <button
                    type="button"
                    onClick={handleThemeToggle}
                    aria-label={
                      isDark
                        ? t("common.switchToLightMode")
                        : t("common.switchToDarkMode")
                    }
                    className="hidden h-9 w-9 place-items-center rounded-full text-foreground/80 transition-colors hover:text-primary xl:grid"
                  >
                    {isDark ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </button>
                )}

                {/* Language / currency */}
                {showMarketSelector && (
                  <Popover
                    open={isMarketModalOpen}
                    onOpenChange={handleMarketModalOpenChange}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="hidden items-center gap-2 text-left leading-none xl:flex"
                      >
                        {showLanguageSelector && (
                          <span
                            aria-hidden="true"
                            className="text-[20px] leading-none"
                          >
                            {language.flag}
                          </span>
                        )}
                        <span className="flex flex-col gap-[3px]">
                          {showLanguageSelector && (
                            <span className="text-[11px] font-medium text-foreground/60">
                              {language.code.toUpperCase()}
                            </span>
                          )}
                          {showCurrencySelector && (
                            <span className="text-[12px] font-medium leading-none tracking-normal">
                              {currency.code}
                            </span>
                          )}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      side="bottom"
                      sideOffset={10}
                      className="w-[310px] rounded-[28px] border-0 bg-[#f3f3f3] p-0 text-zinc-900 shadow-[0_18px_40px_rgba(15,23,42,0.2)] dark:border dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
                    >
                      <div className="space-y-4 px-6 py-6">
                        {showLanguageSelector && (
                          <section className="space-y-2.5">
                        <h3 className="text-[17px] font-semibold leading-none text-zinc-900 dark:text-zinc-100">
                          {t("common.language")}
                        </h3>
                        <div className="relative">
                          <select
                            value={pendingLanguageCode}
                            onChange={(e) =>
                              setPendingLanguageCode(e.target.value)
                            }
                            className="h-11 w-full appearance-none rounded-[10px] border border-[#c8c8c8] bg-white px-4 pr-10 text-[14px] font-medium text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                          >
                            {languages.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.flag} {lang.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600 dark:text-zinc-300" />
                        </div>
                      </section>
                        )}

                        {showCurrencySelector && (
                          <section className="space-y-2.5">
                        <h3 className="text-[17px] font-semibold leading-none text-zinc-900 dark:text-zinc-100">
                          {t("common.currency")}
                        </h3>
                        <div className="relative">
                          <select
                            value={pendingCurrencyCode}
                            onChange={(e) =>
                              setPendingCurrencyCode(e.target.value)
                            }
                            className="h-11 w-full appearance-none rounded-[10px] border border-[#c8c8c8] bg-white px-4 pr-10 text-[14px] font-medium text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                          >
                            {currencies.map((curr) => (
                              <option key={curr.code} value={curr.code}>
                                {curr.code} ( {curr.name} )
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600 dark:text-zinc-300" />
                        </div>
                      </section>
                        )}

                        <Button
                          type="button"
                          onClick={handleMarketSettingsSave}
                          className="mt-1 h-11 w-full rounded-full bg-primary text-[14px] font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          {t("common.save")}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* User / auth */}
                {showAccountMenu && (isLoading || !mounted ? (
                  <div className="hidden h-9 w-24 animate-pulse rounded-md bg-muted xl:block" />
                ) : isAuthenticated && user ? (
                  <DropdownMenu
                    open={isUserMenuOpen}
                    onOpenChange={setIsUserMenuOpen}
                    modal={false}
                  >
                    <div
                      className="hidden xl:block"
                      onMouseEnter={openUserMenu}
                      onMouseLeave={closeUserMenu}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={user.image || undefined}
                              alt={user.name}
                              referrerPolicy="no-referrer"
                            />
                            <AvatarFallback>
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="hidden flex-col gap-[3px] leading-none xl:flex">
                            <span className="text-[11px] font-medium text-foreground/60">
                              {t("common.welcome")}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium leading-none tracking-normal">
                              <span className="max-w-27.5 truncate">
                                {user.name}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-foreground/55" />
                            </span>
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                    </div>
                    <DropdownMenuContent
                      align="end"
                      className="w-56"
                      onMouseEnter={openUserMenu}
                      onMouseLeave={closeUserMenu}
                    >
                      <DropdownMenuLabel>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {getDashboardLink() ? (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href={getDashboardLink()!}>
                              <Package className="mr-2 h-4 w-4" />
                              {t("common.dashboard")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={getSettingsLink()}>
                              <Settings className="mr-2 h-4 w-4" />
                              {t("admin.settings.title")}
                            </Link>
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href={`/${locale}/account`}>
                              <User className="mr-2 h-4 w-4" />
                              {t("common.account")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/${locale}/account/orders`}>
                              <Package className="mr-2 h-4 w-4" />
                              {t("orders.myOrders")}
                            </Link>
                          </DropdownMenuItem>
                          {showWishlist && (
                            <DropdownMenuItem asChild>
                              <Link href={`/${locale}/account/wishlist`}>
                                <Heart className="mr-2 h-4 w-4" />
                                {t("nav.wishlist") || "Wishlist"}
                                {wishlistItems.length > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-auto h-5 px-1.5 text-[10px]"
                                  >
                                    {wishlistItems.length}
                                  </Badge>
                                )}
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        {t("common.logout")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <DropdownMenu
                    open={isGuestMenuOpen}
                    onOpenChange={setIsGuestMenuOpen}
                    modal={false}
                  >
                    <div
                      className="hidden xl:block"
                      onMouseEnter={openGuestMenu}
                      onMouseLeave={closeGuestMenu}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left leading-none"
                        >
                          <User className="h-[22px] w-[22px] text-foreground/90" />
                          <span className="flex flex-col gap-[3px]">
                            <span className="text-[11px] font-medium text-foreground/60">
                              {t("common.welcome")}
                            </span>
                            <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[12px] font-semibold leading-none tracking-normal">
                              <span className="leading-none">
                                {t("common.login")} /
                              </span>
                              <span className="text-foreground/80 leading-none">
                                {t("common.register")}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-foreground/55" />
                            </span>
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        side="bottom"
                        sideOffset={10}
                        className="w-[310px] rounded-[28px] border border-[#ececec] bg-[#f5f5f5] p-0 text-zinc-900 shadow-[0_18px_40px_rgba(15,23,42,0.2)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
                        onMouseEnter={openGuestMenu}
                        onMouseLeave={closeGuestMenu}
                      >
                        <div className="px-5 pb-5 pt-4">
                          <Link
                            href={`/${locale}/login`}
                            onClick={() => setIsGuestMenuOpen(false)}
                            className="flex h-10 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            {t("common.signIn")}
                          </Link>
                          <Link
                            href={`/${locale}/register`}
                            onClick={() => setIsGuestMenuOpen(false)}
                            className="mt-3 block text-center text-[16px] text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                          >
                            {t("common.register")}
                          </Link>
                          <div className="mt-3 border-t border-[#dbdbdb] dark:border-zinc-700" />

                          <div className="mt-3 space-y-0.5">
                            <DropdownMenuItem
                              asChild
                              className="h-10 rounded-md px-2.5"
                            >
                              <Link
                                href={`/${locale}/login?redirect=${encodeURIComponent(
                                  `/${locale}/account`,
                                )}`}
                              >
                                <LayoutDashboard className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                                <span className="text-[14px] leading-none">
                                  {t("common.dashboard")}
                                </span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              asChild
                              className="h-10 rounded-md px-2.5"
                            >
                              <Link
                                href={`/${locale}/login?redirect=${encodeURIComponent(
                                  `/${locale}/account/orders`,
                                )}`}
                              >
                                <Package className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                                <span className="text-[14px] leading-none">
                                  {t("common.myOrders")}
                                </span>
                              </Link>
                            </DropdownMenuItem>
                            {showWishlist && (
                              <DropdownMenuItem
                                asChild
                                className="h-10 rounded-md px-2.5"
                              >
                                <Link
                                  href={`/${locale}/login?redirect=${encodeURIComponent(
                                    `/${locale}/account/wishlist`,
                                  )}`}
                                >
                                  <Heart className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                                  <span className="text-[14px] leading-none">
                                    {t("nav.wishlist")}
                                  </span>
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              asChild
                              className="h-10 rounded-md px-2.5"
                            >
                              <Link
                                href={`/${locale}/login?redirect=${encodeURIComponent(
                                  `/${locale}/account/profile`,
                                )}`}
                              >
                                <User className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                                <span className="text-[14px] leading-none">
                                  {t("common.profile")}
                                </span>
                              </Link>
                            </DropdownMenuItem>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </div>
                  </DropdownMenu>
                ))}

                {/* Cart */}
                {showCart && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(true)}
                      className="relative grid h-9 w-9 place-items-center text-foreground/90 transition-colors hover:text-primary"
                      aria-label={t("common.openCart")}
                    >
                      <ShoppingCart className="h-5 w-5" />
                      {totalItems > 0 && (
                        <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow">
                          {totalItems > 99 ? "99+" : totalItems}
                        </span>
                      )}
                    </button>
                    <CartDrawer
                      open={isCartOpen}
                      onOpenChange={setIsCartOpen}
                      locale={locale}
                    />
                  </>
                )}

                {/* Mobile menu trigger */}
                <MobileMenuSheet
                  locale={locale}
                  isOpen={isOpen}
                  setIsOpen={setIsOpen}
                  closeMobileMenu={closeMobileMenu}
                  categories={categories}
                  collections={collections}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchSuggestions={searchSuggestions}
                  searchPlaceholder={searchPlaceholder}
                  searchInputStyle={searchInputStyle}
                  showMobileSearch={showMobileSearch}
                  showAiSearch={showAiSearch}
                  showSearchSuggestions={showSearchSuggestions}
                  showMobileMarketSelectors={showMobileMarketSelectors}
                  showMobileThemeSelector={showMobileThemeSelector}
                  showMobileCollections={showMobileCollections}
                  showMobileAccountSummary={showMobileAccountSummary}
                  showMobileCategoryShortcuts={showMobileCategoryShortcuts}
                  showLanguageSelector={showLanguageSelector}
                  showCurrencySelector={showCurrencySelector}
                  showCollectionsMenu={showCollectionsMenu}
                  showUtilityMenu={showUtilityMenu}
                  showWishlist={showWishlist}
                  showCart={showCart}
                  showAccountMenu={showAccountMenu}
                  categoryMenuLabel={categoryMenuLabel}
                  collectionsMenuLabel={collectionsMenuLabel}
                  categoriesPageHref={categoriesPageHref}
                  getDashboardLink={getDashboardLink}
                  getSettingsLink={getSettingsLink}
                  getInitials={getInitials}
                  handleLogout={handleLogout}
                  handleMobileSearch={handleMobileSearch}
                  handleSearchQueryChange={handleSearchQueryChange}
                  handleAISalesAgentOpen={handleAISalesAgentOpen}
                  handleMobileLanguageChange={handleMobileLanguageChange}
                  handleThemeChange={handleThemeChange}
                  setShowSearchSuggestions={setShowSearchSuggestions}
                  setIsCartOpen={setIsCartOpen}
                  isSearching={isSearching}
                  menuItems={menuItems}
                  megaMenuRootItems={megaMenuRootItems}
                  hasCustomMegaMenu={hasCustomMegaMenu}
                  hasMegaRootOverflow={hasMegaRootOverflow}
                  hasCategoryOverflow={hasCategoryOverflow}
                  categoryMobileLimit={categoryMobileLimit}
                  collectionsLimit={collectionsLimit}
                  megaMenuRootLimit={MAX_MEGA_MENU_ROOT_ITEMS}
                />
              </div>
            </div>

            {/* Bottom row: categories button | category quick-nav | utility links */}
            {showBottomNav && (
              <div className="hidden items-center gap-6 pb-3 xl:flex">
                {hasCustomMegaMenu && activeMegaRoot && (
                  <Popover open={megaMenuOpen} onOpenChange={setMegaMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        onMouseEnter={openMegaMenu}
                        onMouseLeave={closeMegaMenu}
                        className={cn(
                          "h-10 w-55 justify-between rounded-full border-transparent bg-muted/60 hover:bg-muted/80",
                          categoryMenuPosition === "right" && "order-3 ml-auto",
                        )}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Menu className="h-4 w-4" />
                          {categoryMenuLabel}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={10}
                      onMouseEnter={openMegaMenu}
                      onMouseLeave={closeMegaMenu}
                      className="w-[min(92vw,1280px)] overflow-hidden rounded-t-none rounded-b-2xl border-0 bg-popover p-0 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                    >
                      <CustomMegaMenuPanel
                        roots={megaMenuRootItems}
                        activeRoot={activeMegaRoot}
                        activeChild={activeMegaChild}
                        rootChildren={megaRootChildren}
                        rootHasNested={megaRootHasNested}
                        sourceItems={customMegaSource}
                        promoItem={customMegaPromo}
                        activeFeatureItem={activeMegaFeature}
                        rootLimit={MAX_MEGA_MENU_ROOT_ITEMS}
                        hasMoreRoots={hasMegaRootOverflow}
                        viewAllHref={categoriesPageHref}
                        onRootEnter={setActiveMegaRoot}
                        onChildEnter={setActiveMegaChild}
                        onFeatureEnter={(item) =>
                          setActiveMegaFeatureKey(getHeaderMenuItemKey(item))
                        }
                        onNavigate={() => setMegaMenuOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {!hasCustomMegaMenu && showCategoryMenu && (
                  <Popover open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    onMouseEnter={openCategoriesMenu}
                    onMouseLeave={closeCategoriesMenu}
                    className={cn(
                      "h-10 w-55 justify-between rounded-full border-transparent bg-muted/60 hover:bg-muted/80",
                      categoryMenuPosition === "right" && "order-3 ml-auto",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Menu className="h-4 w-4" />
                      {categoryMenuLabel}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={10}
                  onMouseEnter={openCategoriesMenu}
                  onMouseLeave={closeCategoriesMenu}
                  className={
                    isFlatCategoryList
                      ? "w-75 rounded-t-none rounded-b-2xl border-0 p-2"
                      : rootHasNested
                        ? showPromoCards
                          ? "w-275 overflow-hidden rounded-t-none rounded-b-2xl border-0 p-0"
                          : "w-235 overflow-hidden rounded-t-none rounded-b-2xl border-0 p-0"
                        : showPromoCards
                          ? "w-235 overflow-hidden rounded-t-none rounded-b-2xl border-0 p-0"
                          : "w-195 overflow-hidden rounded-t-none rounded-b-2xl border-0 p-0"
                  }
                >
                  {isFlatCategoryList ? (
                    <div className="space-y-1">
                      {categoriesLoading ? (
                        <div className="space-y-2 p-1">
                          {Array.from({ length: 10 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-10 w-full rounded-sm bg-muted/60 animate-pulse"
                            />
                          ))}
                        </div>
                      ) : categories.length > 0 ? (
                        <>
                          {visibleCategoryRoots.map((root) => (
                            <Link
                              key={root._id}
                              href={`/${locale}/products?category=${encodeURIComponent(
                                root.slug,
                              )}`}
                              onClick={() => setCategoriesOpen(false)}
                              className="flex items-center rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-muted"
                            >
                              <span className="inline-flex min-w-0 items-center gap-3">
                                <span className="grid h-8 w-8 place-items-center rounded-md bg-muted/40">
                                  {root.icon || root.image ? (
                                    <AppImage
                                      src={(root.icon || root.image) as string}
                                      alt={root.name}
                                      className="h-8 w-8 rounded-md object-cover"
                                      width={32}
                                      height={32}
                                    />
                                  ) : (
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </span>
                                <span className="truncate">{root.name}</span>
                              </span>
                            </Link>
                          ))}
                          {hasCategoryOverflow ? (
                            <Link
                              href={categoriesPageHref}
                              onClick={() => setCategoriesOpen(false)}
                              className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
                            >
                              View All
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : null}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {t("common.noCategories")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`grid ${
                        rootHasNested
                          ? showPromoCards
                            ? "grid-cols-[260px_220px_1fr_340px]"
                            : "grid-cols-[260px_220px_1fr]"
                          : showPromoCards
                            ? "grid-cols-[260px_1fr_340px]"
                            : "grid-cols-[260px_1fr]"
                      }`}
                    >
                      <div className="bg-popover p-3">
                        <div className="space-y-1">
                          {categoriesLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 10 }).map((_, idx) => (
                                <div
                                  key={idx}
                                  className="h-10 w-full rounded-lg bg-muted/60 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : categories.length > 0 ? (
                            <>
                              {visibleCategoryRoots.map((root) => {
                                const isActive = activeRoot?._id === root._id;
                                const hasChildren =
                                  (root.children?.length || 0) > 0;
                                return (
                                  <Link
                                    key={root._id}
                                    href={`/${locale}/products?category=${encodeURIComponent(
                                      root.slug,
                                    )}`}
                                    onMouseEnter={() => setActiveRoot(root)}
                                    onClick={() => setCategoriesOpen(false)}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
                                      isActive
                                        ? "bg-muted text-foreground"
                                        : "text-foreground/85 hover:bg-muted/60"
                                    }`}
                                  >
                                    <span className="grid h-5 w-5 shrink-0 place-items-center text-foreground/70">
                                      {root.icon || root.image ? (
                                        <AppImage
                                          src={
                                            (root.icon || root.image) as string
                                          }
                                          alt={root.name}
                                          width={20}
                                          height={20}
                                          className="h-5 w-5 object-contain"
                                        />
                                      ) : (
                                        <Package className="h-4 w-4" />
                                      )}
                                    </span>
                                    <span className="flex-1 truncate">
                                      {root.name}
                                    </span>
                                    {hasChildren && rootHasNested && (
                                      <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                                    )}
                                  </Link>
                                );
                              })}
                              {hasCategoryOverflow ? (
                                <Link
                                  href={categoriesPageHref}
                                  onClick={() => setCategoriesOpen(false)}
                                  className="mt-2 flex h-10 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted"
                                >
                                  View All
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              ) : null}
                            </>
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {t("common.noCategories")}
                            </div>
                          )}
                        </div>
                      </div>

                      {rootHasNested && (
                        <div className="bg-popover p-3">
                          <div className="space-y-1">
                            {visibleRootChildren.map((child) => {
                              const isActive = activeChild?._id === child._id;
                              const hasChildren =
                                (child.children?.length || 0) > 0;
                              return (
                                <Link
                                  key={child._id}
                                  href={`/${locale}/products?category=${encodeURIComponent(
                                    child.slug,
                                  )}`}
                                  onMouseEnter={() =>
                                    setActiveChildCategoryId(child._id)
                                  }
                                  onClick={() => setCategoriesOpen(false)}
                                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
                                    isActive
                                      ? "bg-muted text-foreground"
                                      : "text-foreground/85 hover:bg-muted/60"
                                  }`}
                                >
                                  <span className="grid h-5 w-5 shrink-0 place-items-center text-foreground/70">
                                    {child.icon || child.image ? (
                                      <AppImage
                                        src={(child.icon || child.image) as string}
                                        alt={child.name}
                                        width={20}
                                        height={20}
                                        className="h-5 w-5 object-contain"
                                      />
                                    ) : (
                                      <Package className="h-4 w-4" />
                                    )}
                                  </span>
                                  <span className="flex-1 truncate">{child.name}</span>
                                  {hasChildren && (
                                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="bg-popover px-8 py-6">
                        {megaSource.length > 0 ? (
                          <div className="grid grid-cols-2 gap-x-10 gap-y-3">
                            {megaSource.map((col) => (
                              <Link
                                key={col._id}
                                href={`/${locale}/products?category=${encodeURIComponent(
                                  col.slug,
                                )}`}
                                onClick={() => setCategoriesOpen(false)}
                                className="flex items-center gap-2 text-[13px] text-foreground/85 transition-colors hover:text-primary"
                              >
                                {col.icon || col.image ? (
                                  <AppImage
                                    src={(col.icon || col.image) as string}
                                    alt={col.name}
                                    width={20}
                                    height={20}
                                    className="h-5 w-5 shrink-0 object-contain"
                                  />
                                ) : (
                                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate">{col.name}</span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {t("common.selectCategory")}
                          </div>
                        )}
                      </div>

                      {showPromoCards && (
                        <div className="bg-popover p-4">
                          <Link
                            href={categoryPromoHref}
                            className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-linear-to-br from-[#eceaf6] via-[#f1ecf6] to-[#dfd6ef] p-5"
                          >
                            {categoryPromoTitle ? (
                              <div className="text-[15px] font-semibold leading-tight text-foreground">
                                {categoryPromoTitle}
                              </div>
                            ) : null}
                            {categoryPromoSubtitle ? (
                              <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-foreground/75">
                                {categoryPromoSubtitle}
                                <Sparkles className="h-3.5 w-3.5 text-fuchsia-500" />
                              </div>
                            ) : null}
                            {categoryPromoImageSrc ? (
                              <div className="relative mt-auto flex h-40 items-end justify-center pt-4">
                                <AppImage
                                  src={categoryPromoImageSrc}
                                  width={220}
                                  height={220}
                                  alt={categoryPromoTitle || "Header promo"}
                                  aria-hidden="true"
                                  className="h-full w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                                  loading="lazy"
                                />
                              </div>
                            ) : null}
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
                )}

              {/* Quick category nav */}
              <nav className="flex min-w-0 flex-1 items-center gap-7 overflow-hidden text-sm">
                {showCollectionsMenu &&
                  collectionsMenuPosition === "left" &&
                  collections.length > 0 && (
                  <Popover
                    open={collectionsOpen}
                    onOpenChange={setCollectionsOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onMouseEnter={openCollectionsMenu}
                        onMouseLeave={closeCollectionsMenu}
                        className="inline-flex shrink-0 items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary"
                      >
                        {collectionsMenuLabel}
                        <ChevronDown className="h-3.5 w-3.5 text-foreground/55" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={10}
                      onMouseEnter={openCollectionsMenu}
                      onMouseLeave={closeCollectionsMenu}
                      className="w-190 overflow-hidden rounded-t-none rounded-b-md border-0 bg-popover p-6 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                    >
                      <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                        {collections.map((col) => (
                          <Link
                            key={col._id}
                            href={`/${locale}/collections/${col.slug}`}
                            onClick={() => setCollectionsOpen(false)}
                            className="group flex items-center gap-3"
                          >
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted/40">
                              {col.image?.url ? (
                                <AppImage
                                  src={col.image.url}
                                  alt={col.image.alt || col.title}
                                  width={56}
                                  height={56}
                                  className="h-14 w-14 object-cover"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-muted-foreground">
                                  <Layers className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-foreground transition-colors group-hover:text-primary">
                                {col.title}
                              </p>
                              {col.description && (
                                <p className="truncate text-[12px] text-muted-foreground">
                                  {col.description}
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {showCategoryQuickLinks && categoriesLoading
                  ? Array.from({
                      length: visibleQuickCategoryLimit,
                    }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-5 w-20 animate-pulse rounded bg-muted/60"
                      />
                    ))
                  : navCategories.map((cat) => (
                      <Link
                        key={cat._id}
                        href={`/${locale}/products?category=${encodeURIComponent(
                          cat.slug,
                        )}`}
                        className="inline-flex min-w-0 shrink items-center gap-2 text-foreground/80 transition-colors hover:text-primary"
                      >
                        {cat.icon || cat.image ? (
                          <AppImage
                            src={(cat.icon || cat.image) as string}
                            alt={cat.name}
                            className="h-5 w-5 shrink-0 object-contain"
                            width={20}
                            height={20}
                          />
                        ) : (
                          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="block max-w-28 truncate lg:max-w-36 xl:max-w-44">
                          {cat.name}
                        </span>
                      </Link>
                    ))}
                {flowingUtilityMenuItems.length > 0
                  ? flowingUtilityMenuItems.map((item, idx) => {
                      const isBlog =
                        item.label.toLowerCase() === "blog" ||
                        item.href.includes("/blog");
                      const isTrackOrder =
                        item.label.toLowerCase() === "track order" ||
                        item.href.includes("/track-order");
                      const iconSrc = item.icon;

                      return (
                        <Link
                          key={`nav-${item.href}-${idx}`}
                          href={item.href}
                          target={item.target}
                          rel={
                            item.target === "_blank"
                              ? "noopener noreferrer"
                              : undefined
                          }
                          className={`inline-flex shrink-0 items-center gap-2 transition-colors hover:text-primary ${
                            pathname === item.href ||
                            (item.href !== `/${locale}` &&
                              pathname.startsWith(item.href))
                              ? "text-foreground"
                              : "text-foreground/80"
                          }`}
                        >
                          {iconSrc ? (
                            <AppImage
                              src={iconSrc}
                              alt={item.label}
                              width={16}
                              height={16}
                              className="h-4 w-4 object-contain"
                            />
                          ) : isTrackOrder ? (
                            <Package className="h-4 w-4" />
                          ) : isBlog ? (
                            <Rss className="h-4 w-4" />
                          ) : null}
                          <span className="whitespace-nowrap">{item.label}</span>
                        </Link>
                      );
                    })
                  : null}
              </nav>

              {fixedUtilityMenuItems.length > 0 ||
              (showCollectionsMenu &&
                collectionsMenuPosition === "right" &&
                collections.length > 0) ? (
                <div className="ml-auto flex shrink-0 items-center gap-6 text-sm">
                  {showCollectionsMenu &&
                  collectionsMenuPosition === "right" &&
                  collections.length > 0 ? (
                    <Link
                      href={`/${locale}/collections`}
                      className="inline-flex shrink-0 items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      <Layers className="h-4 w-4" />
                      <span className="whitespace-nowrap">
                        {collectionsMenuLabel}
                      </span>
                    </Link>
                  ) : null}
                  {fixedUtilityMenuItems.map((item, idx) => {
                    const isBlog =
                      item.label.toLowerCase() === "blog" ||
                      item.href.includes("/blog");
                    const isTrackOrder =
                      item.label.toLowerCase() === "track order" ||
                      item.href.includes("/track-order");
                    const iconSrc = item.icon;

                    return (
                      <Link
                        key={`fixed-nav-${item.href}-${idx}`}
                        href={item.href}
                        target={item.target}
                        rel={
                          item.target === "_blank"
                            ? "noopener noreferrer"
                            : undefined
                        }
                        className={`inline-flex shrink-0 items-center gap-2 transition-colors hover:text-primary ${
                          pathname === item.href ||
                          (item.href !== `/${locale}` &&
                            pathname.startsWith(item.href))
                            ? "text-foreground"
                            : "text-foreground/80"
                        }`}
                      >
                        {iconSrc ? (
                          <AppImage
                            src={iconSrc}
                            alt={item.label}
                            width={16}
                            height={16}
                            className="h-4 w-4 object-contain"
                          />
                        ) : isTrackOrder ? (
                          <Package className="h-4 w-4" />
                        ) : isBlog ? (
                          <Rss className="h-4 w-4" />
                        ) : null}
                        <span className="whitespace-nowrap">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}

            </div>
            )}
          </div>
        </header>
      </div>
    </>
  );
}
