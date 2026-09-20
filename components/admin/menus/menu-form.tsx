"use client";

import { useEffect, useMemo, useState } from "react";
import {
  arrayMove,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  FolderTree,
  Layers,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast-notification";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";

import {
  blankItem,
  buildCategorySyncDiff,
  buildItemIndex,
  categoryToMenuItem,
  ensureChildren,
  firstImageItemPath,
  firstItemPath,
  getMegaMenuDepthWarning,
  getMenuStats,
  makeId,
  mergeGeneratedCategoryItem,
  pathToItem,
  remapPathAfterReorder,
  replaceAtPath,
  stripTempIds,
  trimMegaMenuItems,
  type CategoryMenuNode,
  type Props,
  type MenuFormState,
  type MenuItem,
  type PendingCategorySync,
  type StructureMode,
} from "@/components/admin/menus/menu-form/helpers";
import {
  MegaMenuLivePreview,
  MegaLayoutMap,
} from "@/components/admin/menus/menu-form/preview";
import {
  ItemTree,
  MenuItemInspector,
  MenuSettingsPanel,
  MegaMenuSyncPanel,
} from "@/components/admin/menus/menu-form/editor-panels";
import { MAX_MEGA_MENU_DEPTH } from "@/lib/menu-depth";

export function MenuForm({ menuId }: Props) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = typeof params.locale === "string" ? params.locale : "en";
  const basePath = `/${locale}/admin/online-store/menus`;

  const [form, setForm] = useState<MenuFormState>({
    name: "",
    handle: "",
    location: "custom",
    description: "",
    isActive: true,
    items: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!menuId);
  const [isSyncingCategories, setIsSyncingCategories] = useState(false);
  const [activePath, setActivePath] = useState<number[] | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [pendingSync, setPendingSync] = useState<PendingCategorySync | null>(null);
  const [structureMode, setStructureMode] = useState<StructureMode>("tree");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = (key: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!menuId) return;
    (async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/menus/${menuId}`);
        const data = await res.json();
        if (data.success) {
          const m = data.data;
          const items = ensureChildren(m.items || []);
          setForm({
            name: m.name,
            handle: m.handle,
            location: m.location,
            description: m.description || "",
            isActive: m.isActive,
            items,
          });
          setActivePath(firstImageItemPath(items) || firstItemPath(items));
        }
      } catch {
        toast.error("Failed to load menu");
      } finally {
        setIsFetching(false);
      }
    })();
  }, [menuId]);

  const updateAt = (path: number[], updater: (item: MenuItem) => MenuItem) => {
    setForm((prev) => {
      const next = structuredClone(prev) as MenuFormState;
      const target = pathToItem(next.items, path);
      if (target) {
        const updated = updater(target);
        replaceAtPath(next.items, path, updated);
      }
      return next;
    });
  };

  const removeAt = (path: number[]) => {
    setForm((prev) => {
      const next = structuredClone(prev) as MenuFormState;
      const parent = path.length === 1 ? next.items : pathToItem(next.items, path.slice(0, -1))?.children;
      if (parent) parent.splice(path[path.length - 1], 1);
      return next;
    });
  };

  const moveAt = (path: number[], direction: "up" | "down") => {
    setForm((prev) => {
      const next = structuredClone(prev) as MenuFormState;
      const parentPath = path.slice(0, -1);
      const idx = path[path.length - 1];
      const parent =
        parentPath.length === 0
          ? next.items
          : pathToItem(next.items, parentPath)?.children;
      if (!parent) return next;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= parent.length) return next;
      [parent[idx], parent[swap]] = [parent[swap], parent[idx]];
      return next;
    });
  };

  const duplicateAt = (path: number[]) => {
    if (form.location === "header-mega" && path.length > MAX_MEGA_MENU_DEPTH) {
      toast.error("Mega menu supports up to 3 levels only.");
      return;
    }

    const newPath = [...path];
    setForm((prev) => {
      const next = structuredClone(prev) as MenuFormState;
      const parentPath = path.slice(0, -1);
      const idx = path[path.length - 1];
      const parent =
        parentPath.length === 0
          ? next.items
          : pathToItem(next.items, parentPath)?.children;
      if (!parent?.[idx]) return prev;
      const copy = structuredClone(parent[idx]) as MenuItem;
      const refreshIds = (item: MenuItem, isRoot = false): MenuItem => ({
        ...item,
        _id: makeId(),
        label: isRoot ? `${item.label} copy` : item.label,
        children: (item.children || []).map((child) => refreshIds(child)),
      });
      let duplicate = refreshIds(copy, true);
      if (prev.location === "header-mega") {
        const allowedDepth = MAX_MEGA_MENU_DEPTH - parentPath.length;
        const scopedTrimmed = trimMegaMenuItems([duplicate], allowedDepth);
        duplicate = scopedTrimmed.items[0] || duplicate;
        if (scopedTrimmed.trimmedCount > 0) {
          toast.info(
            `Duplicate kept the first ${MAX_MEGA_MENU_DEPTH} mega menu levels only.`,
          );
        }
      }
      parent.splice(idx + 1, 0, duplicate);
      newPath[newPath.length - 1] = idx + 1;
      return next;
    });
    setActivePath(newPath);
  };

  const reorderAt = (parentPath: number[], fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setForm((prev) => {
      const next = structuredClone(prev) as MenuFormState;
      const parent =
        parentPath.length === 0
          ? next.items
          : pathToItem(next.items, parentPath)?.children;
      if (!parent) return prev;
      const reordered = arrayMove(parent, fromIndex, toIndex);
      parent.splice(0, parent.length, ...reordered);
      return next;
    });
    setActivePath((current) =>
      remapPathAfterReorder(current, parentPath, fromIndex, toIndex),
    );
  };

  const addChild = (path: number[] | null) => {
    if (form.location === "header-mega" && path && path.length >= MAX_MEGA_MENU_DEPTH) {
      toast.error("Mega menu supports up to 3 levels only.");
      return;
    }

    const newPath = !path
      ? [form.items.length]
      : [...path, (pathToItem(form.items, path)?.children || []).length];

    setForm((prev) => {
      const next = structuredClone(prev) as MenuFormState;
      if (!path) {
        next.items.push(blankItem());
      } else {
        const parent = pathToItem(next.items, path);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(blankItem());
        }
      }
      return next;
    });
    setActivePath(newPath);
  };

  const syncCategoriesToMegaMenu = async () => {
    setIsSyncingCategories(true);
    try {
      const res = await fetch("/api/categories?status=active");
      const result = await res.json();
      const categories = Array.isArray(result?.data) ? result.data : [];
      const items: MenuItem[] = categories.map((category: CategoryMenuNode) =>
        categoryToMenuItem(category),
      );
      const trimmed = trimMegaMenuItems(items);

      if (items.length === 0) {
        toast.error("No active categories found");
        return;
      }

      const currentByResource = buildItemIndex(form.items);
      const mergedItems = trimmed.items.map((item) =>
        mergeGeneratedCategoryItem(item, currentByResource),
      );

      setPendingSync({
        items: mergedItems,
        diff: buildCategorySyncDiff(form.items, trimmed.items),
        trimmedCount: trimmed.trimmedCount,
      });
      toast.success(
        trimmed.trimmedCount > 0
          ? "Category sync preview is ready with first 3 levels only"
          : "Category sync preview is ready",
      );
    } catch {
      toast.error("Failed to sync categories");
    } finally {
      setIsSyncingCategories(false);
    }
  };

  const applyPendingSync = () => {
    if (!pendingSync) return;
    setForm((prev) => ({
      ...prev,
      location: "header-mega",
      items: pendingSync.items,
    }));
    setActivePath(firstImageItemPath(pendingSync.items) || firstItemPath(pendingSync.items));
    setPendingSync(null);
    toast.success("Category hierarchy applied. Save to publish.");
  };

  const menuStats = useMemo(() => getMenuStats(form.items), [form.items]);
  const isMegaMenu = form.location === "header-mega";
  const depthWarning = useMemo(
    () => (isMegaMenu ? getMegaMenuDepthWarning(form.items) : null),
    [form.items, isMegaMenu],
  );
  const previewItems = useMemo(
    () => (isMegaMenu ? trimMegaMenuItems(form.items).items : form.items),
    [form.items, isMegaMenu],
  );
  const activeItem = useMemo(
    () => (activePath ? pathToItem(form.items, activePath) : null),
    [activePath, form.items],
  );
  const activeDepth = activePath ? activePath.length : 0;

  const selectItem = (path: number[]) => {
    setActivePath(path);
  };

  const onSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Menu name is required");
      return;
    }
    setIsLoading(true);
    try {
      const url = menuId ? `/api/menus/${menuId}` : "/api/menus";
      const method = menuId ? "PUT" : "POST";
      const rawItems = isMegaMenu ? trimMegaMenuItems(form.items) : null;
      const cleanItems = stripTempIds(rawItems ? rawItems.items : form.items);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: cleanItems }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(
          rawItems?.trimmedCount
            ? `Menu saved with first ${MAX_MEGA_MENU_DEPTH} levels only`
            : menuId
              ? "Menu updated"
              : "Menu created",
        );
        router.push(basePath);
      } else {
        const validationDetails =
          result.errors && typeof result.errors === "object"
            ? Object.entries(result.errors as Record<string, string[]>)
                .flatMap(([field, messages]) =>
                  messages.map((message) => `${field}: ${message}`),
                )
                .slice(0, 3)
                .join("; ")
            : "";
        toast.error(
          validationDetails ||
            result.error ||
            result.message ||
            "Failed to save",
        );
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 -mx-2 md:mx-0">
        <AdminFormStickyHeader
          flushWithAdminShell
          title={form.name || (menuId ? "Edit menu" : "Add menu")}
          status={
            <Badge variant={form.isActive ? "default" : "outline"}>
              {form.isActive ? "Active" : "Inactive"}
            </Badge>
          }
          actions={
            <>
              <Button onClick={onSubmit} disabled={isLoading} size="sm">
                {isLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <Card className="flex min-h-0 flex-col gap-2 overflow-hidden xl:h-[calc(100vh-180px)]">
            <Tabs defaultValue="structure" className="flex min-h-0 flex-1 flex-col gap-0">
              <CardHeader className="shrink-0 gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Menu structure</CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <FolderTree className="h-3.5 w-3.5" />
                        {menuStats.total} items
                      </Badge>
                      <Badge variant="outline">{menuStats.maxDepth || 0} levels</Badge>
                      <Badge variant="outline">{menuStats.imageCount} images</Badge>
                      {menuStats.missingUrlCount > 0 ? (
                        <Badge variant="destructive">
                          {menuStats.missingUrlCount} missing URLs
                        </Badge>
                      ) : null}
                      {depthWarning ? (
                        <Badge variant="destructive">
                          {depthWarning.trimmedCount} too deep
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TabsList className="h-9">
                      <TabsTrigger value="structure" className="h-8 gap-1">
                        <FolderTree className="h-3.5 w-3.5" />
                        Structure
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="h-8 gap-1">
                        <Monitor className="h-3.5 w-3.5" />
                        Preview
                      </TabsTrigger>
                    </TabsList>
                    <Button size="sm" variant="outline" onClick={() => addChild(null)}>
                      <Plus className="mr-1 h-4 w-4" /> Add item
                    </Button>
                  </div>
                </div>
                <TabsContent value="structure" className="mt-0">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    {isMegaMenu ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex shrink-0 rounded-md bg-muted p-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={structureMode === "tree" ? "secondary" : "ghost"}
                            className="h-8 gap-1"
                            onClick={() => setStructureMode("tree")}
                          >
                            <FolderTree className="h-3.5 w-3.5" />
                            Tree
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={structureMode === "mega" ? "secondary" : "ghost"}
                            className="h-8 gap-1"
                            onClick={() => setStructureMode("mega")}
                          >
                            <Layers className="h-3.5 w-3.5" />
                            Mega layout
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Mega menus publish 3 levels: trigger, group, final link.
                        </p>
                      </div>
                    ) : null}
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={itemSearch}
                        onChange={(event) => setItemSearch(event.target.value)}
                        placeholder="Search menu items..."
                      />
                    </div>
                  </div>
                </TabsContent>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-hidden">
                <TabsContent value="structure" className="mt-0 h-full">
                  {form.items.length === 0 ? (
                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No items. Add a top-level link or sync active categories.
                    </div>
                  ) : (
                    <div className="flex h-full min-h-0 flex-col gap-3">
                      {isMegaMenu && structureMode === "mega" ? (
                        <MegaLayoutMap
                          stats={menuStats}
                          activeDepth={activeDepth}
                          activeIsFeatured={!!activeItem?.isFeatured}
                        />
                      ) : null}
                      {depthWarning ? (
                        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {depthWarning.trimmedCount} item
                          {depthWarning.trimmedCount === 1 ? "" : "s"} deeper than level{" "}
                          {MAX_MEGA_MENU_DEPTH} will not publish in the storefront mega menu.
                          Save to keep only the first {MAX_MEGA_MENU_DEPTH} levels.
                        </div>
                      ) : null}
                      <ScrollArea className="min-h-0 flex-1 pr-3">
                        <ItemTree
                          items={form.items}
                          path={[]}
                          structureMode={isMegaMenu ? structureMode : "tree"}
                          query={itemSearch.trim()}
                          activePath={activePath}
                          collapsedIds={collapsedIds}
                          onToggleCollapse={toggleCollapse}
                          onSelect={selectItem}
                          onEdit={selectItem}
                          onRemove={removeAt}
                          onMove={moveAt}
                          onDuplicate={duplicateAt}
                          onReorder={reorderAt}
                          onAddChild={(p) => addChild(p)}
                        />
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="preview" className="mt-0 h-full overflow-auto pr-1">
                  <MegaMenuLivePreview items={previewItems} location={form.location} />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          <Card className="gap-2 xl:sticky xl:top-24 xl:self-start">
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="item" className="gap-4">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
                  <TabsTrigger value="item" className="h-9 gap-1">
                    <Pencil className="h-3.5 w-3.5" />
                    Item
                  </TabsTrigger>
                  <TabsTrigger value="sync" className="h-9 gap-1">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="h-9 gap-1">
                    <Settings2 className="h-3.5 w-3.5" />
                    Menu
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="item">
                  <MenuItemInspector
                    item={activeItem}
                    path={activePath}
                    depth={activeDepth}
                    location={form.location}
                    onChange={(patch) => {
                      if (!activePath) return;
                      updateAt(activePath, (item) => ({ ...item, ...patch }));
                    }}
                    onAddChild={() => {
                      if (activePath) addChild(activePath);
                    }}
                  />
                </TabsContent>

                <TabsContent value="sync">
                  <MegaMenuSyncPanel
                    isMegaMenu={form.location === "header-mega"}
                    isSyncing={isSyncingCategories}
                    stats={menuStats}
                    pendingSync={pendingSync}
                    onSync={syncCategoriesToMegaMenu}
                    onApplySync={applyPendingSync}
                    onDiscardSync={() => setPendingSync(null)}
                    onSetMegaLocation={() =>
                      setForm((prev) => ({ ...prev, location: "header-mega" }))
                    }
                  />
                </TabsContent>

                <TabsContent value="settings">
                  <MenuSettingsPanel form={form} setForm={setForm} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
