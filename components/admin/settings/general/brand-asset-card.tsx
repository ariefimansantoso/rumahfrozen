"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";

type UploadResponse = {
  success?: boolean;
  message?: unknown;
  data?: unknown;
};

type UploadedFile = {
  url?: unknown;
  key?: unknown;
};

export function BrandAssetCard(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  alt: string;
  replaceText: string;
  maxSize: string;
  formats: string;
  recommended: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as UploadResponse;
      if (json?.success !== true) {
        const msg =
          typeof json?.message === "string" ? json.message : "Upload failed";
        setError(msg);
        return;
      }
      const items = Array.isArray(json.data) ? (json.data as unknown[]) : [];
      const first = (items[0] || {}) as UploadedFile;
      const url = typeof first.url === "string" ? first.url : "";
      if (!url) {
        setError("Upload failed");
        return;
      }
      props.onChange(url);
    } catch {
      setError("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const onPick = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const looksLikeImage =
      (file.type && file.type.startsWith("image/")) ||
      /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(file.name);
    if (!looksLikeImage) {
      setError("Please select an image file");
      return;
    }
    await uploadFile(file);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploading) return;
    void onPick(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <span className="text-sm font-semibold">{props.label}</span>

      <div
        className="relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 transition-colors cursor-pointer hover:border-primary/40 hover:bg-muted/30"
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void onPick(e.target.files)}
          disabled={isUploading}
          className="hidden"
          aria-label={`${props.label}-file`}
        />

        {props.value && (
          <div className="relative">
            <div className="h-16 w-16 overflow-hidden rounded-lg border bg-muted/50">
              <AppImage
                src={props.value}
                alt={props.alt}
                className="h-full w-full object-contain"
                width={64}
                height={64}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onChange("");
              }}
              disabled={isUploading}
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-transform hover:scale-110"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {isUploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}

        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {props.value
              ? props.replaceText
              : `Upload ${props.label.toLowerCase()}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag and drop or click to select
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Max size:</span>
          <span className="font-medium text-[8px]">{props.maxSize}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Formats:</span>
          <span className="font-medium text-[8px]">{props.formats}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Recommended:</span>
          <span className="font-medium text-[8px]">{props.recommended}</span>
        </div>
      </div>
    </div>
  );
}
