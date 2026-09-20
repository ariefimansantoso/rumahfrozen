"use client";

import { useState } from "react";
import {
  Armchair,
  ArrowRight,
  ChevronDown,
  Footprints,
  Gem,
  Home,
  Layers,
  Menu,
  Monitor,
  Package,
  Rss,
  Search,
  Shirt,
  ShoppingBag,
  Smartphone,
  Tablet,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  MAX_MEGA_MENU_LEVEL_2_ITEMS,
  MAX_MEGA_MENU_ROOT_ITEMS,
} from "@/lib/menu-depth";
import {
  findFirstPreviewFeature,
  flattenVisiblePreviewItems,
  getPreviewItemKey,
  getPreviewPromoImage,
  getVisiblePreviewChildren,
  type MenuItem,
  type MenuLocation,
  type MenuStats,
} from "@/components/admin/menus/menu-form/helpers";

export function PreviewFallbackIcon({
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

export function PreviewItemVisual({
  item,
  className,
}: {
  item: MenuItem;
  className?: string;
}) {
  const imageSrc = item.icon || item.image;

  if (!imageSrc) {
    return (
      <PreviewFallbackIcon
        label={item.label}
        className={cn("h-4 w-4", className)}
      />
    );
  }

  return (
    <img
      src={imageSrc}
      alt=""
      className={cn("h-5 w-5 object-contain", className)}
    />
  );
}

export function MegaMenuLivePreview({
  items,
  location,
}: {
  items: MenuItem[];
  location: MenuLocation;
}) {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [activeRootKey, setActiveRootKey] = useState<string | null>(
    getPreviewItemKey(items[0]),
  );
  const [activeChildKey, setActiveChildKey] = useState<string | null>(
    getPreviewItemKey(getVisiblePreviewChildren(items[0])[0]),
  );
  const [activeFeatureKey, setActiveFeatureKey] = useState<string | null>(
    getPreviewItemKey(findFirstPreviewFeature(getVisiblePreviewChildren(items[0]))),
  );
  const rootItems = items.filter((item) => item.label.trim());
  const visibleRoots = rootItems.slice(0, MAX_MEGA_MENU_ROOT_ITEMS);
  const activeRoot =
    visibleRoots.find((item) => getPreviewItemKey(item) === activeRootKey) ||
    visibleRoots[0];
  const rootChildren = getVisiblePreviewChildren(activeRoot).slice(
    0,
    MAX_MEGA_MENU_LEVEL_2_ITEMS,
  );
  const rootHasNested = rootChildren.some(
    (item) => getVisiblePreviewChildren(item).length > 0,
  );
  const activeChild =
    rootChildren.find((item) => getPreviewItemKey(item) === activeChildKey) ||
    rootChildren[0];
  const activeChildChildren = getVisiblePreviewChildren(activeChild);
  const sourceItems = rootHasNested
    ? activeChildChildren.length > 0
      ? activeChildChildren
      : activeChild
        ? [activeChild]
        : rootChildren
    : rootChildren.slice(0, MAX_MEGA_MENU_LEVEL_2_ITEMS);
  const promoItem =
    activeRoot?.isFeatured && getPreviewPromoImage(activeRoot)
      ? activeRoot
      : undefined;
  const activeFeatureItem =
    flattenVisiblePreviewItems(sourceItems).find(
      (item) => getPreviewItemKey(item) === activeFeatureKey,
    ) ||
    findFirstPreviewFeature(sourceItems) ||
    activeChild ||
    activeRoot;

  const setActiveRoot = (item: MenuItem) => {
    const nextRootChildren = getVisiblePreviewChildren(item).slice(
      0,
      MAX_MEGA_MENU_LEVEL_2_ITEMS,
    );
    const nextActiveChild = nextRootChildren[0];
    const nextSource = nextActiveChild
      ? getVisiblePreviewChildren(nextActiveChild)
      : nextRootChildren;

    setActiveRootKey(getPreviewItemKey(item));
    setActiveChildKey(getPreviewItemKey(nextActiveChild));
    setActiveFeatureKey(getPreviewItemKey(findFirstPreviewFeature(nextSource)));
  };

  const setActiveChild = (item: MenuItem) => {
    const nextSource = getVisiblePreviewChildren(item);
    setActiveChildKey(getPreviewItemKey(item));
    setActiveFeatureKey(getPreviewItemKey(findFirstPreviewFeature(nextSource)));
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Add items or stage a category sync to preview the mega menu.
      </div>
    );
  }

  return (
    <Tabs value={viewport} onValueChange={(value) => setViewport(value as typeof viewport)}>
      <div className="mb-3 flex justify-end">
        <TabsList className="h-9">
          <TabsTrigger value="desktop" className="h-8 gap-1">
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </TabsTrigger>
          <TabsTrigger value="tablet" className="h-8 gap-1">
            <Tablet className="h-3.5 w-3.5" />
            Tablet
          </TabsTrigger>
          <TabsTrigger value="mobile" className="h-8 gap-1">
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="desktop" className="mt-0">
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          {activeRoot ? (
            <StorefrontMegaMenuFrame
              location={location}
              viewport="desktop"
              roots={rootItems}
              activeRoot={activeRoot}
              activeChild={activeChild}
              rootChildren={rootChildren}
              rootHasNested={rootHasNested}
              sourceItems={sourceItems}
              promoItem={promoItem}
              activeFeatureItem={activeFeatureItem}
              onRootEnter={setActiveRoot}
              onChildEnter={setActiveChild}
              onFeatureEnter={(item) => setActiveFeatureKey(getPreviewItemKey(item))}
            />
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="tablet" className="mt-0">
        <div className="overflow-hidden rounded-2xl border bg-muted/10 p-4">
          <div className="mx-auto w-[768px] max-w-full overflow-hidden rounded-2xl border bg-background shadow-sm">
            {activeRoot ? (
              <StorefrontMegaMenuFrame
                location={location}
                viewport="tablet"
                roots={rootItems}
                activeRoot={activeRoot}
                activeChild={activeChild}
                rootChildren={rootChildren}
                rootHasNested={rootHasNested}
                sourceItems={sourceItems}
                promoItem={promoItem}
                activeFeatureItem={activeFeatureItem}
                onRootEnter={setActiveRoot}
                onChildEnter={setActiveChild}
                onFeatureEnter={(item) =>
                  setActiveFeatureKey(getPreviewItemKey(item))
                }
              />
            ) : null}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="mobile" className="mt-0">
        <MobileStorefrontMenuPreview items={visibleRoots} />
      </TabsContent>
    </Tabs>
  );
}

export function StorefrontMegaMenuFrame({
  location,
  viewport,
  roots,
  activeRoot,
  activeChild,
  rootChildren,
  rootHasNested,
  sourceItems,
  promoItem,
  activeFeatureItem,
  onRootEnter,
  onChildEnter,
  onFeatureEnter,
}: {
  location: MenuLocation;
  viewport: "desktop" | "tablet";
  roots: MenuItem[];
  activeRoot: MenuItem;
  activeChild?: MenuItem;
  rootChildren: MenuItem[];
  rootHasNested: boolean;
  sourceItems: MenuItem[];
  promoItem?: MenuItem;
  activeFeatureItem?: MenuItem;
  onRootEnter: (item: MenuItem) => void;
  onChildEnter: (item: MenuItem) => void;
  onFeatureEnter: (item: MenuItem) => void;
}) {
  const isTablet = viewport === "tablet";

  return (
    <>
      <div
        className={cn(
          "flex items-center border-b py-3",
          isTablet ? "min-w-0 gap-3 px-3" : "min-w-[760px] gap-6 px-5",
        )}
      >
        <button
          type="button"
          className={cn(
            "flex h-10 items-center justify-between rounded-full border border-transparent bg-muted/60 px-4 text-sm font-medium hover:bg-muted/80",
            isTablet ? "w-44 shrink-0" : "w-55",
            location !== "header-mega" && "opacity-80",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Categories
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        <div
          className={cn(
            "flex min-w-0 items-center overflow-hidden text-sm",
            isTablet ? "gap-3" : "gap-5",
          )}
        >
          <span className="truncate font-medium text-foreground">Home</span>
          <span className="truncate text-foreground/80">Products</span>
          <span className="truncate text-foreground/80">Collections</span>
          <span className="truncate text-foreground/80">Blog</span>
        </div>
      </div>
      <div className={cn(isTablet ? "overflow-hidden" : "overflow-x-auto")}>
        <PreviewMegaPanel
          viewport={viewport}
          roots={roots}
          activeRoot={activeRoot}
          activeChild={activeChild}
          rootChildren={rootChildren}
          rootHasNested={rootHasNested}
          sourceItems={sourceItems}
          promoItem={promoItem}
          activeFeatureItem={activeFeatureItem}
          onRootEnter={onRootEnter}
          onChildEnter={onChildEnter}
          onFeatureEnter={onFeatureEnter}
        />
      </div>
    </>
  );
}

export function PreviewMegaPanel({
  viewport,
  roots,
  activeRoot,
  activeChild,
  rootChildren,
  rootHasNested,
  sourceItems,
  promoItem,
  activeFeatureItem,
  onRootEnter,
  onChildEnter,
  onFeatureEnter,
}: {
  viewport: "desktop" | "tablet";
  roots: MenuItem[];
  activeRoot: MenuItem;
  activeChild?: MenuItem;
  rootChildren: MenuItem[];
  rootHasNested: boolean;
  sourceItems: MenuItem[];
  promoItem?: MenuItem;
  activeFeatureItem?: MenuItem;
  onRootEnter: (item: MenuItem) => void;
  onChildEnter: (item: MenuItem) => void;
  onFeatureEnter: (item: MenuItem) => void;
}) {
  const promoImage = getPreviewPromoImage(promoItem);
  const sideItem = promoImage ? promoItem : undefined;
  const sideImage = promoImage;
  const isTablet = viewport === "tablet";
  const hasSidePanel = Boolean(sideItem && sideImage) && !isTablet;
  const visibleRoots = roots.slice(0, MAX_MEGA_MENU_ROOT_ITEMS);
  const visibleRootChildren = rootChildren.slice(0, MAX_MEGA_MENU_LEVEL_2_ITEMS);
  const visibleSourceItems = sourceItems.slice(
    0,
    rootHasNested ? sourceItems.length : MAX_MEGA_MENU_LEVEL_2_ITEMS,
  );
  const gridClass = rootHasNested
    ? isTablet
      ? "grid-cols-[180px_150px_minmax(0,1fr)]"
      : hasSidePanel
        ? "grid-cols-[minmax(220px,0.9fr)_minmax(180px,0.7fr)_minmax(300px,1.5fr)_minmax(240px,0.9fr)] xl:grid-cols-[260px_200px_minmax(360px,1fr)_280px] 2xl:grid-cols-[300px_220px_minmax(420px,1fr)_300px]"
        : "grid-cols-[minmax(220px,0.9fr)_minmax(180px,0.7fr)_minmax(360px,1.6fr)] xl:grid-cols-[260px_200px_minmax(420px,1fr)] 2xl:grid-cols-[300px_220px_minmax(520px,1fr)]"
    : hasSidePanel
      ? "grid-cols-[minmax(220px,0.85fr)_minmax(420px,1.7fr)_minmax(240px,0.9fr)] xl:grid-cols-[260px_minmax(520px,1fr)_280px] 2xl:grid-cols-[300px_minmax(620px,1fr)_300px]"
      : isTablet
        ? "grid-cols-[180px_minmax(0,1fr)]"
        : "grid-cols-[minmax(220px,0.85fr)_minmax(520px,1.8fr)] xl:grid-cols-[260px_minmax(620px,1fr)] 2xl:grid-cols-[300px_minmax(740px,1fr)]";

  return (
    <div
      className={cn(
        "grid min-w-0 bg-popover",
        isTablet ? "h-[380px] min-w-0" : "h-[380px] min-w-[860px]",
        gridClass,
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-col border-r bg-muted/15",
          isTablet ? "p-3" : "px-4 py-4",
        )}
      >
        <div
          className={cn(
            "min-h-0 overflow-hidden pr-1",
            isTablet ? "space-y-1.5" : "space-y-1.5",
          )}
        >
          {visibleRoots.map((item) => {
            const isActive =
              getPreviewItemKey(item) === getPreviewItemKey(activeRoot);
            const hasChildren = getVisiblePreviewChildren(item).length > 0;

            return (
              <button
                key={getPreviewItemKey(item)}
                type="button"
                onMouseEnter={() => onRootEnter(item)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-full px-3.5 text-left text-[13px] transition-colors",
                  isTablet && "h-10 gap-2 px-3",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/80 hover:bg-background/70 hover:text-foreground",
                )}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center text-foreground/70">
                  <PreviewItemVisual item={item} />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {hasChildren ? (
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                ) : null}
              </button>
            );
          })}
        </div>
        {roots.length > visibleRoots.length ? (
          <div className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-primary">
            View All
            <ArrowRight className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      {rootHasNested ? (
        <div
          className={cn(
            "min-h-0 overflow-hidden border-r bg-popover",
            isTablet ? "p-3" : "p-5",
          )}
        >
          <div className="space-y-1 pr-1">
            {visibleRootChildren.map((item) => {
              const isActive =
                getPreviewItemKey(item) === getPreviewItemKey(activeChild);
              const hasChildren = getVisiblePreviewChildren(item).length > 0;

              return (
                <button
                  key={getPreviewItemKey(item)}
                  type="button"
                  onMouseEnter={() => onChildEnter(item)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-full px-4 text-left text-[13px] transition-colors",
                    isTablet && "px-3",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-foreground/80 hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {hasChildren ? (
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-w-0 overflow-hidden bg-popover",
          isTablet ? "px-4 py-5" : "px-6 py-7 xl:px-8",
        )}
      >
        {visibleSourceItems.length > 0 ? (
          <div
            className={cn(
              "grid min-w-0 items-start gap-y-3",
              isTablet
                ? "grid-cols-1 gap-x-4"
                : "grid-cols-2 gap-x-6 xl:grid-cols-3",
            )}
          >
            {visibleSourceItems.map((item) => {
              const children = getVisiblePreviewChildren(item);

              if (children.length > 0) {
                return (
                  <div key={getPreviewItemKey(item)} className="min-w-0 space-y-2">
                    <button
                      type="button"
                      onMouseEnter={() => onFeatureEnter(item)}
                      className="flex min-w-0 max-w-full items-center gap-2 text-left text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      <PreviewItemVisual item={item} className="h-4 w-4" />
                      <span className="min-w-0 truncate">
                        {item.columnTitle || item.label}
                      </span>
                    </button>
                    <div className="space-y-1.5">
                      {children.map((child) => (
                        <PreviewMegaLeaf
                          key={getPreviewItemKey(child)}
                          item={child}
                          active={
                            getPreviewItemKey(child) ===
                            getPreviewItemKey(activeFeatureItem)
                          }
                          onMouseEnter={() => onFeatureEnter(child)}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <PreviewMegaLeaf
                  key={getPreviewItemKey(item)}
                  item={item}
                  active={
                    getPreviewItemKey(item) ===
                    getPreviewItemKey(activeFeatureItem)
                  }
                  onMouseEnter={() => onFeatureEnter(item)}
                />
              );
            })}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground/80">
            <PreviewItemVisual item={activeRoot} />
            {activeRoot.label}
          </div>
        )}
      </div>

      {hasSidePanel && sideItem ? (
        <div className="flex items-center bg-popover px-5 py-6">
          <div className="group relative block h-[310px] max-h-full w-full overflow-hidden rounded-[22px] border shadow-sm">
            <img
              src={sideImage}
              alt=""
              className="h-full w-full object-fill transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PreviewMegaLeaf({
  item,
  active = false,
  onMouseEnter,
}: {
  item: MenuItem;
  active?: boolean;
  onMouseEnter?: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      className={cn(
        "inline-flex max-w-full self-start justify-self-start rounded-full px-4 py-2 text-left text-[13px] transition-colors hover:bg-muted/60 hover:text-foreground",
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
    </button>
  );
}

export function MobileStorefrontMenuPreview({ items }: { items: MenuItem[] }) {
  return (
    <div className="overflow-auto rounded-2xl border bg-muted/10 p-4">
      <div className="mx-auto flex min-h-[640px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-[28px] border bg-background shadow-xl">
        <div className="px-5 pb-4 pt-7">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="h-10 rounded-full">
              Sign in
            </Button>
            <Button type="button" variant="outline" className="h-10 rounded-full">
              Register
            </Button>
          </div>
        </div>

        <div className="px-5 pb-4 pt-1">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              readOnly
              placeholder="Search products..."
              className="h-11 rounded-full border border-[#dddddd] bg-transparent pl-10 pr-4 shadow-none placeholder:opacity-70 focus-visible:ring-0"
            />
          </div>
        </div>

        <Separator />

        <nav className="grid gap-1 px-3 py-4 text-sm font-medium">
          <div className="flex h-11 items-center gap-3 rounded-lg px-3">
            <Home className="h-4 w-4 text-muted-foreground" />
            Home
          </div>
          <div className="flex h-11 items-center gap-3 rounded-lg px-3">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            Products
          </div>
          <div className="flex h-11 items-center gap-3 rounded-lg px-3">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Collections
          </div>
          <div className="flex h-11 items-center gap-3 rounded-lg px-3">
            <Rss className="h-4 w-4 text-muted-foreground" />
            Blog
          </div>
        </nav>

        <Separator />

        <section className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Categories</h3>
            {items.length > 8 ? (
              <span className="text-xs font-medium text-primary">View All</span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {items.slice(0, 8).map((item) => (
              <div
                key={getPreviewItemKey(item)}
                className="flex min-w-0 items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted/60">
                  <PreviewItemVisual item={item} className="h-4 w-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function MegaLayoutMap({
  stats,
  activeDepth,
  activeIsFeatured,
}: {
  stats: MenuStats;
  activeDepth: number;
  activeIsFeatured: boolean;
}) {
  const items = [
    {
      key: "trigger",
      label: "Top level",
      value: "Trigger",
      count: stats.topLevel,
      active: !activeIsFeatured && activeDepth === 1,
    },
    {
      key: "group",
      label: "Level 2",
      value: "Columns / groups",
      count: null,
      active: !activeIsFeatured && activeDepth === 2,
    },
    {
      key: "link",
      label: "Level 3",
      value: "Links",
      count: null,
      active: !activeIsFeatured && activeDepth >= 3,
    },
    {
      key: "promo",
      label: "Featured image",
      value: "Right promo panel",
      count: stats.promoCount,
      active: activeIsFeatured,
    },
  ];

  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "min-w-0 rounded-md border px-3 py-2 transition-colors",
            item.active
              ? "border-primary bg-primary/5"
              : "border-transparent bg-background",
          )}
        >
          <p className="truncate text-xs text-muted-foreground">{item.label}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{item.value}</p>
            {typeof item.count === "number" ? (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {item.count}
              </Badge>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
