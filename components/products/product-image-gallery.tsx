"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Expand,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppImage } from "@/components/ui/app-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ModelViewer } from "@/components/ui/model-viewer";

type MediaKind = "image" | "video" | "model";

type GalleryMedia = {
  id: string;
  type?: MediaKind;
  url: string;
  alt?: string;
  mimeType?: string;
  thumbnailUrl?: string;
};

interface ProductImageGalleryProps {
  media: GalleryMedia[];
  productName: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  discountPercentage?: number;
}

export function ProductImageGallery({
  media,
  productName,
  selectedIndex,
  onSelect,
  discountPercentage = 0,
}: ProductImageGalleryProps) {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isZoomEnabled, setIsZoomEnabled] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("50% 50%");

  // Thumbnail overflow detection
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const [showThumbArrow, setShowThumbArrow] = useState(false);

  const checkThumbOverflow = useCallback(() => {
    const el = thumbStripRef.current;
    if (!el) return;
    setShowThumbArrow(el.scrollWidth > el.clientWidth + 2);
  }, []);

  useEffect(() => {
    checkThumbOverflow();
    window.addEventListener("resize", checkThumbOverflow);
    return () => window.removeEventListener("resize", checkThumbOverflow);
  }, [checkThumbOverflow, media.length]);

  const scrollThumbsRight = () => {
    const el = thumbStripRef.current;
    if (!el) return;
    el.scrollBy({ left: 200, behavior: "smooth" });
  };

  const selectedMedia = media[selectedIndex];
  const canNavigate = media.length > 1;
  const selectedKind = selectedMedia ? getMediaKind(selectedMedia) : "image";
  const selectedIsImage = selectedKind === "image";

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updatePointerType = () => setIsCoarsePointer(mediaQuery.matches);
    updatePointerType();

    mediaQuery.addEventListener("change", updatePointerType);
    return () => mediaQuery.removeEventListener("change", updatePointerType);
  }, []);

  const goNext = () => {
    if (!canNavigate) return;
    setTransformOrigin("50% 50%");
    onSelect((selectedIndex + 1) % media.length);
  };

  const goPrev = () => {
    if (!canNavigate) return;
    setTransformOrigin("50% 50%");
    onSelect((selectedIndex - 1 + media.length) % media.length);
  };

  const handlePointerMove = (event: MouseEvent<HTMLButtonElement>) => {
    if (!selectedIsImage || !isZoomEnabled || isCoarsePointer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setTransformOrigin(`${Math.max(0, Math.min(x, 100))}% ${Math.max(0, Math.min(y, 100))}%`);
  };

  const handleKeyNavigation = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    }
  };

  if (!selectedMedia) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-muted/30 text-sm text-muted-foreground">
        No image
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main media - fills viewport minus header, padding, and thumbnail row */}
      <div className="relative overflow-hidden rounded-2xl bg-[#f0f0f0] dark:bg-muted">
        {selectedIsImage ? (
          <button
            type="button"
            aria-label="Open product gallery fullscreen"
            onClick={() => setIsFullscreenOpen(true)}
            onMouseMove={handlePointerMove}
            onKeyDown={handleKeyNavigation}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2"
          >
            <div className="relative h-[45vh] w-full md:h-[50vh] lg:h-[calc(100vh-18rem)]">
              <GalleryMediaFrame
                item={selectedMedia}
                kind={selectedKind}
                productName={productName}
                isZoomEnabled={isZoomEnabled}
                isCoarsePointer={isCoarsePointer}
                transformOrigin={transformOrigin}
                priority
              />
            </div>
          </button>
        ) : (
          <div className="relative h-[45vh] w-full md:h-[50vh] lg:h-[calc(100vh-18rem)]">
            <GalleryMediaFrame
              item={selectedMedia}
              kind={selectedKind}
              productName={productName}
              cameraControls
              priority
            />
          </div>
        )}

        {/* Top bar: discount badge + zoom/expand buttons */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
          {discountPercentage > 0 ? (
            <Badge className="pointer-events-auto rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500">
              -{discountPercentage}%
            </Badge>
          ) : (
            <span />
          )}

          <div className="pointer-events-auto flex items-center gap-2">
            {selectedIsImage && (
              <button
                type="button"
                aria-label={
                  isZoomEnabled ? "Disable image zoom" : "Enable image zoom"
                }
                aria-pressed={isZoomEnabled}
                onClick={() => setIsZoomEnabled((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
              >
                {isZoomEnabled ? (
                  <ZoomOut className="h-4 w-4" />
                ) : (
                  <ZoomIn className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              aria-label={
                selectedIsImage
                  ? "Open fullscreen image viewer"
                  : "Open fullscreen media viewer"
              }
              onClick={() => setIsFullscreenOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
            >
              <Expand className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Prev / Next arrows */}
        {canNavigate && (
          <>
            <button
              type="button"
              aria-label="Show previous media"
              onClick={goPrev}
              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/95 text-foreground shadow-sm transition-all hover:scale-105 hover:bg-background sm:left-4"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Show next media"
              onClick={goNext}
              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/95 text-foreground shadow-sm transition-all hover:scale-105 hover:bg-background sm:right-4"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Horizontal thumbnail strip - all thumbs, arrow if overflow */}
      {canNavigate && (
        <div className="relative">
          <div
            ref={thumbStripRef}
            className="flex gap-2 overflow-x-auto scrollbar-none"
            onScroll={checkThumbOverflow}
          >
            {media.map((item, index) => {
              const isSelected = index === selectedIndex;
              const kind = getMediaKind(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={thumbnailLabel(kind, index)}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setTransformOrigin("50% 50%");
                    setIsZoomEnabled(false);
                    onSelect(index);
                  }}
                  className={cn(
                    "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-[#f0f0f0] transition-all dark:bg-muted",
                    isSelected
                      ? "border-foreground"
                      : "border-transparent hover:border-muted-foreground/40",
                  )}
                >
                  <GalleryThumbnail
                    item={item}
                    kind={kind}
                    productName={productName}
                    size="sm"
                  />
                </button>
              );
            })}
          </div>

          {/* Right arrow when thumbnails overflow */}
          {showThumbArrow && (
            <button
              type="button"
              onClick={scrollThumbsRight}
              className="absolute right-0 top-0 flex h-full w-10 items-center justify-end bg-linear-to-l from-background via-background/80 to-transparent pr-0.5"
              aria-label="Scroll thumbnails right"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Fullscreen dialog */}
      <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
        <DialogContent
          showCloseButton={false}
          className="aspect-square h-auto max-h-[90vh] w-[90vw] max-w-[90vh] gap-0 overflow-hidden rounded-xl border-border/60 bg-background p-0 sm:max-w-3xl"
          onKeyDown={handleKeyNavigation}
        >
          <DialogTitle className="sr-only">{productName} media viewer</DialogTitle>
          <DialogDescription className="sr-only">
            Browse product media in fullscreen mode with keyboard navigation.
          </DialogDescription>
          <button
            type="button"
            aria-label="Close media viewer"
            onClick={() => setIsFullscreenOpen(false)}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background sm:right-4 sm:top-4"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex h-full flex-col">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#f0f0f0] dark:bg-muted">
              <GalleryMediaFrame
                item={selectedMedia}
                kind={selectedKind}
                productName={productName}
                isZoomEnabled={selectedIsImage && isZoomEnabled}
                isCoarsePointer={isCoarsePointer}
                transformOrigin={transformOrigin}
                fullscreen
                cameraControls
              />

              {canNavigate && (
                <>
                  <button
                    type="button"
                    aria-label="Previous fullscreen media"
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/95 text-foreground shadow-sm transition hover:bg-background sm:left-5"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next fullscreen media"
                    onClick={goNext}
                    className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/95 text-foreground shadow-sm transition hover:bg-background sm:right-5"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            <div className="border-t border-border/70 bg-background px-3 py-3 sm:px-5">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {media.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const kind = getMediaKind(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Open fullscreen ${mediaLabel(kind)} ${index + 1}`}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setTransformOrigin("50% 50%");
                        setIsZoomEnabled(false);
                        onSelect(index);
                      }}
                      className={cn(
                        "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-[#f0f0f0] transition-colors",
                        isSelected ? "border-foreground" : "border-border/70 hover:border-foreground/35",
                      )}
                    >
                      <GalleryThumbnail
                        item={item}
                        kind={kind}
                        productName={productName}
                        size="md"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getMediaKind(item: GalleryMedia): MediaKind {
  if (item.type) return item.type;
  const mimeType = item.mimeType?.toLowerCase() || "";
  const url = item.url.toLowerCase();
  if (mimeType.startsWith("video/")) return "video";
  if (
    mimeType.includes("gltf") ||
    mimeType === "application/octet-stream" ||
    url.endsWith(".glb") ||
    url.endsWith(".gltf")
  ) {
    return "model";
  }
  return "image";
}

function thumbnailLabel(kind: MediaKind, index: number) {
  if (kind === "model") return `Show 3D model ${index + 1}`;
  if (kind === "video") return `Show video ${index + 1}`;
  return `Show image ${index + 1}`;
}

function mediaLabel(kind: MediaKind) {
  if (kind === "model") return "3D model";
  if (kind === "video") return "video";
  return "image";
}

function GalleryMediaFrame({
  item,
  kind,
  productName,
  isZoomEnabled = false,
  isCoarsePointer = false,
  transformOrigin = "50% 50%",
  fullscreen = false,
  cameraControls = false,
  priority = false,
}: {
  item: GalleryMedia;
  kind: MediaKind;
  productName: string;
  isZoomEnabled?: boolean;
  isCoarsePointer?: boolean;
  transformOrigin?: string;
  fullscreen?: boolean;
  cameraControls?: boolean;
  priority?: boolean;
}) {
  const alt = item.alt || productName;

  if (kind === "model") {
    return (
      <ModelViewer
        src={item.url}
        alt={alt}
        autoRotate
        cameraControls={cameraControls}
        poster={item.thumbnailUrl}
      />
    );
  }

  if (kind === "video") {
    return (
      <video
        src={item.url}
        poster={item.thumbnailUrl}
        controls
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <AppImage
      src={item.url}
      alt={alt}
      fill
      className={cn(
        fullscreen
          ? "object-contain p-6 transition-transform duration-500 ease-out motion-reduce:transition-none sm:p-10"
          : "object-contain p-6 transition-transform duration-500 ease-out motion-reduce:transition-none sm:p-10",
        isZoomEnabled
          ? fullscreen
            ? "scale-[2.2]"
            : "scale-[1.9]"
          : fullscreen
            ? "scale-100"
            : "scale-100 group-hover:scale-[1.025]",
      )}
      style={{ transformOrigin: isCoarsePointer ? "50% 50%" : transformOrigin }}
      priority={priority}
      loading={fullscreen ? "eager" : undefined}
      sizes={
        fullscreen
          ? "100vw"
          : "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 700px"
      }
    />
  );
}

function GalleryThumbnail({
  item,
  kind,
  productName,
  size,
}: {
  item: GalleryMedia;
  kind: MediaKind;
  productName: string;
  size: "sm" | "md";
}) {
  if (kind === "video") {
    return (
      <div className="relative h-full w-full">
        {item.thumbnailUrl ? (
          <AppImage
            src={item.thumbnailUrl}
            alt={item.alt || `${productName} video thumbnail`}
            fill
            className="object-cover"
            loading="lazy"
            sizes={size === "sm" ? "56px" : "64px"}
          />
        ) : (
          <video
            src={item.url}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        )}
        <Video className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-background/90 p-0.5 text-foreground shadow-sm" />
      </div>
    );
  }

  if (kind === "model") {
    if (item.thumbnailUrl) {
      return (
        <div className="relative h-full w-full">
          <AppImage
            src={item.thumbnailUrl}
            alt={item.alt || `${productName} 3D model thumbnail`}
            fill
            className="object-cover"
            loading="lazy"
            sizes={size === "sm" ? "56px" : "64px"}
          />
          <Box className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-background/95 p-0.5 text-foreground shadow-sm ring-1 ring-border/70" />
        </div>
      );
    }

    return (
      <div className="relative flex h-full w-full items-center justify-center bg-muted/70 text-foreground">
        <Box className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
        <Box className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-background/95 p-0.5 text-foreground shadow-sm ring-1 ring-border/70" />
      </div>
    );
  }

  return (
    <AppImage
      src={item.url}
      alt={item.alt || `${productName} thumbnail`}
      fill
      className={size === "sm" ? "object-contain p-1" : "object-contain p-1.5"}
      loading="lazy"
      sizes={size === "sm" ? "56px" : "64px"}
    />
  );
}
