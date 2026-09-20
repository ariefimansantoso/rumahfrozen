"use client";

import { useEffect, useState } from "react";
import { Layers, Loader2, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface GlobalVariantOption {
  _id: string;
  name: string;
  type: string;
  visual: string;
  values: { _id: string; value: string; colorCode?: string; image?: string }[];
}

function isHex(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

/**
 * A compact picker the product form uses to attach a pre-built global variant
 * (created under Products → Global Variants) as a product option, so option
 * sets like "Color" don't have to be retyped for every product.
 */
export function GlobalVariantPicker({
  existingOptionNames,
  onSelect,
}: {
  existingOptionNames: string[];
  onSelect: (variant: GlobalVariantOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<GlobalVariantOption[]>([]);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/global-variants");
        const json = await res.json();
        if (!cancelled && json?.success && Array.isArray(json.data)) {
          setVariants(
            json.data.map((raw: GlobalVariantOption) => ({
              _id: String(raw._id),
              name: raw.name,
              type: raw.type,
              visual: raw.visual,
              values: (raw.values ?? []).map((v) => ({
                _id: String(v._id),
                value: v.value,
                colorCode: v.colorCode,
                image: v.image,
              })),
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load global variants:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const takenNames = new Set(
    existingOptionNames.map((name) => name.trim().toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 py-1 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
        >
          <Layers className="h-4 w-4 rounded-full border border-current p-0.5" />
          Add from global variants
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Global variants</p>
          <p className="text-xs text-muted-foreground">
            Reuse a variant across products
          </p>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : variants.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No global variants yet.
              <br />
              Create one under Products → Global Variants.
            </div>
          ) : (
            variants.map((variant) => {
              const alreadyAdded = takenNames.has(variant.name.trim().toLowerCase());
              return (
                <button
                  key={variant._id}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => {
                    onSelect(variant);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                    alreadyAdded
                      ? "cursor-not-allowed opacity-60"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-medium">{variant.name}</span>
                    {alreadyAdded && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="size-3" /> Added
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {variant.values.slice(0, 8).map((value) => (
                      <span
                        key={value._id}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {variant.type === "color" && isHex(value.colorCode) && (
                          <span
                            aria-hidden
                            className="size-2 rounded-full border border-border"
                            style={{ backgroundColor: value.colorCode }}
                          />
                        )}
                        {value.value}
                      </span>
                    ))}
                    {variant.values.length > 8 && (
                      <span className="text-xs text-muted-foreground">
                        +{variant.values.length - 8}
                      </span>
                    )}
                    {variant.values.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No values
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
