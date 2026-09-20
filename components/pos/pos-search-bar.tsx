"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  ScanBarcode,
  Camera,
  Calculator,
  Fullscreen,
  Minimize,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BarcodeCameraDialog } from "@/components/pos/barcode-camera-dialog";
import { POSCalculatorDialog } from "@/components/pos/pos-calculator-dialog";
import type { POSVendorFilterOption } from "@/components/pos/pos-types";

export type POSStockStatusFilter = "all" | "in_stock" | "out_of_stock";
export type POSSourceFilter = "all" | "admin" | "vendor";

export type POSScanSource = "hardware" | "camera";
export type POSScanFeedback = {
  status: "success" | "error";
  code: string;
  message: string;
  detail?: string;
};

export interface POSSearchBarProps {
  // Search
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;

  // Scan
  scanQuery: string;
  onScanQueryChange: (value: string) => void;
  onScanKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  scanInputRef: React.RefObject<HTMLInputElement | null>;
  isScanResolving: boolean;
  scanQueueLength: number;
  lastScanFeedback: POSScanFeedback | null;
  onOpenCameraScanner: () => void;
  showCameraScanner: boolean;
  onCameraOpenChange: (open: boolean) => void;
  onCameraScan: (code: string, source?: POSScanSource) => void;

  // Filters
  stockStatus: POSStockStatusFilter;
  onStockStatusChange: (value: POSStockStatusFilter) => void;
  selectedSource: POSSourceFilter;
  onSourceChange: (value: POSSourceFilter) => void;
  selectedVendor: string;
  onVendorChange: (value: string) => void;
  vendors: POSVendorFilterOption[];
}

export function POSSearchBar({
  searchQuery,
  onSearchChange,
  searchInputRef,
  scanQuery,
  onScanQueryChange,
  onScanKeyDown,
  scanInputRef,
  isScanResolving,
  scanQueueLength,
  lastScanFeedback,
  onOpenCameraScanner,
  showCameraScanner,
  onCameraOpenChange,
  onCameraScan,
  stockStatus,
  onStockStatusChange,
  selectedSource,
  onSourceChange,
  selectedVendor,
  onVendorChange,
  vendors,
}: POSSearchBarProps) {
  const t = useTranslations();
  const [showCalculatorDialog, setShowCalculatorDialog] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = React.useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Browsers can reject fullscreen when unavailable or blocked.
    }
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key.toLowerCase() === "c" &&
        !showCameraScanner &&
        !showCalculatorDialog
      ) {
        event.preventDefault();
        setShowCalculatorDialog(true);
        return;
      }

      if (event.key === "F8" && !showCameraScanner && !showCalculatorDialog) {
        event.preventDefault();
        scanInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scanInputRef, showCalculatorDialog, showCameraScanner]);

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-2.5">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          {/* Search products */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              ref={searchInputRef}
              placeholder="Search products by name / SKU..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-card pl-11 pr-11 text-sm placeholder:text-muted-foreground/60 transition-all focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            {searchQuery ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full hover:bg-muted"
                onClick={() => onSearchChange("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>

          {/* Scan barcode */}
          <div className="relative w-full xl:w-[260px]">
            <ScanBarcode className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  ref={scanInputRef}
                  placeholder="Scan SKU or barcode..."
                  value={scanQuery}
                  onChange={(e) => onScanQueryChange(e.target.value)}
                  onKeyDown={onScanKeyDown}
                  className="h-10 rounded-xl border border-border/60 bg-card pl-11 pr-14 font-mono text-sm tracking-[0.12em] placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground/60 transition-all focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </TooltipTrigger>
              <TooltipContent>Scan SKU and Barcode</TooltipContent>
            </Tooltip>
            {!scanQuery ? (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-xs">
                F8
              </span>
            ) : null}
            {scanQuery ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full hover:bg-muted"
                onClick={() => onScanQueryChange("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>

          {/* Camera button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={onOpenCameraScanner}
                aria-label="Scan with Camera"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Scan with Camera</TooltipContent>
          </Tooltip>

          {/* Calculator button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => setShowCalculatorDialog(true)}
                aria-label="Calculator ALT+C"
              >
                <Calculator className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Calculator ALT+C</TooltipContent>
          </Tooltip>

          {/* Fullscreen button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => void toggleFullscreen()}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Fullscreen className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            </TooltipContent>
          </Tooltip>

          {/* Ready to scan status */}
          <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {isScanResolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanBarcode className="h-3.5 w-3.5" />
            )}
            <span>{isScanResolving ? "Resolving" : "Ready to scan"}</span>
            {scanQueueLength > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-mono">
                +{scanQueueLength}
              </span>
            ) : null}
          </div>

          {/* Stock filter */}
          <Select
            value={stockStatus}
            onValueChange={(value) =>
              onStockStatusChange(value as POSStockStatusFilter)
            }
          >
            <SelectTrigger className="h-10 w-full shrink-0 rounded-lg border border-border/60 bg-card text-sm shadow-xs hover:bg-muted/40 transition-colors xl:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in_stock">In stock</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
            </SelectContent>
          </Select>

          {/* Source filter */}
          <Select
            value={selectedSource}
            onValueChange={(value) => onSourceChange(value as POSSourceFilter)}
          >
            <SelectTrigger className="h-10 w-full shrink-0 rounded-lg border border-border/60 bg-card text-sm shadow-xs hover:bg-muted/40 transition-colors xl:w-[158px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="admin">Admin products</SelectItem>
              <SelectItem value="vendor">Vendor products</SelectItem>
            </SelectContent>
          </Select>

          {/* Vendor filter */}
          {vendors.length > 0 ? (
            <Select value={selectedVendor} onValueChange={onVendorChange}>
              <SelectTrigger className="h-10 w-full shrink-0 rounded-lg border border-border/60 bg-card text-sm shadow-xs hover:bg-muted/40 transition-colors xl:w-[178px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor._id} value={vendor._id}>
                    {vendor.storeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {lastScanFeedback ? (
          <div
            className={cn(
              "mt-2 inline-flex h-8 max-w-full items-center gap-2 rounded-full border px-3 text-xs font-medium",
              lastScanFeedback.status === "success"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            <span className="truncate">
              {lastScanFeedback.status === "success"
                ? "Last scanned"
                : "Scan issue"}
              : {lastScanFeedback.message}
            </span>
            <span className="shrink-0 font-mono opacity-70">
              {lastScanFeedback.code}
            </span>
          </div>
        ) : null}
      </div>

      <BarcodeCameraDialog
        open={showCameraScanner}
        onOpenChange={onCameraOpenChange}
        onScan={onCameraScan}
        isResolving={isScanResolving}
      />
      <POSCalculatorDialog
        open={showCalculatorDialog}
        onOpenChange={setShowCalculatorDialog}
      />
    </>
  );
}
