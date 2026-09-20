"use client";

import Link from "next/link";
import {
  Armchair,
  ArrowRight,
  ChevronDown,
  Footprints,
  Gem,
  Package,
  Shirt,
  Smartphone,
  UtensilsCrossed,
} from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MAX_MEGA_MENU_LEVEL_2_ITEMS,
  MAX_MEGA_MENU_LEVEL_3_ITEMS,
} from "@/lib/menu-depth";
import type { HeaderMenuItem } from "@/components/layout/store-header";

// The L3 leaf grid renders in two columns (see `grid-cols-2` below), so cap
// each column at MAX_MEGA_MENU_LEVEL_3_ITEMS to keep rows from overflowing the
// fixed-height panel.
const MEGA_MENU_LEVEL_3_COLUMNS = 2;

export function getHeaderMenuItemKey(item?: HeaderMenuItem) {
  if (!item) return null;
  return `${item.href}::${item.label}`;
}

export function getVisibleMegaChildren(item?: HeaderMenuItem) {
  return (item?.children || []).filter((child) => child.label.trim());
}

export function getMegaItemImage(item?: HeaderMenuItem) {
  return item?.image || item?.icon || "";
}

export function getMegaItemPromoImage(item?: HeaderMenuItem) {
  const image = item?.image?.trim() || "";
  const icon = item?.icon?.trim() || "";
  return image && image !== icon ? image : "";
}

export function flattenVisibleMegaItems(items: HeaderMenuItem[]): HeaderMenuItem[] {
  return items.flatMap((item) => {
    const children = getVisibleMegaChildren(item);
    return [item, ...flattenVisibleMegaItems(children)];
  });
}

export function findFirstMegaFeature(items: HeaderMenuItem[]) {
  const visibleItems = flattenVisibleMegaItems(items);
  return (
    visibleItems.find((item) => getMegaItemImage(item)) ||
    visibleItems[0]
  );
}

export function MegaMenuFallbackIcon({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const normalized = label.toLowerCase();

  if (/(electronic|phone|mobile|gadget)/.test(normalized)) {
    return <Smartphone className={className} />;
  }
  if (/(fashion|clothing|apparel)/.test(normalized)) {
    return <Shirt className={className} />;
  }
  if (/(furniture|home)/.test(normalized)) {
    return <Armchair className={className} />;
  }
  if (/(shoe|footwear)/.test(normalized)) {
    return <Footprints className={className} />;
  }
  if (/(jewel|accessor)/.test(normalized)) {
    return <Gem className={className} />;
  }
  if (/(food|grocery)/.test(normalized)) {
    return <UtensilsCrossed className={className} />;
  }

  return <Package className={className} />;
}

export function MegaMenuItemVisual({
  item,
  className,
}: {
  item: HeaderMenuItem;
  className?: string;
}) {
  const imageSrc = item.icon || item.image;
  const fallback = (
    <MegaMenuFallbackIcon
      label={item.label}
      className={cn("h-4 w-4", className)}
    />
  );

  if (!imageSrc) return fallback;

  return (
    <AppImage
      src={imageSrc}
      alt={item.label}
      width={20}
      height={20}
      className={cn("h-5 w-5 object-contain", className)}
      fallback={fallback}
    />
  );
}

export function CustomMegaMenuPanel({
  roots,
  activeRoot,
  activeChild,
  rootChildren,
  rootHasNested,
  sourceItems,
  promoItem,
  activeFeatureItem,
  rootLimit,
  hasMoreRoots,
  viewAllHref,
  onRootEnter,
  onChildEnter,
  onFeatureEnter,
  onNavigate,
}: {
  roots: HeaderMenuItem[];
  activeRoot: HeaderMenuItem;
  activeChild?: HeaderMenuItem;
  rootChildren: HeaderMenuItem[];
  rootHasNested: boolean;
  sourceItems: HeaderMenuItem[];
  promoItem?: HeaderMenuItem;
  activeFeatureItem?: HeaderMenuItem;
  rootLimit: number;
  hasMoreRoots: boolean;
  viewAllHref: string;
  onRootEnter: (item: HeaderMenuItem) => void;
  onChildEnter: (item: HeaderMenuItem) => void;
  onFeatureEnter: (item: HeaderMenuItem) => void;
  onNavigate: () => void;
}) {
  // Promo panel = the active root's own image, shown only when the root opts in
  // via the "Right promo panel" toggle. No auto-fallback to descendant images,
  // so the panel disappears (and the grid collapses) when the active root has
  // no promo configured.
  const promoImage = getMegaItemPromoImage(promoItem);
  const sideItem = promoImage ? promoItem : undefined;
  const sideImage = promoImage;
  const hasSidePanel = Boolean(sideItem && sideImage);
  const visibleRoots = roots.slice(0, rootLimit);
  const visibleRootChildren = rootChildren.slice(0, MAX_MEGA_MENU_LEVEL_2_ITEMS);
  const visibleSourceItems = sourceItems.slice(
    0,
    rootHasNested
      ? MAX_MEGA_MENU_LEVEL_3_ITEMS * MEGA_MENU_LEVEL_3_COLUMNS
      : MAX_MEGA_MENU_LEVEL_2_ITEMS,
  );
  const gridClass = rootHasNested
    ? hasSidePanel
      ? "grid-cols-[minmax(220px,0.9fr)_minmax(180px,0.7fr)_minmax(300px,1.5fr)_minmax(240px,0.9fr)] xl:grid-cols-[260px_200px_minmax(360px,1fr)_280px] 2xl:grid-cols-[300px_220px_minmax(420px,1fr)_300px]"
      : "grid-cols-[minmax(220px,0.9fr)_minmax(180px,0.7fr)_minmax(360px,1.6fr)] xl:grid-cols-[260px_200px_minmax(420px,1fr)] 2xl:grid-cols-[300px_220px_minmax(520px,1fr)]"
    : hasSidePanel
      ? "grid-cols-[minmax(220px,0.85fr)_minmax(420px,1.7fr)_minmax(240px,0.9fr)] xl:grid-cols-[260px_minmax(520px,1fr)_280px] 2xl:grid-cols-[300px_minmax(620px,1fr)_300px]"
      : "grid-cols-[minmax(220px,0.85fr)_minmax(520px,1.8fr)] xl:grid-cols-[260px_minmax(620px,1fr)] 2xl:grid-cols-[300px_minmax(740px,1fr)]";

  return (
    <div className={cn("grid h-[380px] min-w-0 bg-popover", gridClass)}>
      <div className="flex min-h-0 flex-col border-r bg-muted/15 px-4 py-4">
        <div className="min-h-0 space-y-1.5 overflow-hidden pr-1">
          {visibleRoots.map((item) => {
            const isActive =
              getHeaderMenuItemKey(item) === getHeaderMenuItemKey(activeRoot);
            const hasChildren = getVisibleMegaChildren(item).length > 0;

            return (
              <Link
                key={getHeaderMenuItemKey(item)}
                href={item.href}
                target={item.target}
                rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                onMouseEnter={() => onRootEnter(item)}
                onClick={onNavigate}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-full px-3.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/80 hover:bg-background/70 hover:text-foreground",
                )}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center text-foreground/70">
                  <MegaMenuItemVisual item={item} />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {hasChildren ? (
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                ) : null}
              </Link>
            );
          })}
        </div>
        {hasMoreRoots ? (
          <Link
            href={viewAllHref}
            onClick={onNavigate}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      {rootHasNested ? (
        <div className="min-h-0 overflow-hidden border-r bg-popover p-5">
          <div className="space-y-1 pr-1">
            {visibleRootChildren.map((item) => {
              const isActive =
                getHeaderMenuItemKey(item) === getHeaderMenuItemKey(activeChild);
              const hasChildren = getVisibleMegaChildren(item).length > 0;

              return (
                <Link
                  key={getHeaderMenuItemKey(item)}
                  href={item.href}
                  target={item.target}
                  rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                  onMouseEnter={() => onChildEnter(item)}
                  onClick={onNavigate}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full px-4 text-[13px] transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-foreground/80 hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {hasChildren ? (
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-w-0 overflow-hidden bg-popover px-6 py-7 xl:px-8">
        {visibleSourceItems.length > 0 ? (
          <div className="grid min-w-0 grid-cols-2 items-start gap-x-6 gap-y-3">
            {visibleSourceItems.map((item) => {
              const children = getVisibleMegaChildren(item);

              if (children.length > 0) {
                return (
                  <div key={getHeaderMenuItemKey(item)} className="min-w-0 space-y-2">
                    <Link
                      href={item.href}
                      target={item.target}
                      rel={
                        item.target === "_blank" ? "noopener noreferrer" : undefined
                      }
                      onMouseEnter={() => onFeatureEnter(item)}
                      onClick={onNavigate}
                      className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      <MegaMenuItemVisual item={item} className="h-4 w-4" />
                      <span className="min-w-0 truncate">
                        {item.columnTitle || item.label}
                      </span>
                    </Link>
                    <div className="space-y-1.5">
                      {children.map((child) => (
                        <MegaMenuLeafLink
                          key={getHeaderMenuItemKey(child)}
                          item={child}
                          active={
                            getHeaderMenuItemKey(child) ===
                            getHeaderMenuItemKey(activeFeatureItem)
                          }
                          onMouseEnter={() => onFeatureEnter(child)}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <MegaMenuLeafLink
                  key={getHeaderMenuItemKey(item)}
                  item={item}
                  active={
                    getHeaderMenuItemKey(item) ===
                    getHeaderMenuItemKey(activeFeatureItem)
                  }
                  onMouseEnter={() => onFeatureEnter(item)}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        ) : (
          <Link
            href={activeRoot.href}
            target={activeRoot.target}
            rel={activeRoot.target === "_blank" ? "noopener noreferrer" : undefined}
            onClick={onNavigate}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            <MegaMenuItemVisual item={activeRoot} />
            {activeRoot.label}
          </Link>
        )}
      </div>

      {hasSidePanel && sideItem ? (
        <div className="flex items-center bg-popover px-5 py-6">
          <Link
            href={sideItem.href}
            target={sideItem.target}
            rel={sideItem.target === "_blank" ? "noopener noreferrer" : undefined}
            onClick={onNavigate}
            className="group relative block h-[310px] max-h-full w-full overflow-hidden rounded-[22px] border shadow-sm"
          >
            <AppImage
              src={sideImage}
              width={400}
              height={520}
              alt={sideItem.label}
              className="h-full w-full object-fill transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function MegaMenuLeafLink({
  item,
  active = false,
  onMouseEnter,
  onNavigate,
}: {
  item: HeaderMenuItem;
  active?: boolean;
  onMouseEnter?: () => void;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      target={item.target}
      rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
      onMouseEnter={onMouseEnter}
      onClick={onNavigate}
      className={cn(
        "inline-flex max-w-full self-start justify-self-start rounded-full px-4 py-2 text-[13px] transition-colors hover:bg-muted/60 hover:text-foreground",
        active
          ? "font-medium text-primary"
          : item.badge
          ? "text-foreground"
          : "text-foreground/75",
      )}
    >
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );
}
