"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { POSTerminal } from "@/components/pos/pos-terminal";
import { POSSearchBar } from "@/components/pos/pos-search-bar";
import { toast } from "@/components/ui/toast-notification";
import { playPOSSound, configurePOSSounds } from "@/lib/pos-sounds";
import { cleanScannedCode } from "@/lib/barcodes";
import type { POSSettings } from "@/lib/pos/build-pos-settings";
import type {
  POSProduct,
  POSVendorFilterOption,
  POSVariant,
  POSCartItem,
  POSCategory,
} from "@/components/pos/pos-types";

type POSStockStatusFilter = "all" | "in_stock" | "out_of_stock";
type POSSourceFilter = "all" | "admin" | "vendor";
type POSScanSource = "hardware" | "camera";
type POSScanQueueItem = { code: string; source: POSScanSource };
type POSScanFeedback = {
  status: "success" | "error";
  code: string;
  message: string;
  detail?: string;
};
type POSBarcodeApiResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: {
    status?: "matched";
    match?: {
      field: "barcode" | "sku";
      scope: "product" | "variant";
      product: POSProduct;
      variant?: POSVariant;
    };
  };
};

interface POSWorkspaceProps {
  settings: POSSettings;
}

export function POSWorkspace({ settings }: POSWorkspaceProps) {
  const t = useTranslations();

  // Search state (lifted from POSTerminal)
  const [searchQuery, setSearchQuery] = React.useState("");
  const [scanQuery, setScanQuery] = React.useState("");
  const [stockStatus, setStockStatus] =
    React.useState<POSStockStatusFilter>("all");
  const [selectedSource, setSelectedSource] =
    React.useState<POSSourceFilter>("all");
  const [selectedVendor, setSelectedVendor] = React.useState("all");
  const [vendors, setVendors] = React.useState<POSVendorFilterOption[]>([]);

  // Scan state
  const [isScanResolving, setIsScanResolving] = React.useState(false);
  const [showCameraScanner, setShowCameraScanner] = React.useState(false);
  const [scanQueueLength, setScanQueueLength] = React.useState(0);
  const [lastScanFeedback, setLastScanFeedback] =
    React.useState<POSScanFeedback | null>(null);

  // Refs
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const scanInputRef = React.useRef<HTMLInputElement>(null);
  const scanQueueRef = React.useRef<POSScanQueueItem[]>([]);
  const isScanResolvingRef = React.useRef(false);

  // Cart state (passed to POSTerminal)
  const [cart, setCart] = React.useState<POSCartItem[]>([]);
  const [products, setProducts] = React.useState<POSProduct[]>([]);
  const [categories, setCategories] = React.useState<POSCategory[]>([]);

  // Configure POS sounds
  React.useEffect(() => {
    if (settings.sound) {
      configurePOSSounds(settings.sound);
    }
  }, [settings.sound]);

  // Add to cart (used by scan logic)
  const addToCart = React.useCallback(
    (product: POSProduct, variant?: POSVariant) => {
      const itemId = variant ? `${product._id}-${variant._id}` : product._id;
      const price = variant ? variant.price : product.price;
      const maxStock = variant ? variant.stock : product.stock;
      const image = variant?.image || product.images?.[0];

      let added = false;
      setCart((prev) => {
        const existing = prev.find((item) => item.id === itemId);
        if (existing) {
          if (existing.quantity >= maxStock) {
            toast.error(t("pos.outOfStock"));
            playPOSSound("error");
            return prev;
          }
          added = true;
          return prev.map((item) =>
            item.id === itemId
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        if (maxStock <= 0) {
          toast.error(t("pos.outOfStock"));
          playPOSSound("error");
          return prev;
        }
        added = true;
        return [
          ...prev,
          {
            id: itemId,
            productId: product._id,
            variantId: variant?._id,
            name: product.name,
            variantName: variant?.name,
            sku: variant?.sku || product.sku,
            price,
            quantity: 1,
            image,
            vendorId: product.vendorId,
            maxStock,
          },
        ];
      });
      if (added) playPOSSound("addToCart");
    },
    [t],
  );

  // Scan logic
  const resolveSingleScan = React.useCallback(
    async ({ code }: POSScanQueueItem) => {
      const params = new URLSearchParams({ code });
      if (settings.posLocationId) {
        params.set("locationId", settings.posLocationId);
      }

      try {
        const res = await fetch(`/api/pos/barcode?${params.toString()}`);
        const json = (await res.json()) as POSBarcodeApiResponse;
        const match = json.data?.match;

        if (!res.ok || !json.success || !match?.product) {
          const message =
            json.code === "MULTIPLE_MATCHES"
              ? "Multiple products match this code. Please fix duplicate SKU or barcode values."
              : json.code === "OUT_OF_STOCK"
                ? t("pos.outOfStock")
                : json.code === "NO_MATCH"
                  ? "No product found for the scanned code."
                  : json.message || "Unable to look up the scanned code.";

          playPOSSound("error");
          toast.error(message);
          setLastScanFeedback({
            status: "error",
            code,
            message,
            detail: json.code,
          });
          return;
        }

        addToCart(match.product, match.variant);
        const itemName = match.variant?.name
          ? `${match.product.name} - ${match.variant.name}`
          : match.product.name;
        setLastScanFeedback({
          status: "success",
          code,
          message: itemName,
          detail: match.field.toUpperCase(),
        });
        setScanQuery("");
        scanInputRef.current?.focus();
      } catch {
        const message = "Unable to look up the scanned code.";
        playPOSSound("error");
        toast.error(message);
        setLastScanFeedback({
          status: "error",
          code,
          message,
          detail: "LOOKUP_FAILED",
        });
      }
    },
    [addToCart, settings.posLocationId, t],
  );

  const processScanQueue = React.useCallback(async () => {
    if (isScanResolvingRef.current) return;

    const nextScan = scanQueueRef.current.shift();
    setScanQueueLength(scanQueueRef.current.length);
    if (!nextScan) return;

    isScanResolvingRef.current = true;
    setIsScanResolving(true);
    try {
      await resolveSingleScan(nextScan);
    } finally {
      isScanResolvingRef.current = false;
      setIsScanResolving(false);
      if (scanQueueRef.current.length > 0) {
        window.setTimeout(() => void processScanQueue(), 0);
      }
    }
  }, [resolveSingleScan]);

  const enqueueScannedCode = React.useCallback(
    (rawCode: string, source: POSScanSource = "hardware") => {
      const code = cleanScannedCode(rawCode);
      if (!code) return;

      scanQueueRef.current = [
        ...scanQueueRef.current.slice(-4),
        { code, source },
      ];
      setScanQueueLength(scanQueueRef.current.length);
      void processScanQueue();
    },
    [processScanQueue],
  );

  const handleScanKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      enqueueScannedCode(event.currentTarget.value, "hardware");
      setScanQuery("");
    },
    [enqueueScannedCode],
  );

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-muted/40 p-2 sm:p-3">
      {/* Search bar - outside the products card */}
      <POSSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        scanQuery={scanQuery}
        onScanQueryChange={setScanQuery}
        onScanKeyDown={handleScanKeyDown}
        scanInputRef={scanInputRef}
        isScanResolving={isScanResolving}
        scanQueueLength={scanQueueLength}
        lastScanFeedback={lastScanFeedback}
        onOpenCameraScanner={() => setShowCameraScanner(true)}
        showCameraScanner={showCameraScanner}
        onCameraOpenChange={setShowCameraScanner}
        onCameraScan={(code) => enqueueScannedCode(code, "camera")}
        stockStatus={stockStatus}
        onStockStatusChange={setStockStatus}
        selectedSource={selectedSource}
        onSourceChange={setSelectedSource}
        selectedVendor={selectedVendor}
        onVendorChange={setSelectedVendor}
        vendors={vendors}
      />
      {/* Products card - flex fills remaining height, no forced height */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm sm:mt-3">
        <POSTerminalControlled
          settings={settings}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          stockStatus={stockStatus}
          setStockStatus={setStockStatus}
          selectedSource={selectedSource}
          setSelectedSource={setSelectedSource}
          selectedVendor={selectedVendor}
          setSelectedVendor={setSelectedVendor}
          vendors={vendors}
          setVendors={setVendors}
          cart={cart}
          setCart={setCart}
          products={products}
          setProducts={setProducts}
          categories={categories}
          setCategories={setCategories}
          addToCart={addToCart}
        />
      </div>
    </div>
  );
}

// Wrapper that passes controlled state to POSTerminal
interface POSTerminalControlledProps {
  settings: POSSettings;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  stockStatus: POSStockStatusFilter;
  setStockStatus: (value: POSStockStatusFilter) => void;
  selectedSource: POSSourceFilter;
  setSelectedSource: (value: POSSourceFilter) => void;
  selectedVendor: string;
  setSelectedVendor: (value: string) => void;
  vendors: POSVendorFilterOption[];
  setVendors: (value: POSVendorFilterOption[]) => void;
  cart: POSCartItem[];
  setCart: React.Dispatch<React.SetStateAction<POSCartItem[]>>;
  products: POSProduct[];
  setProducts: React.Dispatch<React.SetStateAction<POSProduct[]>>;
  categories: POSCategory[];
  setCategories: React.Dispatch<React.SetStateAction<POSCategory[]>>;
  addToCart: (product: POSProduct, variant?: POSVariant) => void;
}

function POSTerminalControlled({
  settings,
  searchQuery,
  setSearchQuery,
  stockStatus,
  setStockStatus,
  selectedSource,
  setSelectedSource,
  selectedVendor,
  setSelectedVendor,
  vendors,
  setVendors,
  cart,
  setCart,
  products,
  setProducts,
  categories,
  setCategories,
  addToCart: externalAddToCart,
}: POSTerminalControlledProps) {
  return (
    <POSTerminal
      settings={settings}
      controlledState={{
        searchQuery,
        setSearchQuery,
        stockStatus,
        setStockStatus,
        selectedSource,
        setSelectedSource,
        selectedVendor,
        setSelectedVendor,
        vendors,
        setVendors,
        cart,
        setCart,
        products,
        setProducts,
        categories,
        setCategories,
        addToCart: externalAddToCart,
      }}
    />
  );
}
