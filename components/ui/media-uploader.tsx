"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Video,
  Box,
  Star,
  Trash2,
  RefreshCw,
  GripVertical,
  AlertCircle,
  Wand2,
  Sparkles,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { ModelViewer } from "./model-viewer";

export type UploadedMedia = {
  _id: string;
  url: string;
  type: "image" | "video" | "model";
  mimeType: string;
  filename?: string;
  alt?: string;
  position?: number;
  size?: number;
  width?: number;
  height?: number;
};

interface MediaUploaderProps {
  value: UploadedMedia[];
  onChange: (value: UploadedMedia[]) => void;
  maxFiles?: number;
  acceptTypes?: ("image" | "video" | "model")[];
  accept?: string;
  allowedFileExtensions?: string[];
  disabled?: boolean;
  className?: string;
  uploadTitle?: ReactNode;
  uploadDescription?: ReactNode;
  sizeGuide?: ReactNode;
  uploadZoneClassName?: string;
  mediaGridClassName?: string;
  previewAspectRatio?: string;
  previewFit?: "cover" | "contain";
  previewTileClassName?: string;
  showCoverBadge?: boolean;
  coverHint?: ReactNode | false;
  aiGenerateAction?: ReactNode;
  /** When set, images show an "Edit with AI" action that calls this handler. */
  onEditWithAi?: (media: UploadedMedia) => void;
  /** When set, the detail modal offers AI alt-text; resolves to the text. */
  onGenerateAlt?: (media: UploadedMedia) => Promise<string | null>;
  hideUploadZoneWhenFull?: boolean;
  showFileCount?: boolean;
  // Soft client-side limits (server still enforces). Defaults match Shopify:
  // 20MB image, 1024MB (1GB) video, 500MB 3D model.
  maxImageSizeMB?: number;
  maxVideoSizeMB?: number;
  maxModelSizeMB?: number;
}

const ACCEPT_MAP: Record<string, string> = {
  image:
    "image/*,.jpg,.jpeg,.png,.gif,.webp,.svg,.avif,.heic,.heif,.bmp,.tiff,.ico",
  video: "video/*,.mp4,.webm,.ogg,.mov,.avi,.mkv",
  model: ".glb,.gltf,model/gltf-binary,model/gltf+json,application/octet-stream",
};

type MediaKind = "image" | "video" | "model";

type PendingUpload = {
  tempId: string;
  file: File;
  status: "uploading" | "error";
  error?: string;
  // Local object URL so the tile can preview while uploading.
  previewUrl: string;
  kind: MediaKind;
};

function detectKind(file: File): MediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) return "model";
  return "image";
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileExtension(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext && ext !== filename.toLowerCase() ? ext : "";
}

function getDefaultUploadDescription(acceptTypes: MediaKind[]) {
  if (acceptTypes.length === 1 && acceptTypes[0] === "image") {
    return "Images only. Paste with Ctrl+V.";
  }
  if (acceptTypes.length === 1 && acceptTypes[0] === "video") {
    return "Videos only. Paste with Ctrl+V.";
  }
  if (acceptTypes.length === 1 && acceptTypes[0] === "model") {
    return "3D models only. Paste with Ctrl+V.";
  }
  if (acceptTypes.length === 2 && acceptTypes.includes("image") && acceptTypes.includes("video")) {
    return "Images and videos. Paste with Ctrl+V.";
  }
  return "Images, videos, and 3D models. Paste with Ctrl+V.";
}

export function MediaUploader({
  value,
  onChange,
  maxFiles = 10,
  acceptTypes = ["image", "video", "model"],
  accept,
  allowedFileExtensions,
  disabled = false,
  className,
  uploadTitle = "Drag and drop files here, or click to browse",
  uploadDescription,
  sizeGuide,
  uploadZoneClassName,
  mediaGridClassName,
  previewAspectRatio,
  previewFit = "cover",
  previewTileClassName,
  showCoverBadge = true,
  coverHint = "First image is the storefront cover",
  aiGenerateAction,
  onEditWithAi,
  onGenerateAlt,
  hideUploadZoneWhenFull = true,
  showFileCount,
  maxImageSizeMB = 20,
  maxVideoSizeMB = 1024,
  maxModelSizeMB = 500,
}: MediaUploaderProps) {
  const t = useTranslations();
  const [isDragging, setIsDragging] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeMedia, setActiveMedia] = useState<UploadedMedia | null>(null);
  const [topLevelError, setTopLevelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const normalizedAllowedExtensions = useMemo(
    () =>
      allowedFileExtensions?.map((ext) =>
        ext.replace(/^\./, "").toLowerCase(),
      ),
    [allowedFileExtensions],
  );
  const acceptString =
    accept ??
    (normalizedAllowedExtensions?.length
      ? normalizedAllowedExtensions.map((ext) => `.${ext}`).join(",")
      : acceptTypes.map((t) => ACCEPT_MAP[t]).join(","));
  const resolvedUploadDescription =
    uploadDescription ?? getDefaultUploadDescription(acceptTypes);
  const sortedValue = useMemo(
    () => [...value].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [value],
  );
  const totalCount = sortedValue.length + pendingUploads.length;
  const remainingSlots = Math.max(0, maxFiles - totalCount);
  const shouldShowUploadZone = !hideUploadZoneWhenFull || remainingSlots > 0;
  const shouldShowFileCount = showFileCount ?? maxFiles > 1;

  // Reflect new value into selection: drop ids no longer present.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      const existing = new Set(value.map((m) => m._id));
      prev.forEach((id) => existing.has(id) && next.add(id));
      return next;
    });
  }, [value]);

  const validate = useCallback(
    (file: File): string | null => {
      const kind = detectKind(file);
      const sizeMB = file.size / 1024 / 1024;
      const limit =
        kind === "image"
          ? maxImageSizeMB
          : kind === "video"
            ? maxVideoSizeMB
            : maxModelSizeMB;
      if (sizeMB > limit) {
        return `File too large (${sizeMB.toFixed(1)}MB > ${limit}MB limit)`;
      }
      if (!acceptTypes.includes(kind)) {
        return `${kind} files are not allowed here`;
      }
      if (normalizedAllowedExtensions?.length) {
        const extension = getFileExtension(file.name);
        if (!extension || !normalizedAllowedExtensions.includes(extension)) {
          return `Only ${normalizedAllowedExtensions
            .map((ext) => ext.toUpperCase())
            .join(", ")} files are allowed`;
        }
      }
      return null;
    },
    [
      acceptTypes,
      maxImageSizeMB,
      maxVideoSizeMB,
      maxModelSizeMB,
      normalizedAllowedExtensions,
    ],
  );

  const uploadOne = useCallback(
    async (pending: PendingUpload) => {
      try {
        const formData = new FormData();
        formData.append("files", pending.file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const result = await res.json();

        if (!result.success || !Array.isArray(result.data) || !result.data[0]) {
          throw new Error(
            result.errors?.length
              ? result.errors.join(", ")
              : result.message || "Upload failed",
          );
        }

        const item: UploadedMedia = {
          ...result.data[0],
          // Append at the end of the gallery preserving order of completion.
          position: value.length + 1000,
        };

        // Functional update so concurrent uploads don't clobber each other.
        onChange(
          // Inline normalization of positions happens after — we let the
          // settled state do that via a separate effect by always sorting.
          [...value, item].map((m, idx) => ({ ...m, position: idx })),
        );

        URL.revokeObjectURL(pending.previewUrl);
        setPendingUploads((prev) =>
          prev.filter((p) => p.tempId !== pending.tempId),
        );
      } catch (err) {
        setPendingUploads((prev) =>
          prev.map((p) =>
            p.tempId === pending.tempId
              ? {
                  ...p,
                  status: "error",
                  error:
                    err instanceof Error ? err.message : "Upload failed",
                }
              : p,
          ),
        );
      }
    },
    [onChange, value],
  );

  const enqueueFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || disabled) return;
      const arr = Array.from(files);
      if (arr.length === 0) return;

      setTopLevelError(null);

      if (remainingSlots <= 0) {
        setTopLevelError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const accepted: PendingUpload[] = [];
      const rejected: string[] = [];

      for (const file of arr.slice(0, remainingSlots)) {
        const error = validate(file);
        if (error) {
          rejected.push(`${file.name}: ${error}`);
          continue;
        }
        accepted.push({
          tempId: crypto.randomUUID(),
          file,
          status: "uploading",
          previewUrl: URL.createObjectURL(file),
          kind: detectKind(file),
        });
      }

      if (rejected.length > 0) {
        setTopLevelError(rejected.join(" · "));
      }
      if (accepted.length === 0) return;

      setPendingUploads((prev) => [...prev, ...accepted]);
      // Fire all uploads in parallel — each manages its own state.
      accepted.forEach((p) => {
        uploadOne(p);
      });
    },
    [disabled, maxFiles, remainingSlots, uploadOne, validate],
  );

  const handleRetry = useCallback(
    (tempId: string) => {
      const target = pendingUploads.find((p) => p.tempId === tempId);
      if (!target) return;
      setPendingUploads((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, status: "uploading", error: undefined }
            : p,
        ),
      );
      uploadOne({ ...target, status: "uploading", error: undefined });
    },
    [pendingUploads, uploadOne],
  );

  const handleDismissPending = useCallback((tempId: string) => {
    setPendingUploads((prev) => {
      const target = prev.find((p) => p.tempId === tempId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.tempId !== tempId);
    });
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      onChange(
        value
          .filter((m) => m._id !== id)
          .map((m, idx) => ({ ...m, position: idx })),
      );
    },
    [onChange, value],
  );

  const handleBulkDelete = useCallback(() => {
    onChange(
      value
        .filter((m) => !selected.has(m._id))
        .map((m, idx) => ({ ...m, position: idx })),
    );
    setSelected(new Set());
  }, [onChange, value, selected]);

  const handleSetCover = useCallback(
    (id: string) => {
      const target = value.find((m) => m._id === id);
      if (!target) return;
      const rest = value.filter((m) => m._id !== id);
      onChange(
        [target, ...rest].map((m, idx) => ({ ...m, position: idx })),
      );
    },
    [onChange, value],
  );

  const handleUpdateAlt = useCallback(
    (id: string, alt: string) => {
      onChange(value.map((m) => (m._id === id ? { ...m, alt } : m)));
      setActiveMedia((curr) =>
        curr && curr._id === id ? { ...curr, alt } : curr,
      );
    },
    [onChange, value],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sortedValue.findIndex((m) => m._id === active.id);
      const newIndex = sortedValue.findIndex((m) => m._id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(sortedValue, oldIndex, newIndex).map(
        (m, idx) => ({ ...m, position: idx }),
      );
      onChange(reordered);
    },
    [onChange, sortedValue],
  );

  // Drag-and-drop on the upload zone.
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      enqueueFiles(e.dataTransfer.files);
    },
    [enqueueFiles],
  );
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      enqueueFiles(e.target.files);
      e.target.value = "";
    },
    [enqueueFiles],
  );

  // Paste from clipboard support — listens globally only when the upload
  // zone is focused or hovered, to avoid hijacking pastes elsewhere on the
  // page.
  useEffect(() => {
    if (!shouldShowUploadZone) return;

    const handler = (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        enqueueFiles(files);
      }
    };
    const node = dropZoneRef.current;
    if (!node) return;
    node.addEventListener("paste", handler as EventListener);
    return () => node.removeEventListener("paste", handler as EventListener);
  }, [disabled, enqueueFiles, shouldShowUploadZone]);

  // Cleanup any object URLs left over on unmount.
  useEffect(() => {
    return () => {
      pendingUploads.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {aiGenerateAction ? (
        <div className="flex justify-end">{aiGenerateAction}</div>
      ) : null}

      {/* Bulk action bar — only when something is selected */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {t("admin.productForm.media.selected", {
              count: selected.size,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              {t("common.clear")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t("admin.productForm.media.deleteSelected")}
            </Button>
          </div>
        </div>
      )}

      {shouldShowUploadZone ? (
        <div
          ref={dropZoneRef}
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative rounded-lg border-2 border-dashed p-6 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "pointer-events-none opacity-50",
            uploadZoneClassName,
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={remainingSlots > 1}
            accept={acceptString}
            onChange={handleFileSelect}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{uploadTitle}</p>
              {resolvedUploadDescription ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {resolvedUploadDescription}
                </p>
              ) : null}
              {sizeGuide ? (
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {sizeGuide}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {topLevelError && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {topLevelError}
        </p>
      )}

      {/* Media grid (sortable) + pending tiles */}
      {(sortedValue.length > 0 || pendingUploads.length > 0) && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedValue.map((m) => m._id)}
            strategy={rectSortingStrategy}
          >
            <div
              className={cn(
                "grid grid-cols-2 gap-3 md:grid-cols-4",
                mediaGridClassName,
              )}
            >
              {sortedValue.map((media, idx) => (
                <SortableTile
                  key={media._id}
                  media={media}
                  isCover={idx === 0}
                  isSelected={selected.has(media._id)}
                  previewAspectRatio={previewAspectRatio}
                  previewFit={previewFit}
                  previewTileClassName={previewTileClassName}
                  showCoverBadge={showCoverBadge}
                  onToggleSelect={() => toggleSelect(media._id)}
                  onOpen={() => setActiveMedia(media)}
                  onRemove={() => handleRemove(media._id)}
                  onSetCover={() => handleSetCover(media._id)}
                  onEditWithAi={onEditWithAi}
                />
              ))}
              {pendingUploads.map((pending) => (
                <PendingTile
                  key={pending.tempId}
                  pending={pending}
                  previewAspectRatio={previewAspectRatio}
                  previewFit={previewFit}
                  previewTileClassName={previewTileClassName}
                  onRetry={() => handleRetry(pending.tempId)}
                  onDismiss={() => handleDismissPending(pending.tempId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {shouldShowFileCount ? (
        <p className="text-xs text-muted-foreground">
          {totalCount} / {maxFiles} files
          {sortedValue.length > 0 && coverHint && (
            <span> · {coverHint}</span>
          )}
        </p>
      ) : null}

      {/* Detail / edit modal */}
      <MediaDetailModal
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
        onUpdateAlt={handleUpdateAlt}
        onDelete={(id) => {
          handleRemove(id);
          setActiveMedia(null);
        }}
        onSetCover={(id) => {
          handleSetCover(id);
          setActiveMedia(null);
        }}
        onEditWithAi={
          onEditWithAi
            ? (media) => {
                onEditWithAi(media);
                setActiveMedia(null);
              }
            : undefined
        }
        onGenerateAlt={onGenerateAlt}
        canSetCover={
          activeMedia
            ? sortedValue[0]?._id !== activeMedia._id
            : false
        }
      />
    </div>
  );
}

function MediaTypeIcon({ type }: { type: MediaKind }) {
  if (type === "video") return <Video className="h-3.5 w-3.5" />;
  if (type === "model") return <Box className="h-3.5 w-3.5" />;
  return <ImageIcon className="h-3.5 w-3.5" />;
}

function MediaThumb({
  media,
  fit = "cover",
  className,
}: {
  media: UploadedMedia;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const objectFitClass = fit === "contain" ? "object-contain" : "object-cover";

  if (media.type === "image") {
    return (
      <img
        src={media.url}
        alt={media.alt || ""}
        className={cn("h-full w-full", objectFitClass, className)}
      />
    );
  }
  if (media.type === "video") {
    return (
      <video
        src={media.url}
        muted
        playsInline
        className={cn("h-full w-full", objectFitClass, className)}
      />
    );
  }
  // 3D model — interactive viewer.
  return (
    <ModelViewer
      src={media.url}
      alt={media.alt || media.filename || "3D model"}
      className={className}
      // In the small grid tile, show preview without forcing user interaction.
      autoRotate
      cameraControls={false}
    />
  );
}

function SortableTile({
  media,
  isCover,
  isSelected,
  onToggleSelect,
  onOpen,
  onRemove,
  onSetCover,
  onEditWithAi,
  previewAspectRatio,
  previewFit,
  previewTileClassName,
  showCoverBadge,
}: {
  media: UploadedMedia;
  isCover: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onSetCover: () => void;
  onEditWithAi?: (media: UploadedMedia) => void;
  previewAspectRatio?: string;
  previewFit: "cover" | "contain";
  previewTileClassName?: string;
  showCoverBadge: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media._id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    aspectRatio: previewAspectRatio,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-muted",
        !previewAspectRatio && "aspect-square",
        isDragging && "z-10 opacity-60 shadow-lg",
        isSelected && "ring-2 ring-primary",
        previewTileClassName,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 h-full w-full"
        aria-label="Open media details"
      >
        <MediaThumb media={media} fit={previewFit} />
      </button>

      {/* Drag handle (top-right, only on hover so it doesn't fight checkbox) */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 z-10 cursor-grab rounded bg-background/80 p-1 opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Selection checkbox (top-left) */}
      <label
        className={cn(
          "absolute left-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border bg-background/80 backdrop-blur-sm transition-opacity",
          isSelected
            ? "border-primary opacity-100"
            : "border-input opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="peer sr-only"
        />
        {isSelected && (
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3 fill-none stroke-primary stroke-[2]"
          >
            <path d="M2 6.5l3 3 5-7" strokeLinecap="round" />
          </svg>
        )}
      </label>

      {/* Cover badge (bottom-left, persistent) */}
      {showCoverBadge && isCover && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-medium text-background backdrop-blur-sm">
          <Star className="h-3 w-3 fill-current" />
          Cover
        </div>
      )}

      {/* Type badge (bottom-right) */}
      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] backdrop-blur-sm">
        <MediaTypeIcon type={media.type} />
      </div>

      {/* Quick actions row — appears on hover, doesn't block click-to-open */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-1 bg-gradient-to-b from-black/50 to-transparent px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        {onEditWithAi && media.type === "image" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditWithAi(media);
            }}
            className="pointer-events-auto flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium hover:bg-background"
            aria-label="Edit with AI"
          >
            <Wand2 className="h-3 w-3" />
            Edit
          </button>
        )}
        {!isCover && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetCover();
            }}
            className="pointer-events-auto rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium hover:bg-background"
          >
            Set as cover
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="pointer-events-auto rounded bg-destructive/90 px-1 py-0.5 text-destructive-foreground hover:bg-destructive"
          aria-label="Delete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PendingTile({
  pending,
  onRetry,
  onDismiss,
  previewAspectRatio,
  previewFit,
  previewTileClassName,
}: {
  pending: PendingUpload;
  onRetry: () => void;
  onDismiss: () => void;
  previewAspectRatio?: string;
  previewFit: "cover" | "contain";
  previewTileClassName?: string;
}) {
  const isError = pending.status === "error";
  return (
    <div
      style={{ aspectRatio: previewAspectRatio }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-muted",
        !previewAspectRatio && "aspect-square",
        isError && "border-destructive",
        previewTileClassName,
      )}
    >
      {pending.kind === "image" ? (
        <img
          src={pending.previewUrl}
          alt=""
          className={cn(
            "h-full w-full opacity-60",
            previewFit === "contain" ? "object-contain" : "object-cover",
          )}
        />
      ) : pending.kind === "video" ? (
        <video
          src={pending.previewUrl}
          muted
          playsInline
          className={cn(
            "h-full w-full opacity-60",
            previewFit === "contain" ? "object-contain" : "object-cover",
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Box className="h-12 w-12 text-muted-foreground" />
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px]">
        {!isError ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-2 text-xs font-medium">Uploading…</p>
            <p className="mt-0.5 truncate px-2 text-[10px] text-muted-foreground">
              {pending.file.name}
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="mt-2 text-xs font-medium">Upload failed</p>
            <p className="mt-0.5 truncate px-2 text-[10px] text-muted-foreground">
              {pending.error}
            </p>
            <div className="mt-2 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1 h-3 w-3" /> Retry
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MediaDetailModal({
  media,
  onClose,
  onUpdateAlt,
  onDelete,
  onSetCover,
  onEditWithAi,
  onGenerateAlt,
  canSetCover,
}: {
  media: UploadedMedia | null;
  onClose: () => void;
  onUpdateAlt: (id: string, alt: string) => void;
  onDelete: (id: string) => void;
  onSetCover: (id: string) => void;
  onEditWithAi?: (media: UploadedMedia) => void;
  onGenerateAlt?: (media: UploadedMedia) => Promise<string | null>;
  canSetCover: boolean;
}) {
  const [naturalDims, setNaturalDims] = useState<{
    mediaId: string;
    w: number;
    h: number;
  } | null>(null);
  const [generatingAlt, setGeneratingAlt] = useState(false);

  const generateAlt = async (target: UploadedMedia) => {
    if (!onGenerateAlt || generatingAlt) return;
    setGeneratingAlt(true);
    try {
      const alt = await onGenerateAlt(target);
      if (alt) onUpdateAlt(target._id, alt);
    } finally {
      setGeneratingAlt(false);
    }
  };

  if (!media) return null;

  const currentNaturalDims =
    naturalDims?.mediaId === media._id ? naturalDims : null;

  return (
    <Dialog open={!!media} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {media.filename || "Media details"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted">
            {media.type === "image" ? (
              <img
                src={media.url}
                alt={media.alt || ""}
                onLoad={(e) =>
                  setNaturalDims({
                    mediaId: media._id,
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                className="max-h-full max-w-full object-contain"
              />
            ) : media.type === "video" ? (
              <video
                src={media.url}
                controls
                className="max-h-full max-w-full"
              />
            ) : (
              // Full interactive 3D viewer in the modal — drag to rotate,
              // scroll to zoom.
              <ModelViewer
                src={media.url}
                alt={media.alt || media.filename || "3D model"}
                autoRotate
                cameraControls
              />
            )}
          </div>

          <div className="space-y-4">
            {media.type === "image" && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Alt text
                  </label>
                  {onGenerateAlt ? (
                    <button
                      type="button"
                      disabled={generatingAlt}
                      onClick={() => generateAlt(media)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {generatingAlt ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Write with AI
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={media.alt || ""}
                  onChange={(e) => onUpdateAlt(media._id, e.target.value)}
                  placeholder="Describe this image for screen readers and SEO"
                  rows={3}
                  className="mt-1 w-full rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {!media.alt && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Alt text helps screen readers and search engines.
                  </p>
                )}
              </div>
            )}

            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium capitalize">{media.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Format</dt>
                <dd className="font-medium uppercase">
                  {media.mimeType.split("/")[1] || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-medium">{formatBytes(media.size)}</dd>
              </div>
              {(currentNaturalDims || (media.width && media.height)) && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd className="font-medium">
                    {currentNaturalDims
                      ? `${currentNaturalDims.w} × ${currentNaturalDims.h}`
                      : `${media.width} × ${media.height}`}
                  </dd>
                </div>
              )}
            </dl>

            <div className="space-y-2 pt-2">
              {onEditWithAi && media.type === "image" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onEditWithAi(media)}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  Edit with AI
                </Button>
              )}
              {canSetCover && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onSetCover(media._id)}
                >
                  <Star className="mr-1.5 h-3.5 w-3.5" />
                  Set as cover
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => onDelete(media._id)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
