"use client";

import Link from "next/link";
import * as React from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  Tags,
  Tag,
  ShoppingCart,
  Settings,
  BarChart,
  BarChart3,
  ChevronRight,
  Home,
  ClipboardList,
  Layers,
  Warehouse,
  FileBox,
  ArrowLeftRight,
  Gift,
  Megaphone,
  Percent,
  FileText,
  Globe,
  PlusCircle,
  ArrowLeft,
  MapPin,
  UserCog,
  CreditCard,
  HandCoins,
  MessageSquare,
  Newspaper,
  ListTree,
  Bot,
  CalendarClock,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import { useAppSettings, presetColors } from "@/stores/app-settings";
import {
  useMultiVendorMode,
  useAppSettings as usePublicAppSettings,
} from "@/providers/app-settings-provider";
import { USER_ROLES } from "@/config/app.config";
import { isStaffRole } from "@/lib/staff-role";
import { DEFAULT_STORE_NAME } from "@/config/branding.config";
import { AppImage } from "@/components/ui/app-image";
import { useAppTheme } from "@/providers/theme-provider";

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Store,
  Package,
  Tags,
  Tag,
  ShoppingCart,
  Settings,
  BarChart,
  BarChart3,
  Home,
  ClipboardList,
  Layers,
  Warehouse,
  FileBox,
  ArrowLeftRight,
  Gift,
  Megaphone,
  Percent,
  FileText,
  Globe,
  PlusCircle,
  ArrowLeft,
  MapPin,
  UserCog,
  CreditCard,
  HandCoins,
  MessageSquare,
  Newspaper,
  ListTree,
  Bot,
  CalendarClock,
  SlidersHorizontal,
  Sparkles,
};

// POS-specific navigation items
const posNavItems: NavItem[] = [
  {
    label: "pos.newSale",
    href: "/admin/pos",
    icon: "ShoppingCart",
  },
  {
    label: "admin.sidebar.orders",
    href: "/admin/orders",
    icon: "ClipboardList",
  },
  {
    label: "admin.sidebar.posStaff",
    href: "/admin/pos/staff",
    icon: "Users",
  },
  {
    label: "admin.sidebar.posLocations",
    href: "/admin/pos/locations",
    icon: "MapPin",
  },
];

interface NavItem {
  label: string;
  href: string;
  icon: string;
  items?: NavItem[];
}

interface DashboardSidebarProps {
  locale: string;
  user: {
    name: string;
    email: string;
    image?: string;
    role: string;
  };
  staffPermissions?: string[];
  vendorPermissions?: string[];
}

const adminNavGroups: {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}[] = [
  {
    label: "",
    items: [
      // ── Overview ──────────────────────────────
      {
        label: "admin.sidebar.overview",
        href: "/admin/dashboard",
        icon: "LayoutDashboard",
      },
            // ── Measure ───────────────────────────────
      {
        label: "admin.sidebar.analytics",
        href: "/admin/analytics",
        icon: "BarChart3",
      },
      // ── Sell (daily operations) ───────────────
      {
        label: "admin.sidebar.orders",
        href: "/admin/orders",
        icon: "ClipboardList",
        items: [
          {
            label: "admin.sidebar.allOrders",
            href: "/admin/orders",
            icon: "ClipboardList",
          },
          {
            label: "Pre-orders",
            href: "/admin/preorders",
            icon: "CalendarClock",
          },
          {
            label: "admin.sidebar.returns",
            href: "/admin/returns",
            icon: "ArrowLeftRight",
          },
          {
            label: "admin.sidebar.abandonedCheckouts",
            href: "/admin/abandoned-checkouts",
            icon: "ShoppingCart",
          },
        ],
      },
      {
        label: "admin.sidebar.products",
        href: "/admin/products",
        icon: "Package",
        items: [
          {
            label: "admin.sidebar.allProducts",
            href: "/admin/products",
            icon: "Package",
          },
          {
            label: "admin.sidebar.globalVariants",
            href: "/admin/global-variants",
            icon: "SlidersHorizontal",
          },
          {
            label: "admin.sidebar.collections",
            href: "/admin/collections",
            icon: "Layers",
          },
          {
            label: "admin.sidebar.categories",
            href: "/admin/categories",
            icon: "Tags",
          },
          {
            label: "admin.sidebar.brands",
            href: "/admin/brands",
            icon: "Tag",
          },
          {
            label: "admin.sidebar.inventory",
            href: "/admin/inventory",
            icon: "Warehouse",
          },
          // {
          //   label: "admin.sidebar.purchaseOrders",
          //   href: "/admin/purchase-orders",
          //   icon: "FileBox",
          // },
          {
            label: "admin.sidebar.transfers",
            href: "/admin/transfers",
            icon: "ArrowLeftRight",
          },
          {
            label: "admin.sidebar.reviews",
            href: "/admin/reviews",
            icon: "MessageSquare",
          },
          // {
          //   label: "admin.sidebar.giftCards",
          //   href: "/admin/gift-cards",
          //   icon: "Gift",
          // },
        ],
      },
      {
        label: "admin.sidebar.aiStudio",
        href: "/admin/ai-studio",
        icon: "Sparkles",
      },
       {
        label: "admin.sidebar.aiSalesAgent",
        href: "/admin/ai-sales-agent",
        icon: "Bot",
      },
      // ── People ────────────────────────────────
      {
        label: "admin.sidebar.customers",
        href: "/admin/customers",
        icon: "Users",
      },
      {
        label: "admin.sidebar.vendors",
        href: "/admin/vendors",
        icon: "Store",
      },
      {
        label: "admin.sidebar.staff",
        href: "/admin/staff",
        icon: "UserCog",
      },
      // ── Money ─────────────────────────────────
      {
        label: "admin.sidebar.payments",
        href: "/admin/payments",
        icon: "CreditCard",
        items: [
          {
            label: "admin.sidebar.payments",
            href: "/admin/payments",
            icon: "CreditCard",
          },
          {
            label: "admin.sidebar.payouts",
            href: "/admin/payouts",
            icon: "HandCoins",
          },
          {
            label: "admin.sidebar.transactions",
            href: "/admin/payments/transactions",
            icon: "CreditCard",
          },
        ],
      },
      // ── Grow (sales-driving tools) ────────────
      // {
      //   label: "admin.sidebar.marketing",
      //   href: "/admin/marketing",
      //   icon: "Megaphone",
      // },
      {
        label: "admin.sidebar.discounts",
        href: "/admin/discounts",
        icon: "Percent",
      },
     
      // ── Engage ────────────────────────────────
      {
        label: "admin.sidebar.content",
        href: "/admin/content/blog-posts",
        icon: "FileText",
        items: [
          {
            label: "admin.sidebar.blogPosts",
            href: "/admin/content/blog-posts",
            icon: "Newspaper",
          },
        ],
      },
      {
        label: "Inbox",
        href: "/admin/inbox",
        icon: "MessageSquare",
      },
      // {
      //   label: "admin.sidebar.markets",
      //   href: "/admin/markets",
      //   icon: "Globe",
      // }
    ],
  },
  {
    label: "admin.sidebar.salesChannels",
    collapsible: true,
    items: [
      {
        label: "admin.sidebar.onlineStore",
        href: "/admin/online-store",
        icon: "Store",
        items: [
          {
            label: "admin.sidebar.themes",
            href: "/admin/online-store/theme",
            icon: "Layers",
          },
          {
            label: "admin.sidebar.home",
            href: "/admin/online-store/home-page",
            icon: "Home",
          },
          {
            label: "admin.sidebar.pages",
            href: "/admin/online-store/pages",
            icon: "FileText",
          },
          {
            label: "admin.sidebar.menus",
            href: "/admin/online-store/menus",
            icon: "ListTree",
          },
        ],
      },
      {
        label: "admin.sidebar.pos",
        href: "/admin/pos",
        icon: "ShoppingCart",
      },
    ],
  },
];

function buildStaffNavGroups(
  permissions: string[] | undefined,
  posEnabled: boolean,
): { label: string; items: NavItem[]; collapsible?: boolean }[] {
  const perms = new Set(permissions || []);
  const items: NavItem[] = [];

  if (posEnabled && perms.has("access_pos")) {
    const posItem: NavItem = {
      label: "admin.sidebar.pos",
      href: "/admin/pos",
      icon: "ShoppingCart",
    };

    if (
      perms.has("manage_pos") ||
      perms.has("create_pos") ||
      perms.has("edit_pos") ||
      perms.has("delete_pos")
    ) {
      posItem.items = [
        { label: "pos.newSale", href: "/admin/pos", icon: "ShoppingCart" },
        {
          label: "admin.sidebar.posStaff",
          href: "/admin/pos/staff",
          icon: "Users",
        },
        {
          label: "admin.sidebar.posLocations",
          href: "/admin/pos/locations",
          icon: "MapPin",
        },
      ];
    }

    items.push(posItem);
  }

  if (perms.has("view_orders")) {
    items.push({
      label: "admin.sidebar.orders",
      href: "/admin/orders",
      icon: "ClipboardList",
    });
  }

  if (
    perms.has("view_products") ||
    perms.has("manage_products") ||
    perms.has("create_products") ||
    perms.has("edit_products") ||
    perms.has("delete_products")
  ) {
    const productItem: NavItem = {
      label: "admin.sidebar.products",
      href: "/admin/products",
      icon: "Package",
    };

    items.push(productItem);
  }

  if (
    perms.has("view_customers") ||
    perms.has("create_customers") ||
    perms.has("edit_customers") ||
    perms.has("delete_customers")
  ) {
    items.push({
      label: "admin.sidebar.customers",
      href: "/admin/customers",
      icon: "Users",
    });
  }

  if (
    perms.has("view_inventory") ||
    perms.has("create_inventory") ||
    perms.has("edit_inventory") ||
    perms.has("delete_inventory")
  ) {
    items.push({
      label: "admin.sidebar.inventory",
      href: "/admin/inventory",
      icon: "Warehouse",
    });
  }

  if (perms.has("view_analytics")) {
    items.push({
      label: "admin.sidebar.analytics",
      href: "/admin/analytics",
      icon: "BarChart3",
    });
  }

  return [{ label: "", items }];
}

function buildVendorNavGroups(
  permissions: string[] | undefined,
  posEnabled: boolean,
): { label: string; items: NavItem[] }[] {
  const perms = new Set(permissions || []);
  const items: NavItem[] = [
    {
      label: "vendor.dashboard",
      href: "/vendor/dashboard",
      icon: "LayoutDashboard",
    },
  ];

  {
    const hasProductAccess =
      perms.has("view_products") ||
      perms.has("manage_products") ||
      perms.has("create_products") ||
      perms.has("edit_products") ||
      perms.has("delete_products");
    const hasBrandAccess = perms.has("view_brands");

    if (hasProductAccess || hasBrandAccess) {
      const productItems: NavItem[] = [];

      if (hasProductAccess) {
        productItems.push(
          {
            label: "admin.sidebar.allProducts",
            href: "/vendor/products",
            icon: "Package",
          },
          {
            label: "admin.sidebar.inventory",
            href: "/vendor/inventory",
            icon: "Warehouse",
          },
        );
      }

      if (hasBrandAccess) {
        productItems.push({
          label: "admin.sidebar.brands",
          href: "/vendor/brands",
          icon: "Tag",
        });
      }

      items.push({
        label: "vendor.products",
        href: productItems[0].href,
        icon: "Package",
        items: productItems,
      });
    }
  }

  if (
    perms.has("view_orders") ||
    perms.has("manage_orders") ||
    perms.has("create_orders") ||
    perms.has("edit_orders") ||
    perms.has("delete_orders")
  ) {
    items.push({
      label: "vendor.orders",
      href: "/vendor/orders",
      icon: "ShoppingCart",
      items: [
        {
          label: "admin.sidebar.allOrders",
          href: "/vendor/orders",
          icon: "ClipboardList",
        },
        {
          label: "Pre-orders",
          href: "/vendor/preorders",
          icon: "CalendarClock",
        },
        {
          label: "admin.sidebar.returns",
          href: "/vendor/returns",
          icon: "ArrowLeftRight",
        },
      ],
    });
  }

  if (
    perms.has("view_payouts") ||
    perms.has("manage_payouts") ||
    perms.has("create_payouts") ||
    perms.has("edit_payouts") ||
    perms.has("delete_payouts")
  ) {
    items.push({
      label: "vendor.payouts",
      href: "/vendor/payouts",
      icon: "HandCoins",
    });
  }

  if (
    perms.has("view_discounts") ||
    perms.has("manage_discounts") ||
    perms.has("create_discounts") ||
    perms.has("edit_discounts") ||
    perms.has("delete_discounts") ||
    perms.has("manage_products") ||
    perms.has("create_products") ||
    perms.has("edit_products") ||
    perms.has("delete_products")
  ) {
    items.push({
      label: "admin.sidebar.discounts",
      href: "/vendor/discounts",
      icon: "Percent",
    });
  }

  if (
    perms.has("view_staff") ||
    perms.has("manage_staff") ||
    perms.has("create_staff") ||
    perms.has("edit_staff") ||
    perms.has("delete_staff") ||
    perms.has("manage_store_settings")
  ) {
    items.push({
      label: "admin.sidebar.staff",
      href: "/vendor/staff",
      icon: "UserCog",
    });
  }

  if (posEnabled && perms.has("access_pos")) {
    items.push({
      label: "admin.sidebar.pos",
      href: "/vendor/pos",
      icon: "ShoppingCart",
    });
  }

  return [{ label: "", items }];
}

function filterNavGroupsByHref<T extends { items: NavItem[] }>(
  groups: T[],
  blockedHrefs: Set<string>,
): T[] {
  return groups.map((group) => ({
    ...group,
    items: filterNavItemsByHref(group.items, blockedHrefs),
  }));
}

function filterNavItemsByHref(
  items: NavItem[],
  blockedHrefs: Set<string>,
): NavItem[] {
  return items
    .filter((item) => !blockedHrefs.has(item.href))
    .map((item) => ({
      ...item,
      items: item.items
        ? filterNavItemsByHref(item.items, blockedHrefs)
        : undefined,
    }));
}

function CollapsedHoverSubmenu({
  item,
  submenuItems,
  Icon,
  isActive,
  isApparent,
  isRTL,
  basePath,
  tLabel,
}: {
  item: NavItem;
  submenuItems: NavItem[];
  Icon: LucideIcon;
  isActive: boolean;
  isApparent: boolean;
  isRTL: boolean;
  basePath: string;
  tLabel: (key: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, [cancelClose]);

  React.useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <SidebarMenuItem
      className="group-data-[collapsible=icon]:w-full"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="sm"
            isActive={isActive}
            className={cn(
              "relative rounded-lg px-3 py-2.5 h-9 text-[13px] transition-colors w-full justify-center group/btn cursor-pointer",
              "group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1.5 group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-1.5",
              isApparent
                ? isActive
                  ? "bg-white/20 text-white hover:bg-white/25 font-semibold"
                  : "text-white/80 hover:bg-white/10 hover:text-white font-semibold"
                : isActive
                  ? "bg-primary/10 text-primary hover:bg-primary/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/20 font-semibold"
                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground font-semibold",
            )}
          >
            <Icon className="size-4.5 shrink-0 stroke-2 transition-transform duration-300 group-data-[collapsible=icon]:size-3.5 group-data-[collapsible=icon]:-translate-x-1" />
            <ChevronRight
              className={cn(
                "absolute top-2.5 h-2.5 w-2.5 opacity-70",
                isRTL ? "left-2 rotate-180" : "right-2",
                isApparent
                  ? "text-white/70"
                  : isActive
                    ? "text-sidebar-accent-foreground"
                    : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "hidden text-[10px] leading-tight group-data-[collapsible=icon]:block text-center wrap-break-word whitespace-normal overflow-visible",
                isApparent
                  ? "text-white"
                  : isActive
                    ? "text-sidebar-accent-foreground"
                    : "text-muted-foreground",
              )}
            >
              {tLabel(item.label)}
            </span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isRTL ? "left" : "right"}
          align="start"
          sideOffset={10}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-56 p-2 rounded-2xl shadow-xl border-border/50 bg-popover/95 backdrop-blur-sm"
        >
          {submenuItems.map((child) => {
            const isChildItemActive =
              basePath === child.href || basePath.startsWith(`${child.href}/`);
            return (
              <DropdownMenuItem
                key={child.href}
                asChild
                className="p-0 mb-0.5 last:mb-0 focus:bg-transparent"
              >
                <Link
                  href={child.href}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-colors",
                    isChildItemActive
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="text-sm">{tLabel(child.label)}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function DashboardSidebar({
  locale,
  user,
  staffPermissions,
  vendorPermissions,
}: DashboardSidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const basePath = React.useMemo(() => {
    const prefix = `/${locale}`;
    if (pathname?.startsWith(prefix)) {
      const stripped = pathname.slice(prefix.length);
      return stripped.length ? stripped : "/";
    }
    return pathname;
  }, [pathname, locale]);
  const { navColor, presetColor, rtl } = useAppSettings();
  const { isMultiVendor } = useMultiVendorMode();
  const { storeName, logoUrl, darkModeLogoUrl, faviconUrl, posEnabled } =
    usePublicAppSettings();
  const { isDark } = useAppTheme();
  const { state: sidebarState, toggleSidebar, isMobile } = useSidebar();
  const tLabel = React.useCallback(
    (key: string) => {
      if (!key.includes(".")) return key;
      try {
        return t(key as never);
      } catch {
        return key;
      }
    },
    [t],
  );

  // Detect if we're on a POS page
  const isPosTerminal =
    basePath === "/admin/pos" ||
    basePath === "/vendor/pos" ||
    basePath === "/staff/pos";
  const isPosPage =
    isPosTerminal ||
    basePath.startsWith("/admin/pos/") ||
    basePath.startsWith("/vendor/pos/") ||
    basePath.startsWith("/staff/pos/");

  const navGroups = React.useMemo(() => {
    const baseGroups =
      user.role === USER_ROLES.ADMIN
        ? adminNavGroups
        : isStaffRole(user.role)
          ? buildStaffNavGroups(staffPermissions, Boolean(posEnabled))
          : buildVendorNavGroups(vendorPermissions, Boolean(posEnabled));

    let nextGroups = baseGroups;

    if (!isMultiVendor && user.role === USER_ROLES.ADMIN) {
      nextGroups = filterNavGroupsByHref(
        nextGroups,
        new Set(["/admin/vendors", "/admin/payouts"]),
      );
    }

    if (!isMultiVendor && user.role === USER_ROLES.VENDOR) {
      nextGroups = filterNavGroupsByHref(
        nextGroups,
        new Set(["/vendor/preorders"]),
      );
    }

    if (user.role === USER_ROLES.ADMIN && !posEnabled) {
      nextGroups = nextGroups.map((group) => {
        if (group.label === "admin.sidebar.salesChannels") {
          return {
            ...group,
            items: group.items.filter((item) => item.href !== "/admin/pos"),
          };
        }
        return group;
      });
    }

    return nextGroups;
  }, [
    user.role,
    isMultiVendor,
    posEnabled,
    staffPermissions,
    vendorPermissions,
  ]);

  // RTL detection based on locale OR manual setting
  const isRTL = locale === "ar" || rtl; // Arabic locale or manual RTL toggle
  const sidebarSide = isRTL ? "right" : "left";

  const handleLogout = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Force collapsed behavior to minimize (icon rail)
  const collapsible = "icon";
  const isIconCollapsed =
    !isMobile && collapsible === "icon" && sidebarState === "collapsed";

  // Determine if using apparent (dark) sidebar
  const isApparent = navColor === "apparent";
  const useDarkSidebarBrand = isDark || isApparent;

  // Get the preset color value for apparent mode (use hex for inline style compatibility)
  const presetColorHex = presetColors[presetColor]?.hex;
  const currentLogoUrl =
    useDarkSidebarBrand &&
    typeof darkModeLogoUrl === "string" &&
    darkModeLogoUrl.trim()
      ? darkModeLogoUrl
      : typeof logoUrl === "string" && logoUrl.trim()
        ? logoUrl
        : "";
  const currentFaviconUrl =
    typeof faviconUrl === "string" && faviconUrl.trim()
      ? faviconUrl
      : "/favicon.ico";

  const renderSidebarBrand = () => {
    if (isIconCollapsed) {
      return (
        <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-md">
          <AppImage
            src={currentFaviconUrl}
            alt="Favicon"
            className="h-8 w-8 object-contain"
            width={32}
            height={32}
          />
        </span>
      );
    }

    if (currentLogoUrl) {
      return (
        <span className="relative block h-8 w-full overflow-hidden">
          <AppImage
            src={currentLogoUrl}
            alt="Logo"
            className="h-8 w-full object-contain object-left"
            width={224}
            height={32}
          />
        </span>
      );
    }

    return (
      <span
        className={cn(
          "block text-lg font-bold truncate",
          isApparent
            ? "text-white"
            : "bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent",
        )}
      >
        {typeof storeName === "string" && storeName.trim()
          ? storeName
          : DEFAULT_STORE_NAME}
      </span>
    );
  };

  const initiallyOpenHrefs = React.useMemo(() => {
    const openSet = new Set<string>();
    for (const group of navGroups) {
      for (const item of group.items) {
        const children = item.items;
        if (!children?.length) continue;
        const isSelfActive =
          basePath === item.href || basePath.startsWith(`${item.href}/`);
        const isChildActive = children.some(
          (child) =>
            basePath === child.href || basePath.startsWith(`${child.href}/`),
        );
        if (isSelfActive || isChildActive) openSet.add(item.href);
      }
    }
    return openSet;
  }, [navGroups, basePath]);

  const [openSections, setOpenSections] = React.useState<Set<string>>(
    () => initiallyOpenHrefs,
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpenSections(initiallyOpenHrefs);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initiallyOpenHrefs]);

  const toggleSection = React.useCallback((href: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }, []);

  // Removed hover-controlled flyout state to make submenus open on click only
  const canAccessVendorSettings = React.useMemo(() => {
    if (user.role !== USER_ROLES.VENDOR) {
      return false;
    }

    const perms = new Set(vendorPermissions || []);
    return (
      perms.has("view_store_settings") ||
      perms.has("manage_store_settings") ||
      perms.has("create_store_settings") ||
      perms.has("edit_store_settings") ||
      perms.has("delete_store_settings")
    );
  }, [user.role, vendorPermissions]);

  const footerSettings = React.useMemo(() => {
    if (user.role === USER_ROLES.ADMIN) {
      return {
        path: "/admin/settings",
        label: t("common.settings"),
      };
    }

    if (canAccessVendorSettings) {
      return {
        path: "/vendor/settings",
        label: tLabel("vendor.settings"),
      };
    }

    return null;
  }, [user.role, canAccessVendorSettings, t, tLabel]);

  // ============================================
  // POS Terminal — no sidebar (fullscreen)
  // ============================================
  if (isPosTerminal) {
    return null;
  }

  // ============================================
  // POS Sub-pages Sidebar (staff, locations)
  // ============================================
  if (isPosPage) {
    return (
      <Sidebar
        key={`pos-sidebar-${locale}-${sidebarSide}`}
        side={sidebarSide}
        className={cn(
          "border-r-0 transition-colors duration-300",
          isRTL && "border-l-0 border-r",
        )}
        style={
          isApparent
            ? ({
                "--sidebar": presetColorHex,
                "--color-sidebar": presetColorHex,
                "--sidebar-foreground": "#ffffff",
                "--color-sidebar-foreground": "#ffffff",
                "--sidebar-accent": "rgb(255 255 255 / 0.2)",
                "--color-sidebar-accent": "rgb(255 255 255 / 0.2)",
                "--sidebar-accent-foreground": "#ffffff",
                "--color-sidebar-accent-foreground": "#ffffff",
              } as React.CSSProperties)
            : undefined
        }
        collapsible={collapsible}
      >
        {!isMobile && (
          <div
            suppressHydrationWarning
            className={`absolute top-0 bottom-0 w-px ${
              isApparent ? "bg-white/30" : "bg-border"
            } z-30 pointer-events-none ${isRTL ? "-left-px" : "-right-px"}`}
          />
        )}
        <SidebarHeader className="border-b-0 px-3 py-3 relative group-data-[collapsible=icon]:px-2">
          <Link
            href={`/${locale}`}
            className="flex w-full items-center px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            {renderSidebarBrand()}
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-3 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:gap-1">
          {/* Back to Admin */}
          <SidebarGroup className="group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2">
            <SidebarGroupContent>
              <SidebarMenu className="gap-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-3">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    className={cn(
                      "rounded-lg px-3 py-2.5 h-9 text-[13px] transition-colors group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1.5",
                      isApparent
                        ? "text-white/80 hover:bg-white/10 hover:text-white font-semibold"
                        : "text-foreground/70 hover:bg-muted/60 hover:text-foreground font-semibold",
                    )}
                  >
                    <Link href="/admin/dashboard" className="relative w-full">
                      <div className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center">
                        <ArrowLeft className="size-4.5 shrink-0 stroke-2 transition-transform duration-300 group-data-[collapsible=icon]:size-5" />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {t("common.backToDashboard")}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "hidden text-[11px] leading-tight group-data-[collapsible=icon]:block text-center",
                          isApparent ? "text-white" : "text-muted-foreground",
                        )}
                      >
                        {t("common.back")}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* POS Navigation */}
          <SidebarGroup className="group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2">
            <SidebarGroupLabel
              className={cn(
                "px-4 mb-1 text-[11px] font-semibold tracking-[0.08em] group-data-[collapsible=icon]:hidden uppercase",
                isApparent ? "text-white/60" : "text-muted-foreground/60",
              )}
            >
              {t("admin.sidebar.pos")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-3">
                {posNavItems.map((item) => {
                  const Icon = iconMap[item.icon] || Package;
                  const isActive =
                    basePath === item.href ||
                    (item.href !== "/admin/pos" &&
                      basePath.startsWith(`${item.href}/`));
                  // For the main POS route, only exact match (not sub-routes like /staff)
                  const isPosExact =
                    item.href === "/admin/pos" && basePath === "/admin/pos";
                  const isItemActive =
                    item.href === "/admin/pos" ? isPosExact : isActive;

                  return (
                    <SidebarMenuItem
                      key={item.href}
                      className="group-data-[collapsible=icon]:w-full"
                    >
                      <SidebarMenuButton
                        asChild
                        size="sm"
                        isActive={isItemActive}
                        className={cn(
                          "rounded-lg px-3 py-2.5 h-9 text-[13px] transition-colors group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1.5",
                          isApparent
                            ? isItemActive
                              ? "bg-white/20 text-white hover:bg-white/25 font-semibold"
                              : "text-white/80 hover:bg-white/10 hover:text-white font-semibold"
                            : isItemActive
                              ? "bg-primary/10 text-primary hover:bg-primary/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/20 font-semibold"
                              : "text-foreground/70 hover:bg-muted/60 hover:text-foreground font-semibold",
                        )}
                      >
                        <Link href={item.href} className="relative w-full">
                          <div className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center">
                            <Icon className="size-4.5 shrink-0 stroke-2 transition-transform duration-300 group-data-[collapsible=icon]:size-5" />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {tLabel(item.label)}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "hidden text-[11px] leading-tight group-data-[collapsible=icon]:block text-center",
                              isApparent
                                ? "text-white"
                                : isItemActive
                                  ? "text-sidebar-accent-foreground"
                                  : "text-muted-foreground",
                            )}
                          >
                            {tLabel(item.label)}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2 mt-auto">
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="sm"
                className={cn(
                  "rounded-lg px-3 py-2.5 h-9 text-[13px] transition-colors group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1.5",
                  isApparent
                    ? "text-white/80 hover:bg-white/10 hover:text-white font-semibold"
                    : "text-foreground/70 hover:bg-muted/60 hover:text-foreground font-semibold",
                )}
              >
                <Link
                  href="/admin/settings"
                  className="relative py-4 flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center"
                >
                  <Settings className="size-4.5 shrink-0 stroke-2 transition-transform duration-300 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:size-5" />
                  <span className="flex-1 group-data-[collapsible=icon]:hidden">
                    {t("common.settings")}
                  </span>
                  <span
                    className={cn(
                      "hidden text-[11px] leading-tight group-data-[collapsible=icon]:block text-center",
                      isApparent ? "text-white" : "text-muted-foreground",
                    )}
                  >
                    {t("common.settings")}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    );
  }

  // ============================================
  // Default Admin/Vendor Sidebar
  // ============================================
  return (
    <Sidebar
      key={`dashboard-sidebar-${locale}-${sidebarSide}`}
      side={sidebarSide}
      className={cn(
        "border-r-0 transition-colors duration-300",
        isRTL && "border-l-0 border-r",
      )}
      style={
        isApparent
          ? ({
              "--sidebar": presetColorHex,
              "--color-sidebar": presetColorHex,
              "--sidebar-foreground": "#ffffff",
              "--color-sidebar-foreground": "#ffffff",
              "--sidebar-accent": "rgb(255 255 255 / 0.2)",
              "--color-sidebar-accent": "rgb(255 255 255 / 0.2)",
              "--sidebar-accent-foreground": "#ffffff",
              "--color-sidebar-accent-foreground": "#ffffff",
            } as React.CSSProperties)
          : undefined
      }
      collapsible={collapsible}
    >
      {/* Collapse Toggle Button with vertical line - positioned at sidebar level */}
      {!isMobile && (
        <div
          suppressHydrationWarning
          className={`absolute top-0 bottom-0 w-px ${
            isApparent ? "bg-white/30" : "bg-border"
          } z-30 pointer-events-none ${isRTL ? "-left-px" : "-right-px"}`}
        />
      )}
      <SidebarHeader className="border-b-0 px-3 py-3 relative group-data-[collapsible=icon]:px-2">
        <Link
          href={`/${locale}`}
          className="flex w-full items-center px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {renderSidebarBrand()}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:gap-1">
        {navGroups.map((group, groupIndex) => (
          <SidebarGroup
            key={group.label}
            className={cn(
              groupIndex === 0 ? "mt-0" : "mt-2",
              "group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2",
            )}
          >
            {group.label && (
              <SidebarGroupLabel
                className={cn(
                  "px-4 mb-1 text-[11px] font-semibold tracking-[0.08em] group-data-[collapsible=icon]:hidden flex items-center uppercase",
                  isApparent ? "text-white/60" : "text-muted-foreground/60",
                )}
              >
                {tLabel(group.label)}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-3">
                {group.items.map((item) => {
                  const Icon = iconMap[item.icon] || Package;
                  // Check if item matches current path (self)
                  const isSelfActive =
                    basePath === item.href ||
                    basePath.startsWith(`${item.href}/`);

                  // Check if any child matches current path
                  const isChildActive = Boolean(
                    item.items?.some(
                      (child) =>
                        basePath === child.href ||
                        basePath.startsWith(`${child.href}/`),
                    ),
                  );

                  const isActive = isSelfActive || isChildActive;

                  if (item.items && item.items.length > 0) {
                    const children = item.items;
                    const isOpen = isChildActive || openSections.has(item.href);
                    const isSectionActive = isActive;
                    const isSectionExpanded = isOpen || isChildActive;

                    if (isIconCollapsed) {
                      return (
                        <CollapsedHoverSubmenu
                          key={item.href}
                          item={item}
                          submenuItems={children}
                          Icon={Icon}
                          isActive={isActive}
                          isApparent={isApparent}
                          isRTL={isRTL}
                          basePath={basePath}
                          tLabel={tLabel}
                        />
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.href} className="mb-0.5">
                        <SidebarMenuButton
                          type="button"
                          size="sm"
                          isActive={isSectionActive}
                          aria-expanded={isOpen}
                          onClick={() => toggleSection(item.href)}
                          className={cn(
                            "rounded-lg px-3 py-2.5 h-9 text-[13px] transition-colors w-full justify-between group/btn cursor-pointer",
                            isApparent
                              ? isSectionActive
                                ? "bg-white/20 text-white hover:bg-white/25 font-semibold"
                                : isSectionExpanded
                                  ? "bg-white/10 text-white hover:bg-white/15 font-semibold"
                                  : "text-white/80 hover:bg-white/10 hover:text-white font-semibold"
                              : isSectionActive
                                ? "bg-primary/10 text-primary hover:bg-primary/10 data-[active=true]:bg-primary/10 data-[active=true]:text-primary dark:bg-white/15 dark:text-white dark:hover:bg-white/20 dark:data-[active=true]:bg-white/15 dark:data-[active=true]:text-white font-semibold"
                                : isSectionExpanded
                                  ? "bg-muted/70 text-foreground hover:bg-muted/80 font-semibold"
                                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground font-semibold",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="size-4.5 shrink-0 stroke-2 transition-transform duration-300 group-data-[collapsible=icon]:size-5" />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {tLabel(item.label)}
                            </span>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform duration-200 opacity-60 group-data-[collapsible=icon]:hidden",
                              isOpen && "rotate-90 opacity-100",
                            )}
                          />
                        </SidebarMenuButton>

                        {isOpen && (
                          <SidebarMenuSub className="ml-2 mt-1 pl-2.5 border-l-0 relative">
                            {children.map((child, childIndex) => {
                              const childSelfActive =
                                basePath === child.href ||
                                basePath.startsWith(`${child.href}/`);
                              const grandChildren = child.items ?? [];
                              const isGrandChildActive = grandChildren.some(
                                (grandChild) =>
                                  basePath === grandChild.href ||
                                  basePath.startsWith(`${grandChild.href}/`),
                              );
                              const isChildItemActive =
                                childSelfActive || isGrandChildActive;
                              const isChildOpen =
                                childSelfActive ||
                                isGrandChildActive ||
                                openSections.has(child.href);
                              const isChildLeafActive =
                                childSelfActive && !isGrandChildActive;
                              const isLast = childIndex === children.length - 1;

                              return (
                                <React.Fragment key={child.href}>
                                  <SidebarMenuSubItem className="relative h-7 flex items-center pl-4">
                                    {/* Vertical line */}
                                    <div
                                      className={cn(
                                        "absolute left-0 w-px",
                                        isApparent
                                          ? "bg-white/30"
                                          : "bg-border/50 dark:bg-white/30",
                                        isLast
                                          ? "top-0 h-3.5"
                                          : "top-0 bottom-0",
                                      )}
                                    />
                                    {/* Horizontal branch */}
                                    <div
                                      className={cn(
                                        "absolute left-0 top-3.5 w-4 h-px",
                                        isApparent
                                          ? "bg-white/30"
                                          : "bg-border/50 dark:bg-white/30",
                                      )}
                                    />

                                    {grandChildren.length > 0 ? (
                                      <SidebarMenuSubButton
                                        type="button"
                                        size="sm"
                                        isActive={isChildLeafActive}
                                        aria-expanded={isChildOpen}
                                        onClick={() =>
                                          toggleSection(child.href)
                                        }
                                        className={cn(
                                          "rounded-md px-2 py-1 text-[13px] font-medium relative z-10 w-full justify-between",
                                          isApparent
                                            ? isChildLeafActive
                                              ? "bg-white/20 text-white font-semibold"
                                              : isChildOpen
                                                ? "bg-white/10 text-white font-semibold hover:bg-white/15"
                                                : "text-white/90 hover:bg-white/15 hover:text-white"
                                            : isChildLeafActive
                                              ? "bg-muted text-foreground font-semibold data-[active=true]:bg-muted data-[active=true]:text-foreground"
                                              : isChildOpen
                                                ? "bg-muted/60 text-foreground font-semibold hover:bg-muted/70"
                                                : "text-foreground/60 hover:text-foreground",
                                        )}
                                      >
                                        <span>{tLabel(child.label)}</span>
                                        <ChevronRight
                                          className={cn(
                                            "h-3.5 w-3.5 opacity-70 transition-transform",
                                            isChildOpen &&
                                              "rotate-90 opacity-100",
                                          )}
                                        />
                                      </SidebarMenuSubButton>
                                    ) : (
                                      <SidebarMenuSubButton
                                        asChild
                                        size="sm"
                                        isActive={isChildItemActive}
                                        className={cn(
                                          "rounded-md px-2 py-1 text-[13px] font-medium relative z-10 w-full",
                                          isApparent
                                            ? "text-white/90 hover:bg-white/15 hover:text-white"
                                            : "text-foreground/60 hover:text-foreground",
                                          isChildItemActive &&
                                            (isApparent
                                              ? "bg-white/20 text-white font-semibold"
                                              : "bg-muted text-foreground font-semibold data-[active=true]:bg-muted data-[active=true]:text-foreground"),
                                        )}
                                      >
                                        <Link href={child.href}>
                                          <span>{tLabel(child.label)}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    )}
                                  </SidebarMenuSubItem>

                                  {grandChildren.length > 0 && isChildOpen && (
                                    <SidebarMenuSub className="ml-4 -mt-0.5 mb-0.5 pl-0 border-l-0">
                                      {grandChildren.map((grandChild) => {
                                        const isGrandChildItemActive =
                                          basePath === grandChild.href ||
                                          basePath.startsWith(
                                            `${grandChild.href}/`,
                                          );

                                        return (
                                          <SidebarMenuSubItem
                                            key={grandChild.href}
                                            className="relative h-7 flex items-center pl-4"
                                          >
                                            <div
                                              className={cn(
                                                "absolute left-0 top-3.5 w-3 h-px",
                                                isApparent
                                                  ? "bg-white/25"
                                                  : "bg-border/40 dark:bg-white/25",
                                              )}
                                            />
                                            <SidebarMenuSubButton
                                              asChild
                                              size="sm"
                                              isActive={isGrandChildItemActive}
                                              className={cn(
                                                "rounded-md px-2 py-1 text-[12px] font-medium relative z-10 w-full",
                                                isApparent
                                                  ? "text-white/80 hover:bg-white/15 hover:text-white"
                                                  : "text-foreground/60 hover:text-foreground",
                                                isGrandChildItemActive &&
                                                  (isApparent
                                                    ? "bg-white/20 text-white font-semibold"
                                                    : "bg-muted text-foreground font-semibold data-[active=true]:bg-muted data-[active=true]:text-foreground"),
                                              )}
                                            >
                                              <Link href={grandChild.href}>
                                                <span>
                                                  {tLabel(grandChild.label)}
                                                </span>
                                              </Link>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        );
                                      })}
                                    </SidebarMenuSub>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem
                      key={item.href}
                      className="group-data-[collapsible=icon]:w-full"
                    >
                      <SidebarMenuButton
                        asChild
                        size="sm"
                        isActive={isActive}
                        className={cn(
                          "rounded-lg px-3 py-2.5 h-9 text-[13px] transition-colors group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1.5",
                          isApparent
                            ? isActive
                              ? "bg-white/20 text-white hover:bg-white/25 font-semibold"
                              : "text-white/80 hover:bg-white/10 hover:text-white font-semibold"
                            : isActive
                              ? "bg-primary/10 text-primary hover:bg-primary/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/20 font-semibold"
                              : "text-foreground/70 hover:bg-muted/60 hover:text-foreground font-semibold",
                        )}
                      >
                        <Link href={item.href} className="relative w-full">
                          <div className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center">
                            <Icon className="size-4.5 shrink-0 stroke-2 transition-transform duration-300 group-data-[collapsible=icon]:size-5" />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {tLabel(item.label)}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "hidden text-[11px] leading-tight group-data-[collapsible=icon]:block text-center break-words whitespace-normal overflow-visible",
                              isApparent
                                ? "text-white"
                                : isActive
                                  ? "text-sidebar-accent-foreground"
                                  : "text-muted-foreground",
                            )}
                          >
                            {tLabel(item.label)}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {footerSettings && (
        <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2 mt-auto">
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem className="group-data-[collapsible=icon]:w-full">
              {(() => {
                const settingsPath = footerSettings.path;
                const isSettingsActive =
                  basePath === settingsPath ||
                  basePath.startsWith(`${settingsPath}/`);

                return (
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={isSettingsActive}
                    className={cn(
                      "rounded-lg px-3 py-2.5 h-9 text-[13px] transition-colors group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1.5",
                      isApparent
                        ? isSettingsActive
                          ? "bg-white/20 text-white hover:bg-white/25 font-semibold"
                          : "text-white/80 hover:bg-white/10 hover:text-white font-semibold"
                        : isSettingsActive
                          ? "bg-primary/10 text-primary hover:bg-primary/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/20 font-semibold"
                          : "text-foreground/70 hover:bg-muted/60 hover:text-foreground font-semibold",
                    )}
                  >
                    <Link
                      href={settingsPath}
                      className="relative py-4 flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center"
                    >
                      <Settings className="size-4.5 shrink-0 stroke-2 transition-transform duration-300 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:size-5" />
                      <span className="flex-1 group-data-[collapsible=icon]:hidden">
                        {footerSettings.label}
                      </span>
                      <span
                        className={cn(
                          "hidden text-[11px] leading-tight group-data-[collapsible=icon]:block text-center break-words whitespace-normal overflow-visible",
                          isApparent
                            ? "text-white"
                            : isSettingsActive
                              ? "text-sidebar-accent-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {footerSettings.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                );
              })()}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

export { SidebarTrigger };
