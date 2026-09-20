"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
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
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye,
  EyeOff,
  GripVertical,
  PencilLine,
  Save,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast-notification";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  MediaUploader,
  type UploadedMedia,
} from "@/components/ui/media-uploader";
import { CollectionProductSelector } from "@/components/admin/collection-product-selector";
import { CollectionCategorySelector } from "@/components/admin/collection-category-selector";
import {
  clearHeroBannerStudioDrafts,
  HeroBannerAiStudio,
} from "@/components/ai-authoring/hero-banner-ai-studio";
import { AiStudioImageField } from "@/components/ai-authoring/ai-studio-image-field";
import { PROMO_CARD_SLOT_STUDIOS } from "@/components/ai-authoring/promo-card-ai-studio";
import { cn } from "@/lib/utils";
import {
  applyHeroBannerToSlide,
  getDefaultHomePageSettings,
  normalizeHomePageSettings,
  NEW_ARRIVALS_SOURCES,
  NEW_ARRIVALS_LIMIT_MIN,
  NEW_ARRIVALS_LIMIT_MAX,
  FEATURED_PRODUCTS_SOURCES,
  FEATURED_PRODUCTS_LIMIT_MIN,
  FEATURED_PRODUCTS_LIMIT_MAX,
  FEATURED_CATEGORIES_SOURCES,
  FEATURED_CATEGORIES_LIMIT_MIN,
  FEATURED_CATEGORIES_LIMIT_MAX,
  type HomePageSettings,
  type HomeSectionId,
  type NewArrivalsSource,
  type FeaturedProductsSource,
  type FeaturedCategoriesSource,
} from "@/lib/home-page-config";
import { setNestedValue } from "@/components/admin/online-store/set-nested-value";

type SectionMeta = {
  id: HomeSectionId;
  title: string;
  subtitle: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function SortableSectionRow({
  sectionId,
  title,
  subtitle,
  visible,
  isExpanded,
  onToggleVisible,
  onToggleExpand,
  editor,
  hiddenText,
  dragAriaLabel,
  hideAriaLabel,
  showAriaLabel,
  editAriaLabel,
}: {
  sectionId: HomeSectionId;
  title: string;
  subtitle: string;
  visible: boolean;
  isExpanded: boolean;
  onToggleVisible: () => void;
  onToggleExpand: () => void;
  editor: React.ReactNode;
  hiddenText: string;
  dragAriaLabel: string;
  hideAriaLabel: string;
  showAriaLabel: string;
  editAriaLabel: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden rounded-sm border border-border bg-card/95 shadow-[0_1px_8px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_8px_rgba(2,6,23,0.45)]",
        isDragging && "opacity-70",
      )}
    >
      <div className="flex flex-col gap-2 px-3 pt-2 md:pt-1 md:px-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid cursor-pointer h-8 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={dragAriaLabel}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4.5 w-4.5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight text-foreground">
              {title}
            </p>
            <p className="truncate text-xs leading-tight text-muted-foreground">
              {visible ? subtitle : hiddenText}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={onToggleVisible}
              aria-label={visible ? hideAriaLabel : showAriaLabel}
            >
              {visible ? (
                <Eye className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg text-blue-600 transition-transform dark:text-blue-400",
                isExpanded && "rotate-6 bg-blue-50 dark:bg-blue-500/15",
              )}
              onClick={onToggleExpand}
              aria-label={editAriaLabel}
            >
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "grid overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isExpanded
              ? "mt-1 grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="rounded-lg border border-border bg-muted/50 p-3.5 md:p-4">
              {editor}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function HomePageBuilder({ locale }: { locale: string }) {
  const t = useTranslations();
  const [builder, setBuilder] = useState<HomePageSettings>(
    getDefaultHomePageSettings(),
  );
  const [initialBuilder, setInitialBuilder] = useState<HomePageSettings>(
    getDefaultHomePageSettings(),
  );
  const [heroSlideIdentities, setHeroSlideIdentities] = useState<string[]>(() =>
    builder.sections.hero.slides.map(
      (_, index) => `hero-slide-instance-${index}`,
    ),
  );
  const heroSlideIdentityCounter = useRef(heroSlideIdentities.length);
  const createHeroSlideIdentity = () => {
    const identity = `hero-slide-instance-${heroSlideIdentityCounter.current}`;
    heroSlideIdentityCounter.current += 1;
    return identity;
  };
  const [expandedSection, setExpandedSection] = useState<HomeSectionId | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const tSafe = (
    key: string,
    fallback: string,
    values?: Record<string, string | number>,
  ) => {
    try {
      const translate = t as unknown as (
        k: string,
        v?: Record<string, string | number>,
      ) => string;
      const result = translate(key, values);
      return typeof result === "string" && result !== key ? result : fallback;
    } catch {
      return fallback;
    }
  };

  const sectionMeta: SectionMeta[] = [
    {
      id: "hero",
      title: tSafe("admin.homePageBuilder.sections.hero.title", "Hero"),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.hero.subtitle",
        "Cover image slider",
      ),
    },
    {
      id: "featuredCategories",
      title: tSafe(
        "admin.homePageBuilder.sections.featuredCategories.title",
        "Featured Categories",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.featuredCategories.subtitle",
        "Top-level categories grid",
      ),
    },
    {
      id: "newArrivals",
      title: tSafe(
        "admin.homePageBuilder.sections.newArrivals.title",
        "Products on Sale",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.newArrivals.subtitle",
        "Latest products section title",
      ),
    },
    {
      id: "promotionsOffers",
      title: tSafe(
        "admin.homePageBuilder.sections.promotionsOffers.title",
        "Promotions & Offers",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.promotionsOffers.subtitle",
        "Bento grid of feature cards and offers",
      ),
    },
    {
      id: "featuredProducts",
      title: tSafe(
        "admin.homePageBuilder.sections.featuredProducts.title",
        "Featured Products",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.featuredProducts.subtitle",
        "Choose which products to showcase and how many",
      ),
    },
    {
      id: "topVendors",
      title: tSafe(
        "admin.homePageBuilder.sections.topVendors.title",
        "Top Vendors",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.topVendors.subtitle",
        "Showcase highest-rated approved vendors",
      ),
    },
    {
      id: "becomeVendor",
      title: tSafe(
        "admin.homePageBuilder.sections.becomeVendor.title",
        "Become a Vendor",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.becomeVendor.subtitle",
        "Vendor call-to-action with image, headline & button",
      ),
    },
    {
      id: "topArticles",
      title: tSafe(
        "admin.homePageBuilder.sections.topArticles.title",
        "Top Articles",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.topArticles.subtitle",
        "Latest published blog posts carousel",
      ),
    },
    {
      id: "fromInstagram",
      title: tSafe(
        "admin.homePageBuilder.sections.fromInstagram.title",
        "From Instagram",
      ),
      subtitle: tSafe(
        "admin.homePageBuilder.sections.fromInstagram.subtitle",
        "Showcase Instagram posts with clickable image cards",
      ),
    },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
      const response = await fetch("/api/admin/settings", { method: "GET" });
      const payload = (await response.json()) as unknown;

        if (!response.ok || !isRecord(payload) || payload.success !== true) {
          throw new Error("Failed to load settings");
        }

        const data = isRecord(payload.data) ? payload.data : {};
        const parsed = normalizeHomePageSettings(data.homePage);

        setBuilder(parsed);
        setInitialBuilder(parsed);
        setHeroSlideIdentities(
          parsed.sections.hero.slides.map(() => createHeroSlideIdentity()),
        );
      } catch {
        toast.error(
          tSafe(
            "admin.homePageBuilder.toasts.loadError",
            "Failed to load homepage editor data",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(builder) !== JSON.stringify(initialBuilder),
    [builder, initialBuilder],
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = builder.sectionOrder.findIndex((id) => id === active.id);
    const newIndex = builder.sectionOrder.findIndex((id) => id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    setBuilder((prev) => ({
      ...prev,
      sectionOrder: arrayMove(prev.sectionOrder, oldIndex, newIndex),
    }));
  };

  const updateField = (path: string, value: unknown) => {
    setBuilder((prev) => setNestedValue<HomePageSettings>(prev, path, value));
  };

  const toggleVisibility = (sectionId: HomeSectionId) => {
    setBuilder((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: {
          ...prev.sections[sectionId],
          visible: !prev.sections[sectionId].visible,
        },
      },
    }));
  };

  const save = async () => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "homePage", data: builder }),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok || !isRecord(payload) || payload.success !== true) {
        throw new Error("Failed to save");
      }

      const data = isRecord(payload.data) ? payload.data : {};
      const parsed = normalizeHomePageSettings(data.homePage);
      setBuilder(parsed);
      setInitialBuilder(parsed);
      toast.success(
        tSafe(
          "admin.homePageBuilder.toasts.saveSuccess",
          "Homepage sections saved successfully",
        ),
      );
    } catch {
      toast.error(
        tSafe(
          "admin.homePageBuilder.toasts.saveError",
          "Failed to save homepage sections",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = () => {
    window.open(`/${locale}`, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <div className="rounded-sm border border-border bg-card p-10 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          {tSafe(
            "admin.homePageBuilder.loading",
            "Loading home page builder...",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-sm border border-border bg-card p-4 shadow-[0_3px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_3px_14px_rgba(2,6,23,0.45)] md:py-4 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {tSafe("admin.homePageBuilder.title", "Page Builder")}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.subtitle",
                "Drag to reorder - toggle visibility - edit content",
              )}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-[6px] px-5 sm:w-auto"
              onClick={openPreview}
            >
              <ExternalLink className="h-4 w-4" />
              {tSafe("admin.homePageBuilder.preview", "Preview")}
            </Button>
            <Button
              type="button"
              className="w-full rounded-[6px] px-5 font-semibold sm:w-auto"
              onClick={save}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tSafe("admin.homePageBuilder.saving", "Saving...")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {tSafe("admin.homePageBuilder.save", "Save")}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={builder.sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {builder.sectionOrder.map((sectionId) => {
              const meta = sectionMeta.find((item) => item.id === sectionId);
              if (!meta) return null;

              const visible = builder.sections[sectionId].visible;

              return (
                <SortableSectionRow
                  key={sectionId}
                  sectionId={sectionId}
                  title={meta.title}
                  subtitle={meta.subtitle}
                  visible={visible}
                  isExpanded={expandedSection === sectionId}
                  onToggleVisible={() => toggleVisibility(sectionId)}
                  onToggleExpand={() =>
                    setExpandedSection((current) =>
                      current === sectionId ? null : sectionId,
                    )
                  }
                  hiddenText={tSafe("admin.homePageBuilder.hidden", "Hidden")}
                  dragAriaLabel={tSafe(
                    "admin.homePageBuilder.row.dragAria",
                    "Drag {title}",
                    { title: meta.title },
                  )}
                  hideAriaLabel={tSafe(
                    "admin.homePageBuilder.row.hideAria",
                    "Hide {title}",
                    { title: meta.title },
                  )}
                  showAriaLabel={tSafe(
                    "admin.homePageBuilder.row.showAria",
                    "Show {title}",
                    { title: meta.title },
                  )}
                  editAriaLabel={tSafe(
                    "admin.homePageBuilder.row.editAria",
                    "Edit {title}",
                    { title: meta.title },
                  )}
                  editor={
                    <SectionEditor
                      locale={locale}
                      sectionId={sectionId}
                      builder={builder}
                      updateField={updateField}
                      setBuilder={setBuilder}
                      heroSlideIdentities={heroSlideIdentities}
                      setHeroSlideIdentities={setHeroSlideIdentities}
                      createHeroSlideIdentity={createHeroSlideIdentity}
                    />
                  }
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {!isDirty && (
        <p className="text-sm text-muted-foreground">
          {tSafe(
            "admin.homePageBuilder.allChangesSaved",
            "All changes are saved. Home page is fully synced with this editor.",
          )}
        </p>
      )}
    </div>
  );
}

function SectionEditor({
  locale,
  sectionId,
  builder,
  updateField,
  setBuilder,
  heroSlideIdentities,
  setHeroSlideIdentities,
  createHeroSlideIdentity,
}: {
  locale: string;
  sectionId: HomeSectionId;
  builder: HomePageSettings;
  updateField: (path: string, value: unknown) => void;
  setBuilder: React.Dispatch<React.SetStateAction<HomePageSettings>>;
  heroSlideIdentities: string[];
  setHeroSlideIdentities: React.Dispatch<React.SetStateAction<string[]>>;
  createHeroSlideIdentity: () => string;
}) {
  const t = useTranslations();
  const tSafe = (
    key: string,
    fallback: string,
    values?: Record<string, string | number>,
  ) => {
    try {
      const translate = t as unknown as (
        k: string,
        v?: Record<string, string | number>,
      ) => string;
      const result = translate(key, values);
      return typeof result === "string" && result !== key ? result : fallback;
    } catch {
      return fallback;
    }
  };

  if (sectionId === "hero") {
    const slides = builder.sections.hero.slides;

    const addSlide = () => {
      setHeroSlideIdentities((current) => [
        ...current,
        createHeroSlideIdentity(),
      ]);
      setBuilder((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          hero: {
            ...prev.sections.hero,
            slides: [
              ...prev.sections.hero.slides,
              { imageSrc: "", alt: "", href: "" },
            ],
          },
        },
      }));
    };

    const removeSlide = (index: number) => {
      const removedIdentity = heroSlideIdentities[index];
      if (removedIdentity) clearHeroBannerStudioDrafts(removedIdentity);
      setHeroSlideIdentities((current) =>
        current.filter((_, currentIndex) => currentIndex !== index),
      );
      setBuilder((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          hero: {
            ...prev.sections.hero,
            slides: prev.sections.hero.slides.filter((_, i) => i !== index),
          },
        },
      }));
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe("admin.homePageBuilder.editor.heroSlides", "Hero Slides")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSlide}
            className="h-8 rounded-[6px]"
          >
            <Plus className="h-3.5 w-3.5" />
            {tSafe("admin.homePageBuilder.editor.addSlide", "Add slide")}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {slides.map((slide, index) => {
            const slideIdentity =
              heroSlideIdentities[index] || `hero-slide-missing-${index}`;
            return (
              <div
                key={slideIdentity}
                className="space-y-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary" className="rounded-md">
                    {tSafe("admin.homePageBuilder.editor.slide", "Slide")}{" "}
                    {index + 1}
                  </Badge>
                  {slides.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSlide(index)}
                      className="h-7 w-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                      aria-label={tSafe(
                        "admin.homePageBuilder.editor.removeSlide",
                        "Remove slide",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {tSafe(
                        "admin.homePageBuilder.editor.coverImage",
                        "Cover image",
                      )}
                    </p>
                    <HeroBannerAiStudio
                      locale={locale}
                      slideIdentity={slideIdentity}
                      value={slide.imageSrc}
                      alt={slide.alt}
                      onChange={(url, nextAlt) =>
                        setBuilder((current) =>
                          applyHeroBannerToSlide(
                            current,
                            index,
                            url,
                            nextAlt,
                          ),
                        )
                      }
                    />
                  </div>
                  <MediaUploader
                    maxFiles={1}
                    acceptTypes={["image"]}
                    uploadTitle={tSafe(
                      "admin.homePageBuilder.editor.heroUploadTitle",
                      "Drag and drop cover image here, or click to browse",
                    )}
                    uploadDescription={tSafe(
                      "admin.homePageBuilder.editor.heroUploadDescription",
                      "Images only. Paste with Ctrl+V.",
                    )}
                    sizeGuide={tSafe(
                      "admin.homePageBuilder.editor.heroSizeGuide",
                      "Recommended size: 1360 x 314 px",
                    )}
                    mediaGridClassName="grid-cols-1 md:grid-cols-1"
                    previewAspectRatio="1360 / 314"
                    previewFit="contain"
                    previewTileClassName="bg-muted"
                    showCoverBadge={false}
                    coverHint={false}
                    value={
                      slide.imageSrc
                        ? [
                            {
                              _id: `hero-slide-${index}`,
                              url: slide.imageSrc,
                              type: "image",
                              mimeType: "image/*",
                              alt: slide.alt || undefined,
                              position: 0,
                            } satisfies UploadedMedia,
                          ]
                        : []
                    }
                    onChange={(items) => {
                      const image = items.find((item) => item.type === "image");
                      updateField(
                        `sections.hero.slides.${index}.imageSrc`,
                        image?.url || "",
                      );
                    }}
                  />
                </div>

                <Input
                  value={slide.alt}
                  onChange={(event) =>
                    updateField(
                      `sections.hero.slides.${index}.alt`,
                      event.target.value,
                    )
                  }
                  placeholder={tSafe(
                    "admin.homePageBuilder.editor.imageAlt",
                    "Image alt",
                  )}
                />

                <Input
                  value={slide.href}
                  onChange={(event) =>
                    updateField(
                      `sections.hero.slides.${index}.href`,
                      event.target.value,
                    )
                  }
                  placeholder={tSafe(
                    "admin.homePageBuilder.editor.linkUrl",
                    "Link URL (optional)",
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (sectionId === "featuredCategories") {
    const featuredCategories = builder.sections.featuredCategories;

    const sourceLabels: Record<FeaturedCategoriesSource, string> = {
      featured: tSafe(
        "admin.homePageBuilder.editor.featuredCategories.source.featured",
        "Featured categories",
      ),
      topLevel: tSafe(
        "admin.homePageBuilder.editor.featuredCategories.source.topLevel",
        "Top-level categories",
      ),
      manual: tSafe(
        "admin.homePageBuilder.editor.featuredCategories.source.manual",
        "Hand-picked categories",
      ),
    };

    const sourceHints: Record<FeaturedCategoriesSource, string> = {
      featured: tSafe(
        "admin.homePageBuilder.editor.featuredCategories.hint.featured",
        "Shows categories you have marked as Featured. Falls back to top-level categories when none are flagged.",
      ),
      topLevel: tSafe(
        "admin.homePageBuilder.editor.featuredCategories.hint.topLevel",
        "Shows every top-level (parent) category, ordered by their sort order.",
      ),
      manual: tSafe(
        "admin.homePageBuilder.editor.featuredCategories.hint.manual",
        "Pick exact categories and drag to set their order. Other rules are ignored.",
      ),
    };

    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.sectionTitle",
                "Section Title",
              )}
            </p>
            <Input
              value={featuredCategories.title}
              onChange={(event) =>
                updateField(
                  "sections.featuredCategories.title",
                  event.target.value,
                )
              }
              placeholder={tSafe(
                "admin.homePageBuilder.editor.featuredCategoriesTitlePlaceholder",
                "Featured Categories.",
              )}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.featuredCategories.sourceLabel",
                "Category source",
              )}
            </p>
            <NativeSelect
              className="w-full"
              value={featuredCategories.source}
              onChange={(event) =>
                updateField(
                  "sections.featuredCategories.source",
                  event.target.value as FeaturedCategoriesSource,
                )
              }
            >
              {FEATURED_CATEGORIES_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {sourceLabels[value]}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {sourceHints[featuredCategories.source]}
            </p>
          </div>

          {featuredCategories.source !== "manual" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {tSafe(
                  "admin.homePageBuilder.editor.categoryLimit",
                  "Max categories",
                )}
              </p>
              <Input
                type="number"
                min={FEATURED_CATEGORIES_LIMIT_MIN}
                max={FEATURED_CATEGORIES_LIMIT_MAX}
                value={featuredCategories.limit}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  const next = Number.isFinite(parsed)
                    ? Math.min(
                        FEATURED_CATEGORIES_LIMIT_MAX,
                        Math.max(
                          FEATURED_CATEGORIES_LIMIT_MIN,
                          Math.floor(parsed),
                        ),
                      )
                    : FEATURED_CATEGORIES_LIMIT_MIN;
                  updateField("sections.featuredCategories.limit", next);
                }}
              />
            </div>
          )}
        </div>

        {featuredCategories.source === "manual" && (
          <CollectionCategorySelector
            title={tSafe(
              "admin.homePageBuilder.editor.featuredCategories.manualTitle",
              "Hand-picked categories",
            )}
            selectedCategories={featuredCategories.categoryIds}
            onChange={(categoryIds) =>
              updateField("sections.featuredCategories.categoryIds", categoryIds)
            }
          />
        )}
      </div>
    );
  }

  if (sectionId === "newArrivals") {
    const newArrivals = builder.sections.newArrivals;

    const sourceLabels: Record<NewArrivalsSource, string> = {
      discounted: tSafe(
        "admin.homePageBuilder.editor.newArrivals.source.discounted",
        "Discounted / On Sale (compare-at price)",
      ),
      featured: tSafe(
        "admin.homePageBuilder.editor.newArrivals.source.featured",
        "Featured products",
      ),
      latest: tSafe(
        "admin.homePageBuilder.editor.newArrivals.source.latest",
        "Latest products",
      ),
      manual: tSafe(
        "admin.homePageBuilder.editor.newArrivals.source.manual",
        "Hand-picked products",
      ),
    };

    const sourceHints: Record<NewArrivalsSource, string> = {
      discounted: tSafe(
        "admin.homePageBuilder.editor.newArrivals.hint.discounted",
        "Automatically shows products whose compare-at price is higher than their price (any variant on sale counts).",
      ),
      featured: tSafe(
        "admin.homePageBuilder.editor.newArrivals.hint.featured",
        "Shows products you have marked as Featured, newest first.",
      ),
      latest: tSafe(
        "admin.homePageBuilder.editor.newArrivals.hint.latest",
        "Shows the most recently created products.",
      ),
      manual: tSafe(
        "admin.homePageBuilder.editor.newArrivals.hint.manual",
        "Pick exact products and drag to set their order. Other rules are ignored.",
      ),
    };

    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.sectionTitle",
                "Section Title",
              )}
            </p>
            <Input
              value={newArrivals.title}
              onChange={(event) =>
                updateField("sections.newArrivals.title", event.target.value)
              }
              placeholder={tSafe(
                "admin.homePageBuilder.editor.newArrivalsTitlePlaceholder",
                "Products on Sale.",
              )}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.sectionSubtitle",
                "Section Subtitle",
              )}
            </p>
            <Input
              value={newArrivals.subtitle}
              onChange={(event) =>
                updateField(
                  "sections.newArrivals.subtitle",
                  event.target.value,
                )
              }
              placeholder={tSafe(
                "admin.homePageBuilder.editor.optionalSubtitlePlaceholder",
                "Optional subtitle",
              )}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.newArrivals.sourceLabel",
                "Product source",
              )}
            </p>
            <NativeSelect
              className="w-full"
              value={newArrivals.source}
              onChange={(event) =>
                updateField(
                  "sections.newArrivals.source",
                  event.target.value as NewArrivalsSource,
                )
              }
            >
              {NEW_ARRIVALS_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {sourceLabels[value]}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {sourceHints[newArrivals.source]}
            </p>
          </div>

          {newArrivals.source !== "manual" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {tSafe(
                  "admin.homePageBuilder.editor.newArrivals.limitLabel",
                  "Max products",
                )}
              </p>
              <Input
                type="number"
                min={NEW_ARRIVALS_LIMIT_MIN}
                max={NEW_ARRIVALS_LIMIT_MAX}
                value={newArrivals.limit}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  const next = Number.isFinite(parsed)
                    ? Math.min(
                        NEW_ARRIVALS_LIMIT_MAX,
                        Math.max(NEW_ARRIVALS_LIMIT_MIN, Math.floor(parsed)),
                      )
                    : NEW_ARRIVALS_LIMIT_MIN;
                  updateField("sections.newArrivals.limit", next);
                }}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {tSafe(
                  "admin.homePageBuilder.editor.newArrivals.fallbackHint",
                  "If no products match this rule, the latest products are shown instead.",
                )}
              </p>
            </div>
          )}
        </div>

        {newArrivals.source === "manual" && (
          <CollectionProductSelector
            title={tSafe(
              "admin.homePageBuilder.editor.newArrivals.manualTitle",
              "Hand-picked products",
            )}
            selectedProducts={newArrivals.productIds}
            onChange={(productIds) =>
              updateField("sections.newArrivals.productIds", productIds)
            }
          />
        )}
      </div>
    );
  }

  if (sectionId === "fromInstagram") {
    const items = builder.sections.fromInstagram.items;

    const addItem = () => {
      setBuilder((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          fromInstagram: {
            ...prev.sections.fromInstagram,
            items: [
              ...prev.sections.fromInstagram.items,
              { imageSrc: "", href: "" },
            ],
          },
        },
      }));
    };

    const removeItem = (index: number) => {
      setBuilder((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          fromInstagram: {
            ...prev.sections.fromInstagram,
            items: prev.sections.fromInstagram.items.filter(
              (_, i) => i !== index,
            ),
          },
        },
      }));
    };

    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.sectionTitle",
                "Section Title",
              )}
            </p>
            <Input
              value={builder.sections.fromInstagram.title}
              onChange={(event) =>
                updateField(
                  "sections.fromInstagram.title",
                  event.target.value,
                )
              }
              placeholder={tSafe(
                "admin.homePageBuilder.editor.fromInstagram.titlePlaceholder",
                "From Instagram",
              )}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.fromInstagram.posts",
              "Instagram Posts",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="h-8 rounded-[6px]"
          >
            <Plus className="h-3.5 w-3.5" />
            {tSafe(
              "admin.homePageBuilder.editor.fromInstagram.addPost",
              "Add post",
            )}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="rounded-md">
                  {tSafe(
                    "admin.homePageBuilder.editor.fromInstagram.post",
                    "Post",
                  )}{" "}
                  {index + 1}
                </Badge>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="h-7 w-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                    aria-label={tSafe(
                      "admin.homePageBuilder.editor.fromInstagram.removePost",
                      "Remove post",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <MediaUploader
                maxFiles={1}
                acceptTypes={["image"]}
                uploadTitle={tSafe(
                  "admin.homePageBuilder.editor.fromInstagram.uploadTitle",
                  "Drag and drop image here, or click to browse",
                )}
                uploadDescription={tSafe(
                  "admin.homePageBuilder.editor.fromInstagram.uploadDescription",
                  "Images only. Paste with Ctrl+V.",
                )}
                sizeGuide={tSafe(
                  "admin.homePageBuilder.editor.fromInstagram.sizeGuide",
                  "Recommended size: 320 x 320 px (square)",
                )}
                mediaGridClassName="grid-cols-1 md:grid-cols-1"
                previewAspectRatio="1 / 1"
                previewFit="cover"
                previewTileClassName="bg-muted"
                showCoverBadge={false}
                coverHint={false}
                value={
                  item.imageSrc
                    ? [
                        {
                          _id: `instagram-${index}`,
                          url: item.imageSrc,
                          type: "image",
                          mimeType: "image/*",
                          position: 0,
                        } satisfies UploadedMedia,
                      ]
                    : []
                }
                onChange={(uploaded) => {
                  const image = uploaded.find(
                    (entry) => entry.type === "image",
                  );
                  updateField(
                    `sections.fromInstagram.items.${index}.imageSrc`,
                    image?.url || "",
                  );
                }}
              />

              <Input
                value={item.href}
                onChange={(event) =>
                  updateField(
                    `sections.fromInstagram.items.${index}.href`,
                    event.target.value,
                  )
                }
                placeholder={tSafe(
                  "admin.homePageBuilder.editor.fromInstagram.postUrl",
                  "Instagram post URL",
                )}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sectionId === "promotionsOffers") {
    const cards = builder.sections.promotionsOffers.cards;
    const slotLabels = [
      tSafe(
        "admin.homePageBuilder.editor.promotionsOffers.slot.tallLeft",
        "Tall left",
      ),
      tSafe(
        "admin.homePageBuilder.editor.promotionsOffers.slot.tallMiddle",
        "Tall middle",
      ),
      tSafe(
        "admin.homePageBuilder.editor.promotionsOffers.slot.squareTopRight1",
        "Square top-right",
      ),
      tSafe(
        "admin.homePageBuilder.editor.promotionsOffers.slot.squareTopRight2",
        "Square top-right (with arrow)",
      ),
      tSafe(
        "admin.homePageBuilder.editor.promotionsOffers.slot.wideBottomRight",
        "Wide bottom banner",
      ),
    ];

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card, index) => {
          const slotLabel =
            slotLabels[index] ??
            `${tSafe("admin.homePageBuilder.editor.promotionsOffers.card", "Card")} ${index + 1}`;
          // Slot index → frame config (tall, tall, square, square, wide); the
          // square fallback covers any out-of-range index defensively.
          const slotStudio =
            PROMO_CARD_SLOT_STUDIOS[index] ?? PROMO_CARD_SLOT_STUDIOS[2];

          return (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="rounded-md">
                  {slotLabel}
                </Badge>
              </div>

              <MediaUploader
                maxFiles={1}
                acceptTypes={["image"]}
                value={
                  card.imageSrc
                    ? [
                        {
                          _id: `promotions-offers-${index}`,
                          url: card.imageSrc,
                          type: "image",
                          mimeType: "image/*",
                          position: 0,
                        } satisfies UploadedMedia,
                      ]
                    : []
                }
                onChange={(items) => {
                  const image = items.find((item) => item.type === "image");
                  updateField(
                    `sections.promotionsOffers.cards.${index}.imageSrc`,
                    image?.url || "",
                  );
                }}
                aiGenerateAction={
                  <AiStudioImageField
                    entity="content_page"
                    scope="admin"
                    locale={locale}
                    targetField="promoCardImage"
                    audience="shopper"
                    getFields={() => ({
                      section: "Home page Promotions & Offers bento grid",
                      slot: slotLabel,
                      linkUrl: card.href,
                    })}
                    value={card.imageSrc || ""}
                    onChange={(url) =>
                      updateField(
                        `sections.promotionsOffers.cards.${index}.imageSrc`,
                        url,
                      )
                    }
                    breadcrumbRoot={tSafe(
                      "admin.homePageBuilder.sections.promotionsOffers.title",
                      "Promotions & Offers",
                    )}
                    breadcrumbLeaf={slotLabel}
                    savedMessage={tSafe(
                      "admin.homePageBuilder.editor.promotionsOffers.savedToCard",
                      "Saved to card image",
                    )}
                    subjectNoun="promo image"
                    surface={slotStudio.surface}
                    generateDefaults={slotStudio.generateDefaults}
                    postProcessResult={slotStudio.postProcessResult}
                    promptPlaceholder={slotStudio.promptPlaceholder}
                    posHref={`/${locale}/admin/pos`}
                    browseHref={`/${locale}`}
                    persistKey={`home-promo-card:${index}`}
                  />
                }
              />

              <Input
                value={card.href}
                onChange={(event) =>
                  updateField(
                    `sections.promotionsOffers.cards.${index}.href`,
                    event.target.value,
                  )
                }
                placeholder={tSafe(
                  "admin.homePageBuilder.editor.linkUrl",
                  "Link URL (optional)",
                )}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (sectionId === "topVendors") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.sectionTitle",
              "Section Title",
            )}
          </p>
          <Input
            value={builder.sections.topVendors.title}
            onChange={(event) =>
              updateField("sections.topVendors.title", event.target.value)
            }
            placeholder={tSafe(
              "admin.homePageBuilder.editor.topVendorsTitlePlaceholder",
              "Top Vendors",
            )}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.topVendorsLimit",
              "Max vendors",
            )}
          </p>
          <Input
            type="number"
            min={1}
            max={20}
            value={builder.sections.topVendors.limit}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              updateField(
                "sections.topVendors.limit",
                Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
              );
            }}
          />
        </div>
      </div>
    );
  }

  if (sectionId === "topArticles") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.sectionTitle",
              "Section Title",
            )}
          </p>
          <Input
            value={builder.sections.topArticles.title}
            onChange={(event) =>
              updateField("sections.topArticles.title", event.target.value)
            }
            placeholder={tSafe(
              "admin.homePageBuilder.editor.topArticlesTitlePlaceholder",
              "Top Articles",
            )}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.topArticlesLimit",
              "Max articles",
            )}
          </p>
          <Input
            type="number"
            min={1}
            max={12}
            value={builder.sections.topArticles.limit}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              updateField(
                "sections.topArticles.limit",
                Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
              );
            }}
          />
        </div>
      </div>
    );
  }

  if (sectionId === "featuredProducts") {
    const featuredProducts = builder.sections.featuredProducts;

    const sourceLabels: Record<FeaturedProductsSource, string> = {
      all: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.source.all",
        "All products (browse with infinite scroll)",
      ),
      featured: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.source.featured",
        "Featured products",
      ),
      latest: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.source.latest",
        "Latest products",
      ),
      discounted: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.source.discounted",
        "Discounted / On Sale (compare-at price)",
      ),
      manual: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.source.manual",
        "Hand-picked products",
      ),
    };

    const sourceHints: Record<FeaturedProductsSource, string> = {
      all: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.hint.all",
        "Shows every active product and lazy-loads more as the shopper scrolls. Category tabs, price and sort filter across all products.",
      ),
      featured: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.hint.featured",
        "Shows products you have marked as Featured, newest first.",
      ),
      latest: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.hint.latest",
        "Shows the most recently created products.",
      ),
      discounted: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.hint.discounted",
        "Shows products whose compare-at price is higher than their price (any variant on sale counts).",
      ),
      manual: tSafe(
        "admin.homePageBuilder.editor.featuredProducts.hint.manual",
        "Pick exact products and drag to set their order. Other rules are ignored.",
      ),
    };

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.featuredProductsHeading",
              "Featured Products Heading",
            )}
          </p>
          <Input
            value={featuredProducts.title}
            onChange={(event) =>
              updateField("sections.featuredProducts.title", event.target.value)
            }
            placeholder={tSafe(
              "admin.homePageBuilder.editor.featuredProductsPlaceholder",
              "Leave empty for default text",
            )}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.featuredProducts.sourceLabel",
                "Product source",
              )}
            </p>
            <NativeSelect
              className="w-full"
              value={featuredProducts.source}
              onChange={(event) =>
                updateField(
                  "sections.featuredProducts.source",
                  event.target.value as FeaturedProductsSource,
                )
              }
            >
              {FEATURED_PRODUCTS_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {sourceLabels[value]}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {sourceHints[featuredProducts.source]}
            </p>
          </div>

          {featuredProducts.source !== "all" &&
            featuredProducts.source !== "manual" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {tSafe(
                    "admin.homePageBuilder.editor.featuredProducts.limitLabel",
                    "Max products",
                  )}
                </p>
                <Input
                  type="number"
                  min={FEATURED_PRODUCTS_LIMIT_MIN}
                  max={FEATURED_PRODUCTS_LIMIT_MAX}
                  value={featuredProducts.limit}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    const next = Number.isFinite(parsed)
                      ? Math.min(
                          FEATURED_PRODUCTS_LIMIT_MAX,
                          Math.max(
                            FEATURED_PRODUCTS_LIMIT_MIN,
                            Math.floor(parsed),
                          ),
                        )
                      : FEATURED_PRODUCTS_LIMIT_MIN;
                    updateField("sections.featuredProducts.limit", next);
                  }}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {tSafe(
                    "admin.homePageBuilder.editor.featuredProducts.fallbackHint",
                    "If no products match this rule, the latest products are shown instead.",
                  )}
                </p>
              </div>
            )}
        </div>

        {featuredProducts.source === "manual" && (
          <CollectionProductSelector
            title={tSafe(
              "admin.homePageBuilder.editor.featuredProducts.manualTitle",
              "Hand-picked products",
            )}
            selectedProducts={featuredProducts.productIds}
            onChange={(productIds) =>
              updateField("sections.featuredProducts.productIds", productIds)
            }
          />
        )}
      </div>
    );
  }

  if (sectionId === "becomeVendor") {
    const becomeVendor = builder.sections.becomeVendor;

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.becomeVendor.image",
              "Image",
            )}
          </p>
          <MediaUploader
            maxFiles={1}
            acceptTypes={["image"]}
            uploadTitle={tSafe(
              "admin.homePageBuilder.editor.becomeVendor.uploadTitle",
              "Drag and drop image here, or click to browse",
            )}
            uploadDescription={tSafe(
              "admin.homePageBuilder.editor.becomeVendor.uploadDescription",
              "Images only. Paste with Ctrl+V.",
            )}
            sizeGuide={tSafe(
              "admin.homePageBuilder.editor.becomeVendor.sizeGuide",
              "Recommended size: 720 x 500 px (transparent PNG works best)",
            )}
            mediaGridClassName="grid-cols-1 md:grid-cols-1"
            previewAspectRatio="720 / 500"
            previewFit="contain"
            previewTileClassName="bg-muted"
            showCoverBadge={false}
            coverHint={false}
            value={
              becomeVendor.imageSrc
                ? [
                    {
                      _id: "become-vendor-image",
                      url: becomeVendor.imageSrc,
                      type: "image",
                      mimeType: "image/*",
                      position: 0,
                    } satisfies UploadedMedia,
                  ]
                : []
            }
            onChange={(items) => {
              const image = items.find((item) => item.type === "image");
              updateField(
                "sections.becomeVendor.imageSrc",
                image?.url || "",
              );
            }}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.becomeVendor.titleLabel",
                "Title",
              )}
            </p>
            <Input
              value={becomeVendor.title}
              onChange={(event) =>
                updateField("sections.becomeVendor.title", event.target.value)
              }
              placeholder={tSafe(
                "admin.homePageBuilder.editor.becomeVendor.titlePlaceholder",
                "Start Selling With Us Today",
              )}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tSafe(
                "admin.homePageBuilder.editor.becomeVendor.buttonLabel",
                "Button label",
              )}
            </p>
            <Input
              value={becomeVendor.buttonLabel}
              onChange={(event) =>
                updateField(
                  "sections.becomeVendor.buttonLabel",
                  event.target.value,
                )
              }
              placeholder={tSafe(
                "admin.homePageBuilder.editor.becomeVendor.buttonLabelPlaceholder",
                "Become a Vendor",
              )}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.becomeVendor.subtitle",
              "Subtitle",
            )}
          </p>
          <Textarea
            rows={3}
            value={becomeVendor.subtitle}
            onChange={(event) =>
              updateField("sections.becomeVendor.subtitle", event.target.value)
            }
            placeholder={tSafe(
              "admin.homePageBuilder.editor.becomeVendor.subtitlePlaceholder",
              "Join our marketplace, manage products easily, accept secure payments, and grow your business faster.",
            )}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tSafe(
              "admin.homePageBuilder.editor.becomeVendor.buttonHref",
              "Button link",
            )}
          </p>
          <Input
            value={becomeVendor.buttonHref}
            onChange={(event) =>
              updateField(
                "sections.becomeVendor.buttonHref",
                event.target.value,
              )
            }
            placeholder={tSafe(
              "admin.homePageBuilder.editor.becomeVendor.buttonHrefPlaceholder",
              "/become-vendor",
            )}
          />
        </div>
      </div>
    );
  }

  return null;
}
