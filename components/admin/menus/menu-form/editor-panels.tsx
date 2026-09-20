"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  ImageIcon,
  Layers,
  Link2,
  Loader2,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageUploadField } from "@/components/admin/settings/fields/image-upload-field";
import { cn } from "@/lib/utils";
import {
  LOCATION_OPTIONS,
  buildPageResourceOptions,
  getMegaLayoutAddLabel,
  getMegaLayoutFieldLabel,
  getMegaLayoutRole,
  getApiItems,
  getPreviewPromoImage,
  getResourceEndpoint,
  itemOrDescendantMatches,
  normalizeResourceOption,
  pathKey,
  pathsEqual,
  resourceKey,
  type MenuFormState,
  type MenuItem,
  type MenuLocation,
  type MenuStats,
  type PendingCategorySync,
  type ResourceOption,
  type StructureMode,
} from "@/components/admin/menus/menu-form/helpers";
import { MAX_MEGA_MENU_DEPTH } from "@/lib/menu-depth";

export function ResourcePicker({
  currentType,
  onPick,
}: {
  currentType: MenuItem["type"];
  onPick: (resource: ResourceOption) => void;
}) {
  const pickerTypes: Array<{ value: MenuItem["type"]; label: string }> = [
    { value: "page", label: "Page" },
    { value: "category", label: "Category" },
    { value: "collection", label: "Collection" },
    { value: "product", label: "Product" },
    { value: "brand", label: "Brand" },
    { value: "blog-post", label: "Blog post" },
  ];
  const initialType = pickerTypes.some((type) => type.value === currentType)
    ? currentType
    : "page";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MenuItem["type"]>(initialType);
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (type === "page") {
      const normalizedQuery = query.trim().toLowerCase();
      setResources(
        buildPageResourceOptions().filter((page) =>
          [page.label, page.url, page.description]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      );
      return;
    }
    if (type === "blog") {
      setResources([
        {
          id: "blog",
          label: "Blog",
          url: "/blog",
          type: "blog",
          subtitle: "Storefront page",
        },
      ]);
      return;
    }

    const endpoint = getResourceEndpoint(type, query.trim());
    if (!endpoint) {
      setResources([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(endpoint);
        const data = await response.json();
        const normalizedQuery = query.trim().toLowerCase();
        const options = getApiItems(data)
          .map((item) => normalizeResourceOption(type, item))
          .filter((item): item is ResourceOption => !!item)
          .filter((item) =>
            !normalizedQuery ||
            [item.label, item.url, item.description]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery),
          );
        setResources(options);
      } catch {
        setResources([]);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open, query, type]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <PackageSearch className="h-4 w-4" />
          Choose resource
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-3">
        <div className="space-y-3">
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value as MenuItem["type"]);
                setQuery("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pickerTypes.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
              />
            </div>
          </div>
          <ScrollArea className="h-72 pr-2">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </div>
            ) : resources.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No resources found.
              </div>
            ) : (
              <div className="space-y-1">
                {resources.map((resource) => (
                  <button
                    key={`${resource.type}:${resource.id}:${resource.url}`}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      onPick(resource);
                      setOpen(false);
                    }}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted/50">
                      {resource.image ? (
                        <img
                          src={resource.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{resource.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {resource.subtitle || resource.url}
                      </p>
                    </div>
                    <Check className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MenuSettingsPanel({
  form,
  setForm,
}: {
  form: MenuFormState;
  setForm: Dispatch<SetStateAction<MenuFormState>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input
          className="mt-1"
          value={form.name}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, name: event.target.value }))
          }
        />
      </div>
      <div>
        <Label>Handle</Label>
        <Input
          className="mt-1"
          value={form.handle}
          placeholder="auto-generated from name"
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              handle: event.target.value
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, ""),
            }))
          }
        />
      </div>
      <div>
        <Label>Location</Label>
        <Select
          value={form.location}
          onValueChange={(value) =>
            setForm((previous) => ({
              ...previous,
              location: value as MenuLocation,
            }))
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          className="mt-1"
          rows={3}
          value={form.description}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              description: event.target.value,
            }))
          }
        />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <Label className="m-0">Active</Label>
        <Switch
          checked={form.isActive}
          onCheckedChange={(value) =>
            setForm((previous) => ({ ...previous, isActive: value }))
          }
        />
      </div>
    </div>
  );
}

export function MenuItemInspector({
  item,
  path,
  depth,
  location,
  onChange,
  onAddChild,
}: {
  item: MenuItem | null;
  path: number[] | null;
  depth: number;
  location: MenuLocation;
  onChange: (patch: Partial<MenuItem>) => void;
  onAddChild: () => void;
}) {
  if (!item || !path) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select a menu item to edit its label, link, image, and promo settings.
      </div>
    );
  }

  const isMegaMenu = location === "header-mega";
  const megaRole = getMegaLayoutRole(depth, item.isFeatured);
  const labelText = isMegaMenu
    ? getMegaLayoutFieldLabel(depth, item.isFeatured)
    : "Label";
  const addChildLabel = isMegaMenu ? getMegaLayoutAddLabel(depth) : "Child";
  const canAddChild = !isMegaMenu || depth < MAX_MEGA_MENU_DEPTH;
  const showMissingPromoImageWarning =
    isMegaMenu && item.isFeatured && !getPreviewPromoImage(item);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.label || "Untitled item"}</p>
          <p className="text-xs text-muted-foreground">
            {isMegaMenu ? megaRole : `Level ${depth}`}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddChild}
          disabled={!canAddChild}
          title={
            canAddChild
              ? addChildLabel
              : "Mega menu supports up to 3 levels only"
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          {addChildLabel}
        </Button>
      </div>

      <Separator />

      <div>
        <Label>{labelText} *</Label>
        <Input
          className="mt-1"
          value={item.label}
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </div>
      {isMegaMenu && depth === 2 ? (
        <div>
          <Label>Column title</Label>
          <Input
            className="mt-1"
            value={item.columnTitle || ""}
            placeholder={item.label || "Group heading"}
            onChange={(event) => onChange({ columnTitle: event.target.value })}
          />
        </div>
      ) : null}
      <div>
        <Label>URL</Label>
        <div className="relative mt-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={item.url}
            placeholder="/products or https://..."
            onChange={(event) => onChange({ url: event.target.value })}
          />
        </div>
      </div>
      <ResourcePicker
        currentType={item.type}
        onPick={(resource) =>
          onChange({
            label: resource.label,
            url: resource.url,
            type: resource.type,
            image: resource.image || item.image,
            description: resource.description || item.description,
            target: resource.url.startsWith("http") ? "_blank" : "_self",
          })
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Link type</Label>
          <Select
            value={item.type}
            onValueChange={(value) => onChange({ type: value as MenuItem["type"] })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom URL</SelectItem>
              <SelectItem value="page">Page</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="collection">Collection</SelectItem>
              <SelectItem value="brand">Brand</SelectItem>
              <SelectItem value="blog">Blog</SelectItem>
              <SelectItem value="blog-post">Blog post</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Open in</Label>
          <Select
            value={item.target}
            onValueChange={(value) =>
              onChange({ target: value as MenuItem["target"] })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_self">Same tab</SelectItem>
              <SelectItem value="_blank">New tab</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>
          {location === "header-mega"
            ? "Subtitle / description"
            : "Description"}
        </Label>
        <Textarea
          className="mt-1"
          rows={2}
          value={item.description || ""}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>
      <div>
        <Label>Badge text</Label>
        <Input
          className="mt-1"
          placeholder="New, Sale..."
          value={item.badge || ""}
          onChange={(event) => onChange({ badge: event.target.value })}
        />
      </div>
      <ImageUploadField
        id={`menu-item-image-${pathKey(path)}`}
        label={
          location === "header-mega"
            ? item.isFeatured
              ? "Promo image"
              : "Side image / icon"
            : "Icon / image"
        }
        value={item.image || ""}
        onChange={(value) => onChange({ image: value })}
        previewAlt={item.label || "Menu item image"}
        previewClassName="h-full w-full object-contain"
      />
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label className="m-0">
            {location === "header-mega" ? "Right promo panel" : "Featured"}
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {location === "header-mega"
              ? "Turn on for a top-level category to show its promo image on the right panel while that category is active. Each category carries its own promo."
              : "The first featured item with an image becomes the right-side panel."}
          </p>
        </div>
        <Switch
          checked={!!item.isFeatured}
          onCheckedChange={(value) => onChange({ isFeatured: value })}
        />
      </div>
      {showMissingPromoImageWarning ? (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Featured promo panels only render on the storefront when this item
            has an image. Add a promo image or turn off the right promo panel.
          </p>
        </div>
      ) : null}
      {isMegaMenu && depth >= MAX_MEGA_MENU_DEPTH ? (
        <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Level 3 is the final storefront mega menu level. Use the category
            page, filters, or collections for deeper browsing.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function MegaMenuSyncPanel({
  isMegaMenu,
  isSyncing,
  stats,
  pendingSync,
  onSync,
  onApplySync,
  onDiscardSync,
  onSetMegaLocation,
}: {
  isMegaMenu: boolean;
  isSyncing: boolean;
  stats: MenuStats;
  pendingSync: PendingCategorySync | null;
  onSync: () => void;
  onApplySync: () => void;
  onDiscardSync: () => void;
  onSetMegaLocation: () => void;
}) {
  const diff = pendingSync?.diff;
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
        <Layers className="mr-1 inline h-4 w-4" />
        Top-level categories become the left rail, children become the second rail,
        and grandchildren become the link grid. Deeper category levels stay in
        category pages and filters.
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Top level</p>
          <p className="mt-1 text-lg font-semibold">{stats.topLevel}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Promo images</p>
          <p className="mt-1 text-lg font-semibold">{stats.promoCount}</p>
        </div>
      </div>
      {!isMegaMenu ? (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center"
          onClick={onSetMegaLocation}
        >
          Set location to Mega Menu
        </Button>
      ) : null}
      <Button
        type="button"
        className="w-full justify-center gap-2"
        onClick={onSync}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Sync active categories
      </Button>
      {diff ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Sync preview</p>
              <p className="text-xs text-muted-foreground">
                Apply only after reviewing category changes. Sync imports the
                first 3 levels for the storefront mega menu.
              </p>
            </div>
            <Badge variant="secondary">{pendingSync.items.length} top level</Badge>
          </div>
          {pendingSync.trimmedCount > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              {pendingSync.trimmedCount} deeper category item
              {pendingSync.trimmedCount === 1 ? "" : "s"} will stay out of the
              mega menu.
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-emerald-500/10 p-2">
              <p className="text-xs text-muted-foreground">New</p>
              <p className="font-semibold text-emerald-700">{diff.added.length}</p>
            </div>
            <div className="rounded-md bg-amber-500/10 p-2">
              <p className="text-xs text-muted-foreground">Changed</p>
              <p className="font-semibold text-amber-700">{diff.changed.length}</p>
            </div>
            <div className="rounded-md bg-destructive/10 p-2">
              <p className="text-xs text-muted-foreground">Removed</p>
              <p className="font-semibold text-destructive">{diff.removed.length}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground">Preserved</p>
              <p className="font-semibold">{Math.max(diff.preserved, 0)}</p>
            </div>
          </div>
          <ScrollArea className="max-h-44 pr-2">
            <div className="space-y-2 text-xs">
              {diff.added.slice(0, 5).map((item) => (
                <div key={`added-${resourceKey(item)}`} className="flex gap-2">
                  <Badge variant="outline" className="h-5 text-[10px]">
                    New
                  </Badge>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
              {diff.changed.slice(0, 5).map(({ current, incoming, reason }) => (
                <div key={`changed-${resourceKey(incoming)}`} className="flex gap-2">
                  <Badge variant="outline" className="h-5 text-[10px]">
                    Changed
                  </Badge>
                  <span className="min-w-0 truncate">
                    {current.label} {"->"} {incoming.label} ({reason})
                  </span>
                </div>
              ))}
              {diff.removed.slice(0, 5).map((item) => (
                <div key={`removed-${resourceKey(item)}`} className="flex gap-2">
                  <Badge variant="outline" className="h-5 text-[10px]">
                    Removed
                  </Badge>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
              {diff.added.length + diff.changed.length + diff.removed.length === 0 ? (
                <p className="text-muted-foreground">
                  Category tree is already aligned with active categories.
                </p>
              ) : null}
            </div>
          </ScrollArea>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onDiscardSync}>
              Discard
            </Button>
            <Button type="button" onClick={onApplySync}>
              Apply sync
            </Button>
          </div>
        </div>
      ) : stats.total > 0 ? (
        <p className="text-xs text-muted-foreground">
          Sync now stages a review before it changes the saved menu tree.
        </p>
      ) : null}
    </div>
  );
}

export function ItemTree({
  items,
  path,
  structureMode,
  query,
  activePath,
  collapsedIds,
  onToggleCollapse,
  onSelect,
  onEdit,
  onRemove,
  onMove,
  onDuplicate,
  onReorder,
  onAddChild,
}: {
  items: MenuItem[];
  path: number[];
  structureMode: StructureMode;
  query: string;
  activePath: number[] | null;
  collapsedIds: Set<string>;
  onToggleCollapse: (key: string) => void;
  onSelect: (path: number[]) => void;
  onEdit: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  onMove: (path: number[], dir: "up" | "down") => void;
  onDuplicate: (path: number[]) => void;
  onReorder: (parentPath: number[], fromIndex: number, toIndex: number) => void;
  onAddChild: (path: number[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );
  const sortableIds = items.map((_, idx) => pathKey([...path, idx]));
  const dragDisabled = !!query;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = sortableIds.indexOf(String(active.id));
    const toIndex = sortableIds.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    onReorder(path, fromIndex, toIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <ul className={cn("space-y-1", path.length > 0 && "ml-6 mt-1 border-l pl-4")}>
          {items.map((it, idx) => {
            const childPath = [...path, idx];
            const isVisible = itemOrDescendantMatches(it, query);
            if (!isVisible) return null;
            return (
              <SortableMenuItemRow
                key={`${path.join("-")}-${idx}-${it._id || it.label}`}
                id={pathKey(childPath)}
                item={it}
                childPath={childPath}
                structureMode={structureMode}
                query={query}
                activePath={activePath}
                collapsedIds={collapsedIds}
                onToggleCollapse={onToggleCollapse}
                dragDisabled={dragDisabled}
                onSelect={onSelect}
                onEdit={onEdit}
                onRemove={onRemove}
                onMove={onMove}
                onDuplicate={onDuplicate}
                onReorder={onReorder}
                onAddChild={onAddChild}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function SortableMenuItemRow({
  id,
  item,
  childPath,
  structureMode,
  query,
  activePath,
  collapsedIds,
  onToggleCollapse,
  dragDisabled,
  onSelect,
  onEdit,
  onRemove,
  onMove,
  onDuplicate,
  onReorder,
  onAddChild,
}: {
  id: string;
  item: MenuItem;
  childPath: number[];
  structureMode: StructureMode;
  query: string;
  activePath: number[] | null;
  collapsedIds: Set<string>;
  onToggleCollapse: (key: string) => void;
  dragDisabled: boolean;
  onSelect: (path: number[]) => void;
  onEdit: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  onMove: (path: number[], dir: "up" | "down") => void;
  onDuplicate: (path: number[]) => void;
  onReorder: (parentPath: number[], fromIndex: number, toIndex: number) => void;
  onAddChild: (path: number[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: dragDisabled });
  const hasChildren = (item.children || []).length > 0;
  const isActive = pathsEqual(childPath, activePath);
  const collapseKey = item._id ?? pathKey(childPath);
  // A search query force-expands every branch so matches stay visible.
  const isCollapsed = hasChildren && !query && collapsedIds.has(collapseKey);
  const roleLabel =
    structureMode === "mega"
      ? getMegaLayoutRole(childPath.length, item.isFeatured)
      : `L${childPath.length}`;
  const addLabel =
    structureMode === "mega"
      ? getMegaLayoutAddLabel(childPath.length)
      : "Child";
  const maxMegaDepthReached =
    structureMode === "mega" && childPath.length >= MAX_MEGA_MENU_DEPTH;
  const showInlineAdd =
    structureMode !== "mega" || childPath.length <= MAX_MEGA_MENU_DEPTH;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "relative z-10")}>
      <div
        className={cn(
          "group flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-2",
          isActive && "border-primary bg-primary/5 shadow-sm",
          isDragging && "opacity-70 shadow-md",
        )}
      >
        <button
          type="button"
          disabled={dragDisabled}
          {...attributes}
          {...listeners}
          className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title={dragDisabled ? "Clear search to drag" : "Drag to reorder"}
          aria-label={`Drag ${item.label || "menu item"} to reorder`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(collapseKey)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title={isCollapsed ? "Expand" : "Collapse"}
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${item.label || "menu item"}`}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onSelect(childPath)}
        >
          <span className="truncate text-sm font-medium">{item.label}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {roleLabel}
          </Badge>
          {structureMode === "mega" && childPath.length > MAX_MEGA_MENU_DEPTH ? (
            <Badge variant="destructive" className="shrink-0 text-[10px]">
              Hidden
            </Badge>
          ) : null}
          <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
            {item.type === "blog-post" ? "Post" : item.type}
          </Badge>
          {structureMode === "mega" && (item.image || item.icon) ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : null}
          {item.isFeatured ? (
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
          ) : null}
          {item.badge ? (
            <Badge variant="secondary" className="text-[10px]">
              {item.badge}
            </Badge>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {showInlineAdd ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2"
              onClick={() => onAddChild(childPath)}
              disabled={maxMegaDepthReached}
              title={addLabel}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden text-xs xl:inline">{addLabel.replace("Add ", "")}</span>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="More actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(childPath)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(childPath, "up")}>
                <ArrowUp className="h-4 w-4" />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(childPath, "down")}>
                <ArrowDown className="h-4 w-4" />
                Move down
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(childPath)}>
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              {structureMode === "mega" ? (
                <DropdownMenuItem
                  disabled={maxMegaDepthReached}
                  onClick={() => onAddChild(childPath)}
                >
                  <Plus className="h-4 w-4" />
                  {addLabel}
                </DropdownMenuItem>
              ) : !showInlineAdd ? (
                <DropdownMenuItem onClick={() => onAddChild(childPath)}>
                  <Plus className="h-4 w-4" />
                  {addLabel}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onRemove(childPath)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hasChildren && !isCollapsed ? (
        <ItemTree
          items={item.children}
          path={childPath}
          structureMode={structureMode}
          query={query}
          activePath={activePath}
          collapsedIds={collapsedIds}
          onToggleCollapse={onToggleCollapse}
          onSelect={onSelect}
          onEdit={onEdit}
          onRemove={onRemove}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onReorder={onReorder}
          onAddChild={onAddChild}
        />
      ) : null}
    </li>
  );
}
