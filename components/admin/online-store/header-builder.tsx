"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Globe2,
  GripVertical,
  Heart,
  Loader2,
  Menu,
  Monitor,
  Moon,
  Palette,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Smartphone,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast-notification";
import { AppImage } from "@/components/ui/app-image";
import { LANGUAGE_OPTIONS } from "@/components/admin/settings/general/constants";
import {
  getDefaultHeaderSettings,
  normalizeHeaderSettings,
  type HeaderColorScheme,
  type HeaderNavPosition,
  type HeaderSettings,
} from "@/lib/header-config";
import {
  CONTENT_PAGE_KEYS,
  CONTENT_PAGE_META,
  HEADER_APP_PAGE_OPTIONS,
  normalizeContentPagesSettings,
  type ContentPagesSettings,
  type CustomPageData,
} from "@/lib/content-pages-config";
import { cn } from "@/lib/utils";
import { ColorField, FieldRow, SwitchRow } from "@/components/admin/online-store/builder-fields";
import { setNestedValue } from "@/components/admin/online-store/set-nested-value";

interface HeaderBuilderProps {
  locale: string;
}

type SettingsPayload = {
  success?: boolean;
  data?: {
    header?: unknown;
    contentPages?: unknown;
    general?: {
      storeName?: unknown;
      logoUrl?: unknown;
      darkModeLogoUrl?: unknown;
      defaultLanguage?: unknown;
      defaultCurrency?: unknown;
    };
  };
};

type GeneralBrandSettings = {
  storeName: string;
  logoUrl: string;
  darkModeLogoUrl: string;
};

const DESKTOP_QUICK_CATEGORY_FULL_LIMIT = 5;
const DESKTOP_QUICK_CATEGORY_PARTIAL_LIMIT = 7;
const DESKTOP_QUICK_CATEGORY_ONLY_LIMIT = 11;

function getDesktopQuickCategoryLimit(visibleNavGroupCount: number) {
  if (visibleNavGroupCount <= 0) return DESKTOP_QUICK_CATEGORY_ONLY_LIMIT;
  if (visibleNavGroupCount >= 3) return DESKTOP_QUICK_CATEGORY_FULL_LIMIT;
  return DESKTOP_QUICK_CATEGORY_PARTIAL_LIMIT;
}

type HeaderPageOption = {
  id: string;
  label: string;
  href: string;
  kind: "app" | "standard" | "custom";
  description?: string;
  searchText: string;
  visible: boolean;
};

type HeaderPageZone = HeaderNavPosition;

const HEADER_PAGE_DROP_ZONE_IDS: Record<HeaderPageZone, string> = {
  left: "header-pages-left-zone",
  right: "header-pages-right-zone",
};

function normalizeInitialHeader(payload: SettingsPayload): HeaderSettings {
  const header = normalizeHeaderSettings(payload.data?.header);
  const defaultLanguage = payload.data?.general?.defaultLanguage;
  const defaultCurrency = payload.data?.general?.defaultCurrency;

  if (typeof defaultLanguage === "string" && defaultLanguage.trim()) {
    header.market.defaultLanguage = defaultLanguage.trim().toLowerCase();
  }

  if (typeof defaultCurrency === "string" && defaultCurrency.trim()) {
    header.market.defaultCurrency = defaultCurrency.trim().toUpperCase();
  }

  return header;
}

export function HeaderBuilder({ locale }: HeaderBuilderProps) {
  const [header, setHeader] = useState<HeaderSettings>(getDefaultHeaderSettings());
  const [contentPages, setContentPages] = useState<ContentPagesSettings>(
    normalizeContentPagesSettings(undefined),
  );
  const [initialHeader, setInitialHeader] = useState<HeaderSettings>(
    getDefaultHeaderSettings(),
  );
  const [generalBrand, setGeneralBrand] = useState<GeneralBrandSettings>({
    storeName: "",
    logoUrl: "",
    darkModeLogoUrl: "",
  });
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const headerPageDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings", { method: "GET" });
        const payload = (await response.json()) as SettingsPayload;

        if (!response.ok || payload.success !== true) {
          throw new Error("Failed to load settings");
        }

        const parsed = normalizeInitialHeader(payload);
        const general = payload.data?.general;
        setContentPages(normalizeContentPagesSettings(payload.data?.contentPages));
        setGeneralBrand({
          storeName:
            typeof general?.storeName === "string" ? general.storeName.trim() : "",
          logoUrl:
            typeof general?.logoUrl === "string" ? general.logoUrl.trim() : "",
          darkModeLogoUrl:
            typeof general?.darkModeLogoUrl === "string"
              ? general.darkModeLogoUrl.trim()
              : "",
        });
        setHeader(parsed);
        setInitialHeader(parsed);
      } catch {
        toast.error("Failed to load header settings");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(header) !== JSON.stringify(initialHeader),
    [header, initialHeader],
  );

  const updateField = (path: string, value: unknown) => {
    setHeader((prev) => setNestedValue(prev, path, value));
  };

  const pageOptions = useMemo(
    () => buildHeaderPageOptions(contentPages),
    [contentPages],
  );

  const filteredPageOptions = useMemo(() => {
    const query = pageSearchQuery.trim().toLowerCase();

    if (!query) return [];

    return pageOptions
      .filter((page) => page.searchText.includes(query))
      .slice(0, 8);
  }, [pageOptions, pageSearchQuery]);
  const hasPageSearchQuery = pageSearchQuery.trim().length > 0;

  const selectedPageOptions = useMemo(() => {
    const selectedPageMap = new Map(
      pageOptions
        .filter((page) => isHeaderPageSelected(header, page))
        .map((page) => [getHeaderPageKey(page), page]),
    );

    return [
      ...header.pagesMenu.order.flatMap((key) => {
        const page = selectedPageMap.get(key);
        return page ? [page] : [];
      }),
      ...Array.from(selectedPageMap.entries())
        .filter(([key]) => !header.pagesMenu.order.includes(key))
        .map(([, page]) => page),
    ];
  }, [header, pageOptions]);
  const selectedPageKeys = useMemo(
    () => selectedPageOptions.map(getHeaderPageKey),
    [selectedPageOptions],
  );
  const selectedPageGroups = useMemo(() => {
    const groups: Record<HeaderPageZone, HeaderPageOption[]> = {
      left: [],
      right: [],
    };

    selectedPageOptions.forEach((page) => {
      const key = getHeaderPageKey(page);
      const position = header.pagesMenu.positions[key] || "right";
      groups[position].push(page);
    });

    return groups;
  }, [header.pagesMenu.positions, selectedPageOptions]);
  const selectedPageGroupKeys = useMemo(
    () => ({
      left: selectedPageGroups.left.map(getHeaderPageKey),
      right: selectedPageGroups.right.map(getHeaderPageKey),
    }),
    [selectedPageGroups],
  );
  const hasHeaderPageNav =
    header.utilityMenu.enabled &&
    header.pagesMenu.enabled &&
    selectedPageOptions.length > 0;
  const quickCategoryDesktopLimit = getDesktopQuickCategoryLimit(
    [
      header.categoryMenu.enabled,
      header.collectionsMenu.enabled,
      hasHeaderPageNav,
    ].filter(Boolean).length,
  );

  useEffect(() => {
    if (header.categoryMenu.quickLimit <= quickCategoryDesktopLimit) return;

    setHeader((prev) => ({
      ...prev,
      categoryMenu: {
        ...prev.categoryMenu,
        quickLimit: quickCategoryDesktopLimit,
      },
    }));
  }, [header.categoryMenu.quickLimit, quickCategoryDesktopLimit]);

  const addHeaderPage = (
    page: HeaderPageOption,
    position: HeaderNavPosition = "right",
  ) => {
    setHeader((prev) => {
      const collection = getHeaderPageCollection(page);
      const key = getHeaderPageKey(page);
      const current = prev.pagesMenu[collection];

      return {
        ...prev,
        pagesMenu: {
          ...prev.pagesMenu,
          [collection]: Array.from(new Set([...current, page.id])),
          order: prev.pagesMenu.order.includes(key)
            ? prev.pagesMenu.order
            : [...prev.pagesMenu.order, key],
          positions: {
            ...prev.pagesMenu.positions,
            [key]: position,
          },
        },
      };
    });
    setPageSearchQuery("");
  };

  const removeHeaderPage = (page: HeaderPageOption) => {
    setHeader((prev) => {
      const collection = getHeaderPageCollection(page);
      const key = getHeaderPageKey(page);
      const positions = { ...prev.pagesMenu.positions };
      delete positions[key];

      return {
        ...prev,
        pagesMenu: {
          ...prev.pagesMenu,
          [collection]: prev.pagesMenu[collection].filter(
            (item) => item !== page.id,
          ),
          order: prev.pagesMenu.order.filter((item) => item !== key),
          positions,
        },
      };
    });
  };

  const updateHeaderPagePosition = (
    page: HeaderPageOption,
    position: HeaderNavPosition,
  ) => {
    const key = getHeaderPageKey(page);
    setHeader((prev) => ({
      ...prev,
      pagesMenu: {
        ...prev.pagesMenu,
        positions: {
          ...prev.pagesMenu.positions,
          [key]: position,
        },
      },
    }));
  };

  const reorderHeaderPages = (activeKey: string, overId: string) => {
    if (activeKey === overId) return;
    setHeader((prev) => {
      const visibleOrder = [
        ...prev.pagesMenu.order.filter((key) => selectedPageKeys.includes(key)),
        ...selectedPageKeys.filter((key) => !prev.pagesMenu.order.includes(key)),
      ];
      const activeIndex = visibleOrder.indexOf(activeKey);

      if (activeIndex < 0) return prev;

      const dropZone = getHeaderPageDropZonePosition(overId);
      const overPosition =
        dropZone || prev.pagesMenu.positions[overId] || "right";
      const positions = {
        ...prev.pagesMenu.positions,
        [activeKey]: overPosition,
      };
      const visibleWithoutActive = visibleOrder.filter((key) => key !== activeKey);
      const targetZoneKeys = dropZone
        ? visibleWithoutActive.filter(
            (key) => (positions[key] || "right") === dropZone,
          )
        : [];
      const insertAfterKey = dropZone
        ? targetZoneKeys[targetZoneKeys.length - 1]
        : undefined;
      const overIndex = dropZone
        ? insertAfterKey
          ? visibleWithoutActive.indexOf(insertAfterKey) + 1
          : visibleWithoutActive.length
        : visibleWithoutActive.indexOf(overId);

      if (overIndex < 0) return prev;
      const nextVisibleOrder = [
        ...visibleWithoutActive.slice(0, overIndex),
        activeKey,
        ...visibleWithoutActive.slice(overIndex),
      ];

      return {
        ...prev,
        pagesMenu: {
          ...prev.pagesMenu,
          positions,
          order: [
            ...nextVisibleOrder,
            ...prev.pagesMenu.order.filter(
              (key) => !selectedPageKeys.includes(key),
            ),
          ],
        },
      };
    });
  };

  const handleHeaderPageDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    reorderHeaderPages(String(active.id), String(over.id));
  };

  const handleHeaderPageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    reorderHeaderPages(String(active.id), String(over.id));
  };

  const save = async () => {
    try {
      setIsSaving(true);
      const normalized = normalizeHeaderSettings(header);

      const headerResponse = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "header", data: normalized }),
      });
      const headerPayload = (await headerResponse.json()) as SettingsPayload;

      if (!headerResponse.ok || headerPayload.success !== true) {
        throw new Error("Failed to save header settings");
      }

      const saved = normalizeInitialHeader(headerPayload);
      setHeader(saved);
      setInitialHeader(saved);
      toast.success("Header published");
    } catch {
      toast.error("Failed to save header settings");
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => setHeader(initialHeader);

  const restoreDefaults = () => setHeader(getDefaultHeaderSettings());

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title="Header Studio"
        status={
          <Badge variant={isDirty ? "secondary" : "default"}>
            {isDirty ? "Draft changes" : "Published"}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={discardChanges}
              disabled={!isDirty || isSaving}
              size="sm"
            >
              Discard
            </Button>
            <Button
              variant="outline"
              onClick={restoreDefaults}
              disabled={isSaving}
              size="sm"
            >
              <RotateCcw className="h-4 w-4" />
              Defaults
            </Button>
            <Button onClick={save} disabled={isSaving || !isDirty} size="sm">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publish
            </Button>
          </>
        }
      />

      <HeaderPreview header={header} generalBrand={generalBrand} />

      <Tabs defaultValue="brand" className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-md p-1 md:grid-cols-5">
          <TabsTrigger value="brand" className="h-9">
            <Palette className="h-4 w-4" />
            Brand
          </TabsTrigger>
          <TabsTrigger value="navigation" className="h-9">
            <Menu className="h-4 w-4" />
            Navigation
          </TabsTrigger>
          <TabsTrigger value="search" className="h-9">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="market" className="h-9">
            <Settings className="h-4 w-4" />
            Widgets
          </TabsTrigger>
          <TabsTrigger value="mobile" className="h-9">
            <Smartphone className="h-4 w-4" />
            Mobile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Brand and Layout</CardTitle>
              <CardDescription>
                Control the logo width and sticky behavior of the storefront header.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label="Logo alt text">
                <Input
                  value={header.brand.logoAlt}
                  placeholder="Storify"
                  onChange={(event) =>
                    updateField("brand.logoAlt", event.target.value)
                  }
                />
              </FieldRow>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Desktop logo width"
                  value={header.brand.desktopLogoWidth}
                  min={80}
                  max={260}
                  onChange={(value) => updateField("brand.desktopLogoWidth", value)}
                />
                <NumberField
                  label="Mobile logo width"
                  value={header.brand.mobileLogoWidth}
                  min={72}
                  max={180}
                  onChange={(value) => updateField("brand.mobileLogoWidth", value)}
                />
                <SwitchRow
                  label="Full width header"
                  checked={header.layout.fullWidth}
                  onChange={(value) => updateField("layout.fullWidth", value)}
                />
                <SwitchRow
                  label="Sticky header"
                  checked={header.layout.sticky}
                  onChange={(value) => updateField("layout.sticky", value)}
                />
              </div>
              <Separator />
              <ColorSchemeFields
                title="Light mode colors"
                scheme={header.colors.light}
                pathPrefix="colors.light"
                onChange={updateField}
              />
              <ColorSchemeFields
                title="Dark mode colors"
                scheme={header.colors.dark}
                pathPrefix="colors.dark"
                onChange={updateField}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Search</CardTitle>
              <CardDescription>
                Configure the product search surface and AI search shortcut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <SwitchRow
                  label="Show search bar"
                  checked={header.search.enabled}
                  onChange={(value) => updateField("search.enabled", value)}
                />
                <SwitchRow
                  label="Show AI search button"
                  checked={header.search.showAiButton}
                  disabled={!header.search.enabled}
                  onChange={(value) => updateField("search.showAiButton", value)}
                />
              </div>
              <FieldRow label="Search placeholder">
                <Input
                  value={header.search.placeholder}
                  onChange={(event) =>
                    updateField("search.placeholder", event.target.value)
                  }
                  disabled={!header.search.enabled}
                />
              </FieldRow>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Desktop search width"
                  value={header.search.desktopWidth}
                  min={360}
                  max={900}
                  disabled={!header.search.enabled}
                  onChange={(value) => updateField("search.desktopWidth", value)}
                />
                <NumberField
                  label="Search height"
                  value={header.search.height}
                  min={34}
                  max={52}
                  disabled={!header.search.enabled}
                  onChange={(value) => updateField("search.height", value)}
                />
                <NumberField
                  label="Search corner radius"
                  value={header.search.borderRadius}
                  min={0}
                  max={999}
                  disabled={!header.search.enabled}
                  onChange={(value) => updateField("search.borderRadius", value)}
                />
                <ColorField
                  label="Search border color"
                  value={header.search.borderColor}
                  disabled={!header.search.enabled}
                  onChange={(value) => updateField("search.borderColor", value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Search background and text colors are controlled in the light and
                dark color groups above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navigation" className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Category and Collection Menus</CardTitle>
              <CardDescription>
                Choose labels, limits, and promotional content in the header menus.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <SwitchRow
                  label="Show category menu button"
                  checked={header.categoryMenu.enabled}
                  onChange={(value) => updateField("categoryMenu.enabled", value)}
                />
                <SwitchRow
                  label="Show mega menu"
                  checked={header.categoryMenu.showMegaMenu}
                  onChange={(value) =>
                    updateField("categoryMenu.showMegaMenu", value)
                  }
                />
                <SwitchRow
                  label="Show collections menu"
                  checked={header.collectionsMenu.enabled}
                  onChange={(value) => updateField("collectionsMenu.enabled", value)}
                />
                <SwitchRow
                  label="Show quick category"
                  checked={header.categoryMenu.showQuickLinks}
                  onChange={(value) =>
                    updateField("categoryMenu.showQuickLinks", value)
                  }
                />
              </div>
              {!header.categoryMenu.enabled ? (
                <p className="text-xs text-muted-foreground">
                  Mega menu is saved, but it only appears when the category menu
                  is visible.
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <PositionField
                  label="Category menu side"
                  value={header.categoryMenu.position}
                  disabled={!header.categoryMenu.enabled}
                  onChange={(value) => updateField("categoryMenu.position", value)}
                />
                <PositionField
                  label="Collections menu side"
                  value={header.collectionsMenu.position}
                  disabled={!header.collectionsMenu.enabled}
                  onChange={(value) =>
                    updateField("collectionsMenu.position", value)
                  }
                />
                <FieldRow label="Category menu label">
                  <Input
                    value={header.categoryMenu.label}
                    disabled={!header.categoryMenu.enabled}
                    onChange={(event) =>
                      updateField("categoryMenu.label", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label="Collections label">
                  <Input
                    value={header.collectionsMenu.label}
                    disabled={!header.collectionsMenu.enabled}
                    onChange={(event) =>
                      updateField("collectionsMenu.label", event.target.value)
                    }
                  />
                </FieldRow>
                <NumberField
                  label="Quick category max limit"
                  value={header.categoryMenu.quickLimit}
                  min={0}
                  max={quickCategoryDesktopLimit}
                  disabled={!header.categoryMenu.showQuickLinks}
                  onChange={(value) => updateField("categoryMenu.quickLimit", value)}
                />
                <NumberField
                  label="Collections limit"
                  value={header.collectionsMenu.limit}
                  min={0}
                  max={24}
                  disabled={!header.collectionsMenu.enabled}
                  onChange={(value) => updateField("collectionsMenu.limit", value)}
                />
              </div>
              <Separator />
              <SwitchRow
                label="Show category promo card"
                checked={header.categoryMenu.showPromoCard}
                disabled={!header.categoryMenu.enabled}
                onChange={(value) => updateField("categoryMenu.showPromoCard", value)}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FieldRow label="Promo title">
                  <Input
                    value={header.categoryMenu.promoTitle}
                    disabled={
                      !header.categoryMenu.enabled ||
                      !header.categoryMenu.showPromoCard
                    }
                    onChange={(event) =>
                      updateField("categoryMenu.promoTitle", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label="Promo subtitle">
                  <Input
                    value={header.categoryMenu.promoSubtitle}
                    disabled={
                      !header.categoryMenu.enabled ||
                      !header.categoryMenu.showPromoCard
                    }
                    onChange={(event) =>
                      updateField("categoryMenu.promoSubtitle", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label="Promo link">
                  <Input
                    value={header.categoryMenu.promoHref}
                    disabled={
                      !header.categoryMenu.enabled ||
                      !header.categoryMenu.showPromoCard
                    }
                    onChange={(event) =>
                      updateField("categoryMenu.promoHref", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label="Promo image">
                  <Input
                    value={header.categoryMenu.promoImageSrc}
                    disabled={
                      !header.categoryMenu.enabled ||
                      !header.categoryMenu.showPromoCard
                    }
                    onChange={(event) =>
                      updateField("categoryMenu.promoImageSrc", event.target.value)
                    }
                  />
                </FieldRow>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Header Pages</CardTitle>
              <CardDescription>
                Search app pages, policy pages, and custom pages, then add only the links you want in the header.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SwitchRow
                label="Show selected pages"
                checked={header.pagesMenu.enabled}
                onChange={(value) => updateField("pagesMenu.enabled", value)}
              />
              {!header.pagesMenu.enabled && selectedPageOptions.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Selected pages are hidden from the storefront. Use the remove
                  button to take pages like Blog out of the header selection.
                </p>
              ) : null}
              <div
                className={cn(
                  "space-y-3",
                  !header.pagesMenu.enabled && "opacity-55",
                )}
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pageSearchQuery}
                    disabled={!header.pagesMenu.enabled}
                    placeholder="Search pages..."
                    onChange={(event) => setPageSearchQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
                {hasPageSearchQuery ? (
                  <div className="space-y-2 rounded-md border p-2">
                    {filteredPageOptions.length > 0 ? (
                      filteredPageOptions.map((page) => {
                        const isSelected = isHeaderPageSelected(header, page);
                        return (
                          <div
                            key={`${page.kind}-${page.id}`}
                            className={cn(
                              "flex w-full flex-col gap-3 rounded-sm px-2 py-2 text-left transition-colors hover:bg-muted sm:flex-row sm:items-center",
                              isSelected && "opacity-70",
                            )}
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
                              <Plus className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {page.label}
                                </span>
                                {isSelected ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 rounded-md"
                                  >
                                    Added
                                  </Badge>
                                ) : null}
                                {!page.visible ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 rounded-md text-muted-foreground"
                                  >
                                    Hidden
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {page.href}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-wrap items-center gap-2">
                              {isSelected ? null : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!header.pagesMenu.enabled}
                                    onClick={() => addHeaderPage(page, "left")}
                                  >
                                    Add left
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!header.pagesMenu.enabled}
                                    onClick={() => addHeaderPage(page, "right")}
                                  >
                                    Add right
                                  </Button>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        No matching pages available.
                      </p>
                    )}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Assigned links
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Drag to reorder or move links between header sides.
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-md">
                      {selectedPageOptions.length} selected
                    </Badge>
                  </div>
                  {selectedPageOptions.length > 0 ? (
                    <DndContext
                      sensors={headerPageDragSensors}
                      collisionDetection={closestCenter}
                      onDragOver={handleHeaderPageDragOver}
                      onDragEnd={handleHeaderPageDragEnd}
                    >
                      <div className="grid gap-3 lg:grid-cols-2">
                        <HeaderPageDropZone
                          id={HEADER_PAGE_DROP_ZONE_IDS.left}
                          title="Left side"
                          description="Main links beside the logo."
                          count={selectedPageGroups.left.length}
                          disabled={!header.pagesMenu.enabled}
                          emptyMessage="Drop main navigation pages here."
                          pageKeys={selectedPageGroupKeys.left}
                        >
                          {selectedPageGroups.left.map((page) => {
                            const pageKey = getHeaderPageKey(page);

                            return (
                              <SortableHeaderPageRow
                                key={`selected-left-${page.kind}-${page.id}`}
                                id={pageKey}
                                page={page}
                                disabled={!header.pagesMenu.enabled}
                                position="left"
                                onMoveSide={() =>
                                  updateHeaderPagePosition(page, "right")
                                }
                                onRemove={() => removeHeaderPage(page)}
                              />
                            );
                          })}
                        </HeaderPageDropZone>
                        <HeaderPageDropZone
                          id={HEADER_PAGE_DROP_ZONE_IDS.right}
                          title="Right side"
                          description="Utility and action links."
                          count={selectedPageGroups.right.length}
                          disabled={!header.pagesMenu.enabled}
                          emptyMessage="Drop utility or quick-access pages here."
                          pageKeys={selectedPageGroupKeys.right}
                        >
                          {selectedPageGroups.right.map((page) => {
                            const pageKey = getHeaderPageKey(page);

                            return (
                              <SortableHeaderPageRow
                                key={`selected-right-${page.kind}-${page.id}`}
                                id={pageKey}
                                page={page}
                                disabled={!header.pagesMenu.enabled}
                                position="right"
                                onMoveSide={() =>
                                  updateHeaderPagePosition(page, "left")
                                }
                                onRemove={() => removeHeaderPage(page)}
                              />
                            );
                          })}
                        </HeaderPageDropZone>
                      </div>
                    </DndContext>
                  ) : (
                    <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      Search and add a page to either header side.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Menu Structure</CardTitle>
              <CardDescription>
                Use the menu builder for custom links, icons, badges, and layered mega menu items.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Button asChild variant="outline">
                <Link href={`/${locale}/admin/online-store/menus`}>
                  Main and utility menus
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${locale}/admin/online-store/menus/new`}>
                  Create navigation menu
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market" className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Language and Currency</CardTitle>
              <CardDescription>
                Choose whether switchers appear in the header. Store defaults stay in General settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <SwitchRow
                label="Show language selector"
                checked={header.market.showLanguageSelector}
                onChange={(value) =>
                  updateField("market.showLanguageSelector", value)
                }
              />
              <SwitchRow
                label="Show currency selector"
                checked={header.market.showCurrencySelector}
                onChange={(value) =>
                  updateField("market.showCurrencySelector", value)
                }
              />
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Header Widgets</CardTitle>
              <CardDescription>
                Toggle optional controls without touching the storefront code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SwitchRow
                label="Show theme toggle"
                checked={header.widgets.showThemeToggle}
                onChange={(value) => updateField("widgets.showThemeToggle", value)}
              />
              <SwitchRow
                label="Show account menu"
                checked={header.widgets.showAccountMenu}
                onChange={(value) => updateField("widgets.showAccountMenu", value)}
              />
              <SwitchRow
                label="Show wishlist"
                checked={header.widgets.showWishlist}
                onChange={(value) => updateField("widgets.showWishlist", value)}
              />
              <SwitchRow
                label="Show cart"
                checked={header.widgets.showCart}
                onChange={(value) => updateField("widgets.showCart", value)}
              />
              <SwitchRow
                label="Show utility links"
                checked={header.utilityMenu.enabled}
                onChange={(value) => updateField("utilityMenu.enabled", value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mobile" className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Mobile Drawer</CardTitle>
              <CardDescription>
                Tune the mobile header without changing the desktop storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <SwitchRow
                  label="Show mobile search"
                  checked={header.mobile.showSearch}
                  disabled={!header.search.enabled}
                  onChange={(value) => updateField("mobile.showSearch", value)}
                />
                <SwitchRow
                  label="Show account summary"
                  checked={header.mobile.showAccountSummary}
                  disabled={!header.widgets.showAccountMenu}
                  onChange={(value) =>
                    updateField("mobile.showAccountSummary", value)
                  }
                />
                <SwitchRow
                  label="Show category shortcuts"
                  checked={header.mobile.showCategoryShortcuts}
                  disabled={!header.categoryMenu.enabled}
                  onChange={(value) =>
                    updateField("mobile.showCategoryShortcuts", value)
                  }
                />
                <SwitchRow
                  label="Show collections"
                  checked={header.mobile.showCollections}
                  disabled={!header.collectionsMenu.enabled}
                  onChange={(value) =>
                    updateField("mobile.showCollections", value)
                  }
                />
                <SwitchRow
                  label="Show market selectors"
                  checked={header.mobile.showMarketSelectors}
                  disabled={
                    !header.market.showLanguageSelector &&
                    !header.market.showCurrencySelector
                  }
                  onChange={(value) =>
                    updateField("mobile.showMarketSelectors", value)
                  }
                />
                <SwitchRow
                  label="Show theme selector"
                  checked={header.mobile.showThemeSelector}
                  disabled={!header.widgets.showThemeToggle}
                  onChange={(value) =>
                    updateField("mobile.showThemeSelector", value)
                  }
                />
              </div>
              <NumberField
                label="Mobile category limit"
                value={header.categoryMenu.mobileLimit}
                min={0}
                max={16}
                disabled={!header.categoryMenu.enabled}
                onChange={(value) => updateField("categoryMenu.mobileLimit", value)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeaderPageDropZone({
  id,
  title,
  description,
  count,
  disabled,
  emptyMessage,
  pageKeys,
  children,
}: {
  id: string;
  title: string;
  description: string;
  count: number;
  disabled: boolean;
  emptyMessage: string;
  pageKeys: string[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-72 flex-col rounded-md border bg-muted/20 p-3 transition-colors",
        isOver && "border-primary bg-primary/5",
        disabled && "opacity-60",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="rounded-md">
          {count} link{count === 1 ? "" : "s"}
        </Badge>
      </div>
      <SortableContext items={pageKeys} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {count > 0 ? (
            children
          ) : (
            <div className="grid flex-1 place-items-center rounded-md border border-dashed bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableHeaderPageRow({
  id,
  page,
  disabled,
  position,
  onMoveSide,
  onRemove,
}: {
  id: string;
  page: HeaderPageOption;
  disabled: boolean;
  position: HeaderNavPosition;
  onMoveSide: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-background px-3 py-2",
        disabled && "opacity-60",
        isDragging && "relative z-10 opacity-70 shadow-sm",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        {...attributes}
        {...listeners}
        className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Drag ${page.label} to reorder`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{page.label}</p>
          {!page.visible ? (
            <Badge
              variant="outline"
              className="rounded-md text-muted-foreground"
            >
              Hidden
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{page.href}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onMoveSide}
          aria-label={`Move ${page.label} to the ${
            position === "left" ? "right" : "left"
          } side`}
          className="h-8 px-2 text-xs"
        >
          {position === "left" ? "Move right" : "Move left"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Delete ${page.label}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function HeaderPreview({
  header,
  generalBrand,
}: {
  header: HeaderSettings;
  generalBrand: GeneralBrandSettings;
}) {
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const colors = header.colors[previewMode];
  const logoSrc =
    previewMode === "dark" && generalBrand.darkModeLogoUrl
      ? generalBrand.darkModeLogoUrl
      : generalBrand.logoUrl;
  const logoAlt =
    header.brand.logoAlt || generalBrand.storeName || "Header logo";
  const fallbackBrandName = generalBrand.storeName || "Storify";
  const languageLabel =
    LANGUAGE_OPTIONS.find((language) => language.code === header.market.defaultLanguage)
      ?.code.toUpperCase() || header.market.defaultLanguage.toUpperCase();
  const currencyLabel = header.market.defaultCurrency.toUpperCase();
  const previewItems = [
    "Accessories",
    "Bags",
    "Cameras",
    "Clothes",
    "Shoes",
    "Watches",
    "Beauty",
    "Home",
    "Sports",
    "Books",
    "Gaming",
  ];
  const totalPageCount = header.pagesMenu.enabled
    ? header.pagesMenu.appPagePaths.length +
      header.pagesMenu.pageKeys.length +
      header.pagesMenu.customPageIds.length
    : 0;
  const leftPageCount = header.pagesMenu.enabled
    ? Object.values(header.pagesMenu.positions).filter(
        (position) => position === "left",
      ).length
    : 0;
  const rightPageCount = Math.max(0, totalPageCount - leftPageCount);
  const hasPreviewUtilityNav =
    header.utilityMenu.enabled && totalPageCount > 0;
  const desktopQuickCategoryLimit = getDesktopQuickCategoryLimit(
    [
      header.categoryMenu.enabled,
      header.collectionsMenu.enabled,
      hasPreviewUtilityNav,
    ].filter(Boolean).length,
  );
  const quickPreviewItems = header.categoryMenu.showQuickLinks
    ? previewItems.slice(
        0,
        Math.min(header.categoryMenu.quickLimit, desktopQuickCategoryLimit),
      )
    : [];
  const showMarket =
    header.market.showLanguageSelector || header.market.showCurrencySelector;
  const showMobileMarket = showMarket && header.mobile.showMarketSelectors;
  const hasPromoContent = Boolean(
    header.categoryMenu.promoTitle ||
      header.categoryMenu.promoSubtitle ||
      header.categoryMenu.promoImageSrc,
  );
  const categoryMenuPreview = header.categoryMenu.enabled ? (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-black/5 px-3 py-2">
      <Menu className="h-4 w-4" />
      <span>{header.categoryMenu.label || "All Categories"}</span>
      <ChevronDown className="h-3.5 w-3.5" />
    </div>
  ) : null;
  const collectionsMenuPreview = header.collectionsMenu.enabled ? (
    <button type="button" className="shrink-0 font-semibold">
      {header.collectionsMenu.label || "Collections"}
    </button>
  ) : null;
  const quickCategoryPreview = (
    <>
      {quickPreviewItems.map((item) => (
        <span key={item} className="shrink-0 opacity-80">
          {item}
        </span>
      ))}
    </>
  );

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <div className="border-b bg-muted/35 px-5 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">Live Preview</p>
            <p className="text-xs text-muted-foreground">
              Changes below update this preview immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border bg-background p-1">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-sm transition-colors",
                  previewDevice === "desktop"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Preview desktop"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-sm transition-colors",
                  previewDevice === "mobile"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Preview mobile"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
            <div className="inline-flex rounded-md border bg-background p-1">
              <button
                type="button"
                onClick={() => setPreviewMode("light")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-sm transition-colors",
                  previewMode === "light"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Preview light mode"
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("dark")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-sm transition-colors",
                  previewMode === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Preview dark mode"
              >
                <Moon className="h-4 w-4" />
              </button>
            </div>
            <Badge variant="outline">
              {header.layout.fullWidth ? "Full width" : "Contained"}
            </Badge>
          </div>
        </div>
      </div>
      <div className="bg-muted/20 p-4">
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-md border shadow-sm",
            previewDevice === "mobile" ? "max-w-sm" : header.layout.fullWidth ? "w-full" : "max-w-6xl",
          )}
          style={
            {
              "--preview-header-bg": colors.backgroundColor,
              "--preview-header-text": colors.textColor,
              "--preview-search-bg": colors.searchBackgroundColor,
              "--preview-search-text": colors.searchTextColor,
            } as CSSProperties
          }
        >
          <div
            className={cn(
              "border-b px-4 py-3",
              header.layout.sticky && "shadow-[0_2px_10px_rgba(15,23,42,0.06)]",
            )}
            style={{
              backgroundColor: "var(--preview-header-bg)",
              color: "var(--preview-header-text)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex shrink-0 items-center gap-2"
                style={{
                  width:
                    previewDevice === "mobile"
                      ? header.brand.mobileLogoWidth
                      : header.brand.desktopLogoWidth,
                }}
              >
                {logoSrc ? (
                  <AppImage
                    src={logoSrc}
                    alt={logoAlt}
                    width={
                      previewDevice === "mobile"
                        ? header.brand.mobileLogoWidth
                        : header.brand.desktopLogoWidth
                    }
                    height={32}
                    className="h-8 w-full object-contain object-left"
                  />
                ) : (
                  <div className="flex items-center gap-2 font-semibold">
                    <Package className="h-5 w-5" />
                    {fallbackBrandName}
                  </div>
                )}
              </div>

              {header.search.enabled && previewDevice === "desktop" ? (
                <div
                  className="hidden h-10 min-w-0 flex-1 items-center gap-3 rounded-full border px-4 md:flex"
                  style={{
                    flexBasis: header.search.desktopWidth,
                    width: `min(${header.search.desktopWidth}px, 100%)`,
                    maxWidth: header.search.desktopWidth,
                    height: header.search.height,
                    borderRadius: header.search.borderRadius,
                    backgroundColor: "var(--preview-search-bg)",
                    color: "var(--preview-search-text)",
                    borderColor: header.search.borderColor,
                  }}
                >
                  <Search className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate text-sm opacity-75">
                    {header.search.placeholder || "Search products..."}
                  </span>
                  {header.search.showAiButton ? (
                    <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Search className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="ml-auto flex shrink-0 items-center gap-3">
                {header.widgets.showThemeToggle && previewDevice === "desktop" ? (
                  <Moon className="h-5 w-5 opacity-80" />
                ) : null}
                {showMarket && previewDevice === "desktop" ? (
                  <div className="hidden items-center gap-2 text-xs font-medium lg:flex">
                    <Globe2 className="h-4 w-4" />
                    <span>
                      {header.market.showLanguageSelector ? languageLabel : null}
                      {header.market.showLanguageSelector &&
                      header.market.showCurrencySelector
                        ? " / "
                        : null}
                      {header.market.showCurrencySelector ? currencyLabel : null}
                    </span>
                  </div>
                ) : null}
                {header.widgets.showAccountMenu ? (
                  <User className="h-5 w-5 opacity-80" />
                ) : null}
                {header.widgets.showWishlist ? (
                  <Heart className="hidden h-5 w-5 opacity-80 sm:block" />
                ) : null}
                {header.widgets.showCart ? (
                  <ShoppingCart className="h-5 w-5 opacity-80" />
                ) : null}
                {previewDevice === "mobile" ? <Menu className="h-5 w-5" /> : null}
              </div>
            </div>
          </div>

          {previewDevice === "desktop" ? (
            <div
              className="hidden items-center gap-6 overflow-hidden px-4 py-3 text-sm md:flex"
              style={{
                backgroundColor: "var(--preview-header-bg)",
                color: "var(--preview-header-text)",
              }}
            >
              {header.categoryMenu.position === "left"
                ? categoryMenuPreview
                : null}
              {header.categoryMenu.enabled && header.categoryMenu.showMegaMenu ? (
                <Badge variant="outline" className="shrink-0">
                  Mega menu
                </Badge>
              ) : null}
              {header.collectionsMenu.position === "left"
                ? collectionsMenuPreview
                : null}
              {leftPageCount > 0 ? (
                <Badge variant="outline" className="shrink-0">
                  {leftPageCount} page{leftPageCount === 1 ? "" : "s"} left
                </Badge>
              ) : null}
              {quickCategoryPreview}
              {hasPreviewUtilityNav ||
              (header.categoryMenu.enabled &&
                header.categoryMenu.position === "right") ||
              (header.collectionsMenu.enabled &&
                header.collectionsMenu.position === "right") ? (
                <div className="ml-auto flex shrink-0 items-center gap-5">
                  {header.categoryMenu.position === "right"
                    ? categoryMenuPreview
                    : null}
                  {header.collectionsMenu.position === "right"
                    ? collectionsMenuPreview
                    : null}
                  {hasPreviewUtilityNav && rightPageCount > 0 ? (
                    <span className="opacity-80">
                      {rightPageCount} page{rightPageCount === 1 ? "" : "s"} right
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 border-t bg-background p-4 text-sm">
              {header.search.enabled && header.mobile.showSearch ? (
                <div
                  className="flex h-10 items-center gap-2 rounded-full border px-3"
                  style={{
                    backgroundColor: "var(--preview-search-bg)",
                    color: "var(--preview-search-text)",
                    borderColor:
                      "color-mix(in srgb, var(--preview-search-text) 18%, transparent)",
                  }}
                >
                  <Search className="h-4 w-4 opacity-70" />
                  <span className="truncate opacity-75">
                    {header.search.placeholder || "Search products..."}
                  </span>
                </div>
              ) : null}
              {header.widgets.showAccountMenu && header.mobile.showAccountSummary ? (
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Customer account</p>
                    <p className="text-xs text-muted-foreground">Login and orders</p>
                  </div>
                </div>
              ) : null}
              {header.categoryMenu.enabled && header.mobile.showCategoryShortcuts ? (
                <div className="grid grid-cols-2 gap-2">
                  {previewItems
                    .slice(0, Math.min(header.categoryMenu.mobileLimit, 4))
                    .map((item) => (
                      <div key={item} className="rounded-md border px-3 py-2">
                        {item}
                      </div>
                    ))}
                </div>
              ) : null}
              {header.collectionsMenu.enabled && header.mobile.showCollections ? (
                <div className="rounded-md border px-3 py-2 font-medium">
                  {header.collectionsMenu.label || "Collections"}
                </div>
              ) : null}
              {header.categoryMenu.showPromoCard && hasPromoContent ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2">
                  <p className="font-medium">
                    {header.categoryMenu.promoTitle || "Header promo"}
                  </p>
                  {header.categoryMenu.promoSubtitle ? (
                    <p className="text-xs text-muted-foreground">
                      {header.categoryMenu.promoSubtitle}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {(header.mobile.showThemeSelector || showMobileMarket) ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {header.widgets.showThemeToggle &&
                  header.mobile.showThemeSelector ? (
                    <Badge variant="outline">Theme</Badge>
                  ) : null}
                  {showMobileMarket ? (
                    <Badge variant="outline">
                      {header.market.showLanguageSelector ? languageLabel : null}
                      {header.market.showLanguageSelector &&
                      header.market.showCurrencySelector
                        ? " / "
                        : null}
                      {header.market.showCurrencySelector ? currencyLabel : null}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function buildHeaderPageOptions(
  contentPages: ContentPagesSettings,
): HeaderPageOption[] {
  const createSearchText = (...parts: Array<string | undefined>) =>
    parts.filter(Boolean).join(" ").toLowerCase();

  const appPages = HEADER_APP_PAGE_OPTIONS.map((page) => ({
    id: page.publicPath,
    label: page.label,
    href: page.publicPath,
    kind: "app" as const,
    description: page.keywords.join(", "),
    searchText: createSearchText(
      page.label,
      page.publicPath,
      ...page.keywords,
    ),
    visible: true,
  }));

  const standardPages = CONTENT_PAGE_KEYS.map((key) => {
    const page = contentPages[key];
    const meta = CONTENT_PAGE_META[key];
    const label = page.title || meta.adminTitle;

    return {
      id: key,
      label,
      href: meta.publicPath,
      kind: "standard" as const,
      description: meta.description,
      searchText: createSearchText(
        label,
        meta.adminTitle,
        meta.publicPath,
        meta.description,
      ),
      visible: page.visible,
    };
  });

  const customPages = contentPages.customPages
    .filter((page: CustomPageData) => page.handle.trim())
    .map((page: CustomPageData) => ({
      id: page.id,
      label: page.title,
      href: `/pages/${page.handle}`,
      kind: "custom" as const,
      description: page.metaDescription,
      searchText: createSearchText(
        page.title,
        page.handle,
        `/pages/${page.handle}`,
        page.metaTitle,
        page.metaDescription,
      ),
      visible: page.visible,
    }));

  return [...appPages, ...standardPages, ...customPages];
}

function getHeaderPageCollection(
  page: HeaderPageOption,
): "appPagePaths" | "pageKeys" | "customPageIds" {
  if (page.kind === "app") return "appPagePaths";
  if (page.kind === "standard") return "pageKeys";
  return "customPageIds";
}

function getHeaderPageKey(page: HeaderPageOption) {
  return `${page.kind}:${page.id}`;
}

function getHeaderPageDropZonePosition(id: string): HeaderPageZone | null {
  if (id === HEADER_PAGE_DROP_ZONE_IDS.left) return "left";
  if (id === HEADER_PAGE_DROP_ZONE_IDS.right) return "right";
  return null;
}

function isHeaderPageSelected(
  header: HeaderSettings,
  page: HeaderPageOption,
) {
  return header.pagesMenu[getHeaderPageCollection(page)].includes(page.id);
}

function PositionField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: HeaderNavPosition;
  disabled?: boolean;
  onChange: (value: HeaderNavPosition) => void;
}) {
  return (
    <FieldRow label={label}>
      <div
        className={cn(
          "inline-flex w-full rounded-md border bg-background p-1",
          disabled && "opacity-55",
        )}
      >
        <Button
          type="button"
          variant={value === "left" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1"
          disabled={disabled}
          onClick={() => onChange("left")}
        >
          <ArrowLeft className="h-4 w-4" />
          Left
        </Button>
        <Button
          type="button"
          variant={value === "right" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1"
          disabled={disabled}
          onClick={() => onChange("right")}
        >
          Right
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </FieldRow>
  );
}

function ColorSchemeFields({
  title,
  scheme,
  pathPrefix,
  onChange,
}: {
  title: string;
  scheme: HeaderColorScheme;
  pathPrefix: string;
  onChange: (path: string, value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-semibold">{title}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <ColorField
          label="Header background color"
          value={scheme.backgroundColor}
          onChange={(value) => onChange(`${pathPrefix}.backgroundColor`, value)}
        />
        <ColorField
          label="Header text color"
          value={scheme.textColor}
          onChange={(value) => onChange(`${pathPrefix}.textColor`, value)}
        />
        <ColorField
          label="Search background color"
          value={scheme.searchBackgroundColor}
          onChange={(value) =>
            onChange(`${pathPrefix}.searchBackgroundColor`, value)
          }
        />
        <ColorField
          label="Search text color"
          value={scheme.searchTextColor}
          onChange={(value) => onChange(`${pathPrefix}.searchTextColor`, value)}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const clampValue = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) return min;
    return Math.min(max, Math.max(min, Math.floor(nextValue)));
  };
  const normalizedValue = clampValue(value);
  const [draftValue, setDraftValue] = useState(String(normalizedValue));

  useEffect(() => {
    setDraftValue(String(normalizedValue));
  }, [normalizedValue]);

  const commitValue = () => {
    const nextValue = clampValue(Number(draftValue));
    setDraftValue(String(nextValue));
    onChange(nextValue);
  };

  return (
    <FieldRow label={label}>
      <Input
        type="number"
        min={min}
        max={max}
        value={draftValue}
        disabled={disabled}
        onChange={(event) => {
          const nextDraftValue = event.target.value;
          const numericValue = Number(nextDraftValue);

          setDraftValue(nextDraftValue);

          if (nextDraftValue === "" || !Number.isFinite(numericValue)) return;
          if (numericValue < min) return;

          const nextValue = clampValue(numericValue);
          if (numericValue > max) {
            setDraftValue(String(nextValue));
          }
          onChange(nextValue);
        }}
        onBlur={commitValue}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </FieldRow>
  );
}
