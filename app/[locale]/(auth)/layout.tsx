import { CartProvider } from "@/hooks/use-cart";
import { type Locale } from "@/config/i18n.config";
import { setRequestLocale } from "next-intl/server";
import { StoreHeader } from "@/components/layout/store-header";
import { StoreFooter } from "@/components/layout/store-footer";
import { getSettings } from "@/models";
import {
  ensureDefaultMenus,
  getMenusByLocation,
  type MenuItemPlain,
} from "@/lib/menu-helpers";
import { normalizeHeaderSettings } from "@/lib/header-config";
import {
  CONTENT_PAGE_KEYS,
  CONTENT_PAGE_META,
  HEADER_APP_PAGE_OPTIONS,
  normalizeContentPagesSettings,
} from "@/lib/content-pages-config";
import { normalizeFooterSettings } from "@/lib/footer-config";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export const dynamic = "force-dynamic";

type HeaderMenuItemPayload = {
  label: string;
  href: string;
  target: "_self" | "_blank";
  icon?: string;
  image?: string;
  description?: string;
  badge?: string;
  isFeatured?: boolean;
  navPosition?: "left" | "right";
  children: HeaderMenuItemPayload[];
};

export default async function AuthLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await ensureDefaultMenus();
  const settings = await getSettings();
  const headerSettings = normalizeHeaderSettings(settings.header);
  const contentPages = normalizeContentPagesSettings(settings.contentPages);
  const footerSettings = normalizeFooterSettings(settings.footer);

  const resolveHref = (raw: string) => {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) {
      return raw.startsWith(`/${locale}`) ? raw : `/${locale}${raw}`;
    }
    return `/${locale}/${raw}`;
  };
  const controlledAppPagePaths = new Set(
    HEADER_APP_PAGE_OPTIONS.map((page) => page.publicPath),
  );
  const selectedAppPagePaths = new Set(headerSettings.pagesMenu.appPagePaths);
  const getControlledAppPath = (raw: string) => {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return null;

    const path = raw.split(/[?#]/, 1)[0]?.trim();
    if (!path) return null;

    const absolutePath = path.startsWith("/") ? path : `/${path}`;
    const localePath = absolutePath.startsWith(`/${locale}/`)
      ? absolutePath.slice(locale.length + 1)
      : absolutePath === `/${locale}`
        ? "/"
        : absolutePath;
    const normalizedPath =
      localePath.length > 1 ? localePath.replace(/\/+$/, "") : localePath;

    return controlledAppPagePaths.has(normalizedPath) ? normalizedPath : null;
  };

  const [headerMenus, headerMegaMenus] = await Promise.all([
    getMenusByLocation("header"),
    getMenusByLocation("header-mega"),
  ]);

  const isHeaderPageMenuItem = (item: MenuItemPlain) =>
    item.type === "page" || item.type === "blog" || item.type === "blog-post";

  const getVisibleHeaderMenuItems = (items: MenuItemPlain[]): MenuItemPlain[] =>
    items.flatMap((item) => {
      if (!headerSettings.pagesMenu.enabled && isHeaderPageMenuItem(item)) {
        return [];
      }

      const controlledAppPath = getControlledAppPath(item.url);
      if (
        controlledAppPath &&
        !selectedAppPagePaths.has(controlledAppPath)
      ) {
        return [];
      }

      return [
        {
          ...item,
          children: getVisibleHeaderMenuItems(item.children),
        },
      ];
    });

  const mapHeaderMenuItem = (item: MenuItemPlain): HeaderMenuItemPayload => ({
      label: item.label,
      href: resolveHref(item.url),
      target: item.target,
      icon: item.icon || item.image,
      image: item.image,
      description: item.description,
      badge: item.badge,
      isFeatured: item.isFeatured,
      children: item.children.map(mapHeaderMenuItem),
    });

  const headerMenuItems = headerMenus.flatMap((menu) =>
    getVisibleHeaderMenuItems(menu.items).map(mapHeaderMenuItem),
  );
  const appHeaderPageItems = new Map<string, HeaderMenuItemPayload>(
    HEADER_APP_PAGE_OPTIONS.filter((page) =>
      headerSettings.pagesMenu.appPagePaths.includes(page.publicPath),
    ).map((page) => [
      `app:${page.publicPath}`,
      {
        label: page.label,
        href: resolveHref(page.publicPath),
        target: "_self" as const,
        children: [] as HeaderMenuItemPayload[],
      },
    ]),
  );
  const standardHeaderPageItems = new Map<string, HeaderMenuItemPayload>(
    CONTENT_PAGE_KEYS.flatMap((key) => {
      const page = contentPages[key];
      if (!page.visible || !headerSettings.pagesMenu.pageKeys.includes(key)) {
        return [];
      }

      return [
        [
          `standard:${key}`,
          {
            label: page.title || CONTENT_PAGE_META[key].adminTitle,
            href: resolveHref(CONTENT_PAGE_META[key].publicPath),
            target: "_self" as const,
            children: [] as HeaderMenuItemPayload[],
          },
        ] as const,
      ];
    }),
  );
  const customHeaderPageItems = new Map<string, HeaderMenuItemPayload>(
    contentPages.customPages
      .filter(
        (page) =>
          page.visible &&
          page.handle.trim() &&
          headerSettings.pagesMenu.customPageIds.includes(page.id),
      )
      .map((page) => [
        `custom:${page.id}`,
        {
          label: page.title,
          href: resolveHref(`/pages/${page.handle}`),
          target: "_self" as const,
          children: [] as HeaderMenuItemPayload[],
        },
      ]),
  );
  const headerPageItemMap = new Map([
    ...appHeaderPageItems,
    ...standardHeaderPageItems,
    ...customHeaderPageItems,
  ]);
  const selectedHeaderPageKeys = [
    ...headerSettings.pagesMenu.order.filter((key) =>
      headerPageItemMap.has(key),
    ),
    ...Array.from(headerPageItemMap.keys()).filter(
      (key) => !headerSettings.pagesMenu.order.includes(key),
    ),
  ];
  const headerPageItems = headerSettings.pagesMenu.enabled
    ? selectedHeaderPageKeys.flatMap((key) => {
        const item = headerPageItemMap.get(key);
        if (!item) return [];

        return [
          {
            ...item,
            navPosition: headerSettings.pagesMenu.positions[key] || "right",
          },
        ];
      })
    : [];
  const combinedHeaderMenuItems = dedupeHeaderMenuItems([
    ...headerPageItems,
    ...headerMenuItems,
  ]);
  const headerMegaMenuItems = headerMegaMenus.flatMap((menu) =>
    menu.items.map(mapHeaderMenuItem),
  );
  const finalHeaderMenuItems = combinedHeaderMenuItems;

  return (
    <CartProvider>
      <div className="store-surface min-h-screen flex flex-col bg-background">
        <StoreHeader
          locale={locale as Locale}
          menuItems={finalHeaderMenuItems}
          megaMenuItems={headerMegaMenuItems}
          headerSettings={headerSettings}
        />
        <main className="flex min-h-[calc(100svh-4rem)] items-center justify-center p-4 md:min-h-[calc(100svh-7.25rem)]">
          <div className="w-full max-w-5xl [&>*:not(.auth-wide)]:mx-auto [&>*:not(.auth-wide)]:max-w-md">
            {children}
          </div>
        </main>
        <StoreFooter
          locale={locale as Locale}
          footerSettings={footerSettings}
        />
      </div>
    </CartProvider>
  );
}

function dedupeHeaderMenuItems(
  items: HeaderMenuItemPayload[],
): HeaderMenuItemPayload[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.href.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
