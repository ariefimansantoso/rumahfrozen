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
  Plus,
  Minus,
  Trash2,
  X,
  CreditCard,
  Banknote,
  FileText,
  ShoppingCart,
  Package,
  Printer,
  Receipt,
  Loader2,
  Hash,
  CircleCheckBig,
  Sparkles,
  UserPlus,
  UserCheck,
  Mail,
  Phone,
  Footprints,
  SlidersHorizontal,
  Tag,
  Bookmark,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, truncateByWords } from "@/lib/utils";
import { AppImage } from "@/components/ui/app-image";
import { toast } from "@/components/ui/toast-notification";
import { configurePOSSounds, playPOSSound } from "@/lib/pos-sounds";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrency } from "@/providers/currency-provider";
import { cleanScannedCode } from "@/lib/barcodes";
import { buildCode39SVG } from "@/lib/pos/code39";
import { BarcodeCameraDialog } from "@/components/pos/barcode-camera-dialog";
import { POSCalculatorDialog } from "@/components/pos/pos-calculator-dialog";

// ============================================
// Types
// ============================================

// ============================================
// Component
// ============================================

import { POSPaymentView } from "@/components/pos/payment-view";
import {
  POSDiscountDialog,
  type POSDiscount,
} from "@/components/pos/discount-dialog";
import { POSLineDiscountDialog } from "@/components/pos/line-discount-dialog";
import { POSLineNoteDialog } from "@/components/pos/line-note-dialog";
import { POSHoldOrderDialog } from "@/components/pos/hold-order-dialog";
import { POSSaleCompleteModal } from "@/components/pos/sale-complete-modal";
import { POSTakePaymentDialog } from "@/components/pos/take-payment-dialog";
import type {
  CustomerMode,
  POSCartItem,
  POSCategory,
  POSCompletedOrder,
  POSCustomer,
  POSLineDiscount,
  POSProduct,
  POSVendorFilterOption,
  POSVariant,
  POSView,
  ReceiptPrintPayload,
} from "@/components/pos/pos-types";
import type { POSSettings } from "@/lib/pos/build-pos-settings";
import QRCode from "qrcode";

type POSStockStatusFilter = "all" | "in_stock" | "out_of_stock";
type POSSourceFilter = "all" | "admin" | "vendor";
type POSMobileTab = "products" | "cart";
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

export interface POSTerminalControlledState {
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

export type POSTerminalProps = {
  settings: POSSettings;
  controlledState?: POSTerminalControlledState;
};

export function POSTerminal({ settings, controlledState }: POSTerminalProps) {
  const t = useTranslations();

  const isControlled = !!controlledState;

  // Always declare local state/refs (hooks rules)
  const localProductsState = React.useState<POSProduct[]>([]);
  const localCategoriesState = React.useState<POSCategory[]>([]);
  const localVendorsState = React.useState<POSVendorFilterOption[]>([]);
  const localCartState = React.useState<POSCartItem[]>([]);
  const localSearchQueryState = React.useState("");
  const localScanQueryState = React.useState("");
  const localStockStatusState = React.useState<POSStockStatusFilter>("all");
  const localSelectedVendorState = React.useState("all");
  const localSelectedSourceState = React.useState<POSSourceFilter>("all");
  const localIsScanResolvingState = React.useState(false);
  const localShowCameraScannerState = React.useState(false);
  const localScanQueueLengthState = React.useState(0);
  const localLastScanFeedbackState = React.useState<POSScanFeedback | null>(
    null,
  );

  const [products, setProducts] = isControlled
    ? [controlledState!.products, controlledState!.setProducts]
    : localProductsState;
  const [categories, setCategories] = isControlled
    ? [controlledState!.categories, controlledState!.setCategories]
    : localCategoriesState;
  const [vendors, setVendors] = isControlled
    ? [controlledState!.vendors, controlledState!.setVendors]
    : localVendorsState;
  const [cart, setCart] = isControlled
    ? [controlledState!.cart, controlledState!.setCart]
    : localCartState;
  const [searchQuery, setSearchQuery] = isControlled
    ? [controlledState!.searchQuery, controlledState!.setSearchQuery]
    : localSearchQueryState;
  const [scanQuery, setScanQuery] = isControlled
    ? ["", (_v: string) => {}]
    : localScanQueryState;
  const [stockStatus, setStockStatus] = isControlled
    ? [controlledState!.stockStatus, controlledState!.setStockStatus]
    : localStockStatusState;
  const [selectedVendor, setSelectedVendor] = isControlled
    ? [controlledState!.selectedVendor, controlledState!.setSelectedVendor]
    : localSelectedVendorState;
  const [selectedSource, setSelectedSource] = isControlled
    ? [controlledState!.selectedSource, controlledState!.setSelectedSource]
    : localSelectedSourceState;
  const [isScanResolving, setIsScanResolving] = isControlled
    ? [false, (_v: boolean) => {}]
    : localIsScanResolvingState;
  const [showCameraScanner, setShowCameraScanner] = isControlled
    ? [false, (_v: boolean) => {}]
    : localShowCameraScannerState;
  const [scanQueueLength, setScanQueueLength] = isControlled
    ? [0, (_v: number) => {}]
    : localScanQueueLengthState;
  const [lastScanFeedback, setLastScanFeedback] = isControlled
    ? [null, (_v: POSScanFeedback | null) => {}]
    : localLastScanFeedbackState;
  const scanQueueRef = React.useRef<POSScanQueueItem[]>([]);
  const isScanResolvingRef = React.useRef(false);

  // State that stays in POSTerminal
  const [customer, setCustomer] = React.useState<POSCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [customerResults, setCustomerResults] = React.useState<POSCustomer[]>(
    [],
  );
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");
  const [view, setView] = React.useState<POSView>("terminal");
  const [orderNote, setOrderNote] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [completedOrder, setCompletedOrder] =
    React.useState<POSCompletedOrder | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = React.useState(false);
  const [customerMode, setCustomerMode] =
    React.useState<CustomerMode>("search");
  const [isWalkIn, setIsWalkIn] = React.useState(false);
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerEmail, setNewCustomerEmail] = React.useState("");
  const [newCustomerPhone, setNewCustomerPhone] = React.useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = React.useState(false);
  const [selectedProduct, setSelectedProduct] =
    React.useState<POSProduct | null>(null);
  const [cashTendered, setCashTendered] = React.useState("");
  const [paymentReference, setPaymentReference] = React.useState("");
  const [paymentNote, setPaymentNote] = React.useState("");
  const [showPaymentSidebar, setShowPaymentSidebar] = React.useState(false);
  const [showTakePaymentDialog, setShowTakePaymentDialog] =
    React.useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = React.useState(false);
  const [showHoldDialog, setShowHoldDialog] = React.useState(false);
  const [showCalculatorDialog, setShowCalculatorDialog] = React.useState(false);
  const [showSaleCompleteModal, setShowSaleCompleteModal] =
    React.useState(false);
  const [lastPaymentMethod, setLastPaymentMethod] = React.useState<
    string | null
  >(null);
  const [discount, setDiscount] = React.useState<POSDiscount | null>(null);
  const [lineDiscountItemId, setLineDiscountItemId] = React.useState<
    string | null
  >(null);
  const [lineNoteItemId, setLineNoteItemId] = React.useState<string | null>(
    null,
  );
  const [processingMethod, setProcessingMethod] = React.useState<string | null>(
    null,
  );
  const [lastReceipt, setLastReceipt] =
    React.useState<ReceiptPrintPayload | null>(null);
  const printReceiptRef = React.useRef<
    ((receipt: ReceiptPrintPayload | null) => Promise<void>) | null
  >(null);
  const [mobileTab, setMobileTab] = React.useState<POSMobileTab>("products");
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const scanInputRef = React.useRef<HTMLInputElement>(null);
  const customerSearchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const { formatPrice } = useCurrency();

  // Configure POS sounds
  React.useEffect(() => {
    if (settings.sound) {
      configurePOSSounds(settings.sound);
    }
  }, [settings.sound]);

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
    if (typeof document === "undefined") return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Fullscreen is not available in this browser");
    }
  }, []);

  // Format price helper - uses dynamic currency from store
  const fp = React.useCallback(
    (amount: number) => formatPrice(amount),
    [formatPrice],
  );

  // Cart calculations
  // Compute the discounted price for a single line item (price * qty minus line discount)
  const getLineDiscountAmount = React.useCallback(
    (item: POSCartItem): number => {
      if (!item.lineDiscount) return 0;
      const lineSubtotal = item.price * item.quantity;
      const value = Math.max(0, item.lineDiscount.value);
      if (item.lineDiscount.type === "percent") {
        return (lineSubtotal * Math.min(value, 100)) / 100;
      }
      return Math.min(value, lineSubtotal);
    },
    [],
  );

  // Subtotal: sum of line totals after line discounts
  const lineDiscountTotal = React.useMemo(
    () => cart.reduce((sum, item) => sum + getLineDiscountAmount(item), 0),
    [cart, getLineDiscountAmount],
  );
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const discountedSubtotal = Math.max(0, subtotal - lineDiscountTotal);
  const tax = discountedSubtotal * settings.taxRate;
  const discountAmount = React.useMemo(() => {
    if (!discount) return 0;
    const value = Math.max(0, discount.value);
    if (discount.type === "percent") {
      return (discountedSubtotal * Math.min(value, 100)) / 100;
    }
    return Math.min(value, discountedSubtotal);
  }, [discount, discountedSubtotal]);
  const total = Math.max(0, discountedSubtotal - discountAmount + tax);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchProducts = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      if (stockStatus !== "all") params.set("stockStatus", stockStatus);
      if (selectedVendor !== "all") params.set("vendorId", selectedVendor);
      if (selectedSource !== "all") params.set("source", selectedSource);
      if (settings.posLocationId) {
        params.set("locationId", settings.posLocationId);
      }

      const res = await fetch(`/api/pos/products?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProducts(json.data.products);
        if (categories.length === 0) {
          setCategories(json.data.categories);
        }
        if (Array.isArray(json.data.filters?.vendors)) {
          setVendors(json.data.filters.vendors);
        }
      }
    } catch {
      toast.error(t("pos.errorLoadingProducts"));
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    selectedCategory,
    stockStatus,
    selectedVendor,
    selectedSource,
    categories.length,
    settings.posLocationId,
    t,
  ]);

  React.useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  // Customer search
  React.useEffect(() => {
    if (customerSearchTimerRef.current) {
      clearTimeout(customerSearchTimerRef.current);
    }
    if (customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    customerSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/pos/customers?search=${encodeURIComponent(customerSearch)}`,
        );
        const json = await res.json();
        if (json.success) {
          setCustomerResults(json.data);
        }
      } catch {
        // silent fail
      }
    }, 300);
  }, [customerSearch]);

  // ============================================
  // Cart Operations
  // ============================================

  const internalAddToCart = React.useCallback(
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
      setSelectedProduct(null);
    },
    [t],
  );

  const addToCart = isControlled
    ? controlledState!.addToCart
    : internalAddToCart;

  const resolveSingleScan = React.useCallback(
    async ({ code }: POSScanQueueItem) => {
      if (isControlled) return; // Scan logic is handled by parent
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
              ? t.has("pos.scanner.multipleMatches")
                ? t("pos.scanner.multipleMatches")
                : "Multiple products match this code. Please fix duplicate SKU or barcode values."
              : json.code === "OUT_OF_STOCK"
                ? t("pos.outOfStock")
                : json.code === "NO_MATCH"
                  ? t.has("pos.scanner.noMatch")
                    ? t("pos.scanner.noMatch")
                    : "No product found for the scanned code."
                  : json.message ||
                    (t.has("pos.scanner.lookupFailed")
                      ? t("pos.scanner.lookupFailed")
                      : "Unable to look up the scanned code.");

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
        const message = t.has("pos.scanner.lookupFailed")
          ? t("pos.scanner.lookupFailed")
          : "Unable to look up the scanned code.";
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
    if (isControlled) return; // Scan logic is handled by parent
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
      if (isControlled) return; // Scan logic is handled by parent
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
      if (isControlled) return; // Scan logic is handled by parent
      if (event.key !== "Enter") return;
      event.preventDefault();
      enqueueScannedCode(event.currentTarget.value, "hardware");
      setScanQuery("");
    },
    [enqueueScannedCode],
  );

  const updateQuantity = React.useCallback(
    (itemId: string, delta: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item;
          if (newQty > item.maxStock) {
            toast.error(t("pos.outOfStock"));
            return item;
          }
          return { ...item, quantity: newQty };
        }),
      );
    },
    [t],
  );

  const removeFromCart = React.useCallback((itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const applyLineDiscount = React.useCallback(
    (itemId: string, lineDiscount: POSLineDiscount | null) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          if (!lineDiscount) {
            const { lineDiscount: _omit, ...rest } = item;
            return rest;
          }
          return { ...item, lineDiscount };
        }),
      );
    },
    [],
  );

  const applyLineNote = React.useCallback(
    (itemId: string, note: string | null) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          if (!note) {
            const { lineNote: _omit, ...rest } = item;
            return rest;
          }
          return { ...item, lineNote: note };
        }),
      );
    },
    [],
  );

  const openLineDiscountDialog = React.useCallback((itemId: string) => {
    setLineDiscountItemId(itemId);
  }, []);

  const openLineNoteDialog = React.useCallback((itemId: string) => {
    setLineNoteItemId(itemId);
  }, []);

  const closeLineDiscountDialog = React.useCallback(() => {
    setLineDiscountItemId(null);
  }, []);

  const closeLineNoteDialog = React.useCallback(() => {
    setLineNoteItemId(null);
  }, []);

  // Currently active item for line dialogs
  const lineDiscountItem = React.useMemo(
    () =>
      lineDiscountItemId
        ? cart.find((item) => item.id === lineDiscountItemId)
        : null,
    [lineDiscountItemId, cart],
  );
  const lineNoteItem = React.useMemo(
    () =>
      lineNoteItemId ? cart.find((item) => item.id === lineNoteItemId) : null,
    [lineNoteItemId, cart],
  );

  const clearCart = React.useCallback(() => {
    setCart([]);
    setCustomer(null);
    setIsWalkIn(false);
    setOrderNote("");
    setView("terminal");
    setCompletedOrder(null);
    setCashTendered("");
    setPaymentReference("");
    setPaymentNote("");
    setShowPaymentSidebar(false);
    setDiscount(null);
    setLineDiscountItemId(null);
    setLineNoteItemId(null);
  }, []);

  // ============================================
  // Customer Dialog Helpers
  // ============================================

  const openCustomerDialog = React.useCallback(() => {
    setCustomerMode("search");
    setCustomerSearch("");
    setCustomerResults([]);
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
    setShowCustomerDialog(true);
  }, []);

  const closeCustomerDialog = React.useCallback(() => {
    setShowCustomerDialog(false);
    setCustomerSearch("");
    setCustomerResults([]);
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
    setIsCreatingCustomer(false);
  }, []);

  const selectCustomer = React.useCallback(
    (c: POSCustomer) => {
      setCustomer(c);
      setIsWalkIn(false);
      closeCustomerDialog();
    },
    [closeCustomerDialog],
  );

  const setWalkInCustomer = React.useCallback(() => {
    setCustomer(null);
    setIsWalkIn(true);
    closeCustomerDialog();
  }, [closeCustomerDialog]);

  const createNewCustomer = React.useCallback(async () => {
    if (!newCustomerName.trim() || !newCustomerEmail.trim()) {
      toast.error(t("pos.customer.nameEmailRequired"));
      return;
    }
    setIsCreatingCustomer(true);
    try {
      const res = await fetch("/api/pos/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          email: newCustomerEmail.trim(),
          phone: newCustomerPhone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        selectCustomer(json.data);
        toast.success(t("pos.customer.created"));
      } else {
        toast.error(json.message || t("pos.customer.createError"));
      }
    } catch {
      toast.error(t("pos.customer.createError"));
    } finally {
      setIsCreatingCustomer(false);
    }
  }, [newCustomerName, newCustomerEmail, newCustomerPhone, selectCustomer, t]);

  // ============================================
  // Handle product click (variants)
  // ============================================

  const handleProductClick = React.useCallback(
    (product: POSProduct) => {
      if (product.variants && product.variants.length > 0) {
        setSelectedProduct(product);
      } else {
        addToCart(product);
      }
    },
    [addToCart],
  );

  // ============================================
  // Checkout
  // ============================================

  const processPayment = React.useCallback(
    async (
      paymentMethod: string,
      cashTenderedOverride?: number,
      referenceOverride?: string,
      stripePaymentIntentIdOverride?: string,
    ) => {
      if (cart.length === 0) return false;
      const cashReceived =
        paymentMethod === "cash"
          ? (cashTenderedOverride ?? Number.parseFloat(cashTendered))
          : Number.NaN;
      if (
        paymentMethod === "cash" &&
        (!Number.isFinite(cashReceived) || cashReceived < total)
      ) {
        playPOSSound("error");
        toast.error("Cash tendered must cover the order total");
        return false;
      }

      setIsProcessing(true);
      setProcessingMethod(paymentMethod);

      const finalReference = referenceOverride ?? paymentReference;

      try {
        const res = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.map((item) => {
              const lineDiscountAmount = getLineDiscountAmount(item);
              const lineTotal = item.price * item.quantity - lineDiscountAmount;
              return {
                productId: item.productId,
                variantId: item.variantId,
                name:
                  item.name +
                  (item.variantName ? ` - ${item.variantName}` : ""),
                sku: item.sku,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                vendorId: item.vendorId,
                lineTotal: Math.max(0, lineTotal),
                lineDiscount: item.lineDiscount
                  ? {
                      type: item.lineDiscount.type,
                      value: item.lineDiscount.value,
                      amount: lineDiscountAmount,
                    }
                  : undefined,
                lineNote: item.lineNote || undefined,
              };
            }),
            paymentMethod,
            cashTendered:
              paymentMethod === "cash" && Number.isFinite(cashReceived)
                ? cashReceived
                : undefined,
            paymentReference: finalReference || undefined,
            stripePaymentIntentId: stripePaymentIntentIdOverride || undefined,
            paymentNote: paymentNote || undefined,
            notes: orderNote,
            posLocationId: settings.posLocationId,
            customerId: customer?._id,
            discount: discount
              ? {
                  type: discount.type,
                  value: discount.value,
                  amount: discountAmount,
                  reason: discount.reason,
                  note: discount.note,
                }
              : undefined,
          }),
        });

        const json = await res.json();
        if (json.success) {
          playPOSSound("payment");
          const balanceReturned =
            paymentMethod === "cash" &&
            Number.isFinite(cashReceived) &&
            cashReceived > total
              ? cashReceived - total
              : 0;
          const receiptPayload: ReceiptPrintPayload = {
            orderNumber: json.data.orderNumber,
            createdAt: json.data.createdAt || new Date(),
            paymentMethod,
            cashTendered:
              paymentMethod === "cash" && Number.isFinite(cashReceived)
                ? cashReceived
                : undefined,
            paymentReference: finalReference || undefined,
            paymentNote: paymentNote || undefined,
            items: cart.map((item) => {
              const lineDiscountAmount = getLineDiscountAmount(item);
              return {
                name: item.variantName
                  ? `${item.name} ${item.variantName}`
                  : item.name,
                quantity: item.quantity,
                price: item.price,
                amount: Math.max(
                  0,
                  item.price * item.quantity - lineDiscountAmount,
                ),
              };
            }),
            subtotal: discountedSubtotal,
            tax,
            discount: discountAmount + lineDiscountTotal,
            total,
            balanceReturned,
          };
          setLastReceipt(receiptPayload);
          if (settings.printedReceiptsEnabled) {
            window.setTimeout(() => {
              void printReceiptRef.current?.(receiptPayload);
            }, 0);
          }
          const orderSummary = {
            _id: json.data._id,
            orderNumber: json.data.orderNumber,
            total: json.data.total,
            itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
            cashTendered:
              paymentMethod === "cash" && Number.isFinite(cashReceived)
                ? cashReceived
                : undefined,
            changeDue: balanceReturned,
            paymentReference: finalReference || undefined,
            paymentNote: paymentNote || undefined,
          };
          setCompletedOrder(orderSummary);
          setCart([]);
          setCustomer(null);
          setIsWalkIn(false);
          setOrderNote("");
          setCashTendered("");
          setPaymentReference("");
          setPaymentNote("");
          setDiscount(null);
          setLineDiscountItemId(null);
          setLineNoteItemId(null);
          setLastPaymentMethod(paymentMethod);
          setShowSaleCompleteModal(true);
          toast.success(
            `${t("pos.orderComplete")} #${orderSummary.orderNumber}`,
          );
          // Play order complete chime after a short delay
          setTimeout(() => playPOSSound("orderComplete"), 400);
          return true;
        } else {
          playPOSSound("error");
          toast.error(json.message || t("pos.orderFailed"));
          return false;
        }
      } catch {
        playPOSSound("error");
        toast.error(t("pos.orderFailed"));
        return false;
      } finally {
        setIsProcessing(false);
        setProcessingMethod(null);
      }
    },
    [
      cart,
      cashTendered,
      paymentNote,
      paymentReference,
      orderNote,
      customer,
      discount,
      discountAmount,
      getLineDiscountAmount,
      lineDiscountTotal,
      discountedSubtotal,
      settings.posLocationId,
      settings.printedReceiptsEnabled,
      subtotal,
      tax,
      total,
      t,
    ],
  );

  const createStripeIntent = React.useCallback(async () => {
    const res = await fetch("/api/pos/payments/stripe/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((item) => {
          const lineDiscountAmount = getLineDiscountAmount(item);
          const lineTotal = item.price * item.quantity - lineDiscountAmount;
          return {
            productId: item.productId,
            variantId: item.variantId,
            name:
              item.name + (item.variantName ? ` - ${item.variantName}` : ""),
            sku: item.sku,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            vendorId: item.vendorId,
            lineTotal: Math.max(0, lineTotal),
            lineDiscount: item.lineDiscount
              ? {
                  type: item.lineDiscount.type,
                  value: item.lineDiscount.value,
                  amount: lineDiscountAmount,
                }
              : undefined,
            lineNote: item.lineNote || undefined,
          };
        }),
        posLocationId: settings.posLocationId,
        customerId: customer?._id,
        discount: discount
          ? {
              type: discount.type,
              value: discount.value,
              amount: discountAmount,
              reason: discount.reason,
              note: discount.note,
            }
          : undefined,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || "Failed to initialize Stripe payment");
    }
    const paymentIntentId = String(json.data?.paymentIntentId || "");
    const clientSecret = String(json.data?.clientSecret || "");
    if (!paymentIntentId || !clientSecret) {
      throw new Error("Failed to initialize Stripe payment");
    }
    return { paymentIntentId, clientSecret };
  }, [
    cart,
    customer,
    discount,
    discountAmount,
    getLineDiscountAmount,
    settings.posLocationId,
  ]);

  const printReceipt = React.useCallback(
    async (receipt: ReceiptPrintPayload | null) => {
      if (!receipt) {
        toast.error("No receipt data available");
        return;
      }

      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const dateText = new Intl.DateTimeFormat(settings.locale || "en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(receipt.createdAt));

      // Build the URL the QR code should resolve to. Use a stable order
      // lookup URL so a customer can scan and view their receipt.
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const orderUrl = `${origin}/${encodeURIComponent(
        settings.locale || "en",
      )}/track-order?orderNumber=${encodeURIComponent(receipt.orderNumber)}`;

      // Use a compact Code 128 symbol for the order lookup value. The
      // backwards-compatible helper name is retained for older callers.
      const barcodeValue = receipt.orderNumber.replace(/[^A-Za-z0-9]/g, "");
      const barcodeSVG = buildCode39SVG(barcodeValue, {
        height: 40,
        narrow: 1,
        wideRatio: 2.5,
        showText: true,
      });

      // Build a proper URL for the QR code. A small margin keeps the code
      // scannable on most thermal printers.
      const qrSrc = await QRCode.toDataURL(orderUrl, {
        width: 96,
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });

      const paymentLabelMap: Record<string, string> = {
        cash: "Cash",
        card: "Card",
        bank: "Bank",
        manual: "Manual",
      };
      const paymentLabel =
        paymentLabelMap[receipt.paymentMethod.toLowerCase()] ||
        receipt.paymentMethod.charAt(0).toUpperCase() +
          receipt.paymentMethod.slice(1);

      const sgst = receipt.tax / 2;
      const cgst = receipt.tax / 2;
      const itemRows = receipt.items
        .map(
          (item) => `
          <tr>
            <td class="qty">${item.quantity}</td>
            <td class="name">${escapeHtml(item.name)}</td>
            <td class="money">${fp(item.price)}</td>
            <td class="money">${fp(item.amount)}</td>
          </tr>
        `,
        )
        .join("");

      // Render the receipt in a hidden iframe so the user only sees the
      // system print dialog (not a second visible window behind it). The
      // iframe is sized to a typical 80mm thermal receipt, and removed
      // automatically once the print dialog closes.
      const iframe = document.createElement("iframe");
      iframe.title = `Receipt #${receipt.orderNumber}`;
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      document.body.appendChild(iframe);

      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      const handle = iframe.contentWindow;
      if (!handle) {
        cleanup();
        toast.error("Unable to open print preview");
        return;
      }

      handle.document.open();
      handle.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${escapeHtml(receipt.orderNumber)}</title>
  <style>
    html, body { background: #fff; color: #000; width: 80mm; min-width: 80mm; max-width: 80mm; }
    body { font-family: 'Courier New', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0 auto; padding: 0; }
    .receipt { width: 80mm; max-width: 80mm; margin: 0; padding: 4mm 2.5mm; box-sizing: border-box; font-size: 10px; line-height: 1.25; color: #000; }
    .center { text-align: center; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .store { font-size: 13px; font-weight: 800; line-height: 1.1; margin: 0; letter-spacing: 0.3px; text-transform: uppercase; }
    .meta { font-size: 9px; line-height: 1.25; margin: 2px 0 0; }
    .meta div { word-break: break-word; }
    .dash { border-top: 1px dashed #000; margin: 5px 0; }
    .info { font-size: 9px; }
    .info .line { display: flex; justify-content: space-between; margin: 0; gap: 6px; }
    .info .line .lbl { color: #000; }
    .info .line .val { font-weight: 700; }
    .items { width: 100%; border-collapse: collapse; font-size: 9px; }
    .items th { border-bottom: 1px solid #000; padding: 3px 1px; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 8px; letter-spacing: 0.2px; }
    .items td { padding: 3px 1px; vertical-align: top; }
    .items .qty { width: 24px; text-align: center; }
    .items .name { word-break: break-word; line-height: 1.2; }
    .items .money { text-align: right; white-space: nowrap; padding-left: 4px; }
    .totals { margin-top: 4px; font-size: 9px; }
    .totals .r { display: flex; justify-content: space-between; margin: 2px 0; gap: 8px; }
    .totals .r span:last-child { white-space: nowrap; }
    .totals .grand { font-size: 12px; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-top: 4px; letter-spacing: 0.3px; }
    .totals .grand span:last-child { font-size: 13px; }
    .thanks { font-size: 10px; text-align: center; margin: 6px 0 2px; font-weight: 700; }
    .footer-note { font-size: 8px; text-align: center; margin: 0; color: #000; }
    .barcode-wrap { width: 100%; max-width: 58mm; margin: 6px auto 2px; }
    .barcode-wrap svg { display: block; width: 100%; height: auto; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; margin: 5px 0 0; }
    .qr-wrap img { width: 64px; height: 64px; display: block; }
    .scan-text { font-size: 8px; text-align: center; margin-top: 3px; color: #000; }
    @media screen {
      html, body { margin: 0 auto; }
    }
    @media print {
      @page { size: 80mm auto; margin: 0 !important; }
      html, body {
        width: 80mm !important;
        min-width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fff !important;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .receipt {
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 3mm 2.5mm !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Store header -->
    <div class="center">
      <p class="store">${escapeHtml(settings.storeName || "Store")}</p>
      <div class="meta">
        ${
          settings.storeAddress
            ? `<div>${escapeHtml(settings.storeAddress)}</div>`
            : ""
        }
        ${
          settings.storePhone
            ? `<div>Phone: ${escapeHtml(settings.storePhone)}</div>`
            : ""
        }
        ${
          settings.storeEmail
            ? `<div>${escapeHtml(settings.storeEmail)}</div>`
            : ""
        }
      </div>
    </div>
    <div class="dash"></div>

    <!-- Order info -->
    <div class="info">
      <div class="line"><span class="lbl">Order #</span><span class="val">${escapeHtml(receipt.orderNumber)}</span></div>
      <div class="line"><span class="lbl">Date</span><span class="val">${escapeHtml(dateText)}</span></div>
      <div class="line"><span class="lbl">Payment</span><span class="val">${escapeHtml(paymentLabel)}</span></div>
    </div>
    <div class="dash"></div>

    <!-- Items -->
    <table class="items">
      <thead>
        <tr>
          <th class="qty">Qty</th>
          <th>Item</th>
          <th class="money">Price</th>
          <th class="money">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="r"><span>Sub Total</span><span>${fp(receipt.subtotal)}</span></div>
      ${
        receipt.discount > 0
          ? `<div class="r"><span>Discount</span><span>-${fp(receipt.discount)}</span></div>`
          : ""
      }
      ${
        receipt.tax > 0
          ? `<div class="r"><span>SGST (${(settings.taxRate * 50).toFixed(1)}%)</span><span>${fp(sgst)}</span></div>
      <div class="r"><span>CGST (${(settings.taxRate * 50).toFixed(1)}%)</span><span>${fp(cgst)}</span></div>`
          : ""
      }
      ${
        receipt.cashTendered !== undefined
          ? `<div class="r"><span>Cash Tendered</span><span>${fp(receipt.cashTendered)}</span></div>`
          : ""
      }
      ${
        receipt.balanceReturned > 0
          ? `<div class="r"><span>Balance Returned</span><span>${fp(receipt.balanceReturned)}</span></div>`
          : ""
      }
      <div class="r grand"><span>TOTAL</span><span>${fp(receipt.total)}</span></div>
    </div>

    <div class="dash"></div>

    <!-- Barcode -->
    <div class="barcode-wrap center">${barcodeSVG}</div>

    <!-- Thank you message -->
    <p class="thanks">Thank you for your visit!</p>
    <p class="footer-note">Please come again</p>

    <!-- QR code -->
    <div class="qr-wrap">
      <img src="${qrSrc}" alt="QR code for order ${escapeHtml(receipt.orderNumber)}" />
      <p class="scan-text">Scan to view digital receipt</p>
    </div>
  </div>
</body>
</html>`);
      handle.document.close();

      // Wait for the iframe to finish loading styles, then trigger the
      // system print dialog. The afterprint event (or a 2s safety
      // timeout) cleans the iframe up so it doesn't pile up in the DOM.
      const triggerPrint = () => {
        try {
          handle.focus();
          handle.print();
        } catch (err) {
          // Some browsers throw if print isn't permitted in the context.
          console.error("Print failed", err);
        }
        const safety = window.setTimeout(cleanup, 2000);
        const onAfterPrint = () => {
          window.clearTimeout(safety);
          handle.removeEventListener("afterprint", onAfterPrint);
          cleanup();
        };
        handle.addEventListener("afterprint", onAfterPrint);
      };

      // document.write blocks until the document is parsed, so the
      // content is ready immediately. Use a microtask + a fallback
      // timeout in case the browser is slow.
      if (iframe.contentDocument?.readyState === "complete") {
        triggerPrint();
      } else {
        const ready = () => {
          iframe.removeEventListener("load", ready);
          triggerPrint();
        };
        iframe.addEventListener("load", ready);
        window.setTimeout(triggerPrint, 350);
      }
    },
    [
      fp,
      settings.locale,
      settings.storeName,
      settings.storePhone,
      settings.storeEmail,
      settings.storeAddress,
      settings.taxRate,
    ],
  );

  React.useEffect(() => {
    printReceiptRef.current = printReceipt;
    return () => {
      printReceiptRef.current = null;
    };
  }, [printReceipt]);

  const openInvoice = React.useCallback(
    (disposition: "attachment" | "inline") => {
      if (!completedOrder?._id) {
        toast.error("No invoice is available for this order");
        return;
      }

      const params = disposition === "inline" ? "?disposition=inline" : "";
      const popup = window.open(
        `/api/pos/orders/${encodeURIComponent(completedOrder._id)}/invoice${params}`,
        "_blank",
        "noopener,noreferrer",
      );
      if (!popup) {
        toast.error("Unable to open invoice. Please allow popups.");
      }
    },
    [completedOrder?._id],
  );

  // ============================================
  // Keyboard shortcut (fullscreen on Enter, search on /, hotkeys F2/F3/F4/F9)
  // ============================================

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      const isButtonTarget = target?.closest("button, a");
      const hasOpenOverlay =
        showCustomerDialog ||
        showCameraScanner ||
        Boolean(selectedProduct) ||
        showTakePaymentDialog ||
        showDiscountDialog ||
        showHoldDialog ||
        showCalculatorDialog ||
        showSaleCompleteModal;

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !isInEditable) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === "c" &&
        !hasOpenOverlay
      ) {
        e.preventDefault();
        setShowCalculatorDialog(true);
        return;
      }

      if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isInEditable &&
        !isButtonTarget &&
        !hasOpenOverlay
      ) {
        e.preventDefault();
        void toggleFullscreen();
        return;
      }

      // Function-key hotkeys (F2 customer, F3 discount, F4 hold, F8 scan, F9 checkout)
      if (e.key === "F2") {
        e.preventDefault();
        if (view === "terminal") openCustomerDialog();
      } else if (e.key === "F3") {
        e.preventDefault();
        if (view === "terminal" && cart.length > 0) {
          setShowDiscountDialog(true);
        }
      } else if (e.key === "F4") {
        e.preventDefault();
        if (view === "terminal" && cart.length > 0) {
          setShowHoldDialog(true);
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        if (view === "terminal" && !hasOpenOverlay) {
          scanInputRef.current?.focus();
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        if (view === "terminal" && cart.length > 0 && !isProcessing) {
          setCashTendered("");
          setPaymentReference("");
          setPaymentNote("");
          setCompletedOrder(null);
          setShowTakePaymentDialog(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    cart.length,
    isProcessing,
    selectedProduct,
    showCalculatorDialog,
    showCameraScanner,
    showCustomerDialog,
    showDiscountDialog,
    showHoldDialog,
    showSaleCompleteModal,
    showTakePaymentDialog,
    toggleFullscreen,
    view,
  ]);

  // ============================================
  // Render: Order Complete View
  // ============================================

  if (view === "complete" && completedOrder) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center bg-linear-to-br from-green-50/50 via-background to-emerald-50/30 dark:from-green-950/20 dark:via-background dark:to-emerald-950/10">
        <div className="text-center space-y-8 max-w-md mx-auto p-8 animate-in fade-in zoom-in-95 duration-500">
          {/* Success icon with animated ring */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-linear-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/25">
              <CircleCheckBig
                className="w-12 h-12 text-white"
                strokeWidth={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {t("pos.orderComplete")}
            </h2>
            <p className="text-muted-foreground">
              {t("pos.orderNumber")}{" "}
              <span className="font-mono font-semibold text-foreground">
                #{completedOrder.orderNumber}
              </span>
            </p>
          </div>

          <div className="bg-card rounded-2xl border p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">
              {t("pos.total")}
            </p>
            <p className="text-4xl font-bold tracking-tight">
              {fp(completedOrder.total)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl h-12 px-6"
              onClick={() => printReceipt(lastReceipt)}
            >
              <Printer className="w-4 h-4 mr-2" />
              {t("pos.printReceipt")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl h-12 px-6"
              onClick={() => openInvoice("attachment")}
            >
              <FileText className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl h-12 px-6"
              onClick={() => openInvoice("inline")}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Invoice
            </Button>
            <Button
              size="lg"
              className="rounded-xl h-12 px-8 bg-linear-to-r from-primary to-primary/90 shadow-lg shadow-primary/25"
              onClick={clearCart}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t("pos.newSale")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Payment View
  // ============================================

  if (view === "payment") {
    return (
      <POSPaymentView
        cart={cart}
        cashTendered={cashTendered}
        setCashTendered={setCashTendered}
        paymentReference={paymentReference}
        setPaymentReference={setPaymentReference}
        paymentNote={paymentNote}
        setPaymentNote={setPaymentNote}
        isProcessing={isProcessing}
        settings={settings}
        subtotal={subtotal}
        tax={tax}
        total={total}
        setView={setView}
        processPayment={processPayment}
        fp={fp}
      />
    );
  }

  // ============================================
  // Render: Customer Dialog Modal
  // ============================================

  const customerDialog = showCustomerDialog && (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCustomerDialog();
      }}
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
        {/* Dialog Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base">
                {t("pos.customer.addCustomer")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("pos.customer.addCustomerDesc")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={closeCustomerDialog}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Walk-in Option */}
        <div className="px-5 pt-4">
          <button
            onClick={setWalkInCustomer}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-primary/40 dark:border-primary/30 text-left transition-all hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
              <Footprints className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {t("pos.customer.walkIn")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("pos.customer.walkInDesc")}
              </p>
            </div>
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          <button
            onClick={() => setCustomerMode("search")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              customerMode === "search"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Search className="w-3.5 h-3.5" />
            {t("pos.customer.existingCustomer")}
          </button>
          <button
            onClick={() => setCustomerMode("create")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              customerMode === "create"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("pos.customer.createNew")}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {customerMode === "search" ? (
            <div className="p-5 space-y-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("pos.customer.searchPlaceholder")}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-background"
                  autoFocus
                />
                {customerSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
                    onClick={() => {
                      setCustomerSearch("");
                      setCustomerResults([]);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Search Results */}
              {customerSearch.length >= 2 && customerResults.length > 0 ? (
                <ScrollArea className="max-h-60">
                  <div className="space-y-1">
                    {customerResults.map((c) => (
                      <button
                        key={c._id}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 text-left transition-all active:scale-[0.99]"
                        onClick={() => selectCustomer(c)}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {c.image ? (
                            <AppImage
                              src={c.image}
                              alt={c.name}
                              width={40}
                              height={40}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <UserCheck className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {c.name}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {c.email}
                            </span>
                            {c.phone && (
                              <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {c.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : customerSearch.length >= 2 && customerResults.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6 opacity-30" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("pos.customer.noResults")}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 text-primary"
                    onClick={() => {
                      setCustomerMode("create");
                      setNewCustomerName(customerSearch);
                    }}
                  >
                    {t("pos.customer.createInstead")}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {t("pos.customer.searchHint")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Create New Customer Form */
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  {t("pos.customer.customerName")}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder={t("pos.customer.namePlaceholder")}
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="h-11 rounded-xl"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  {t("pos.customer.emailAddress")}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder={t("pos.customer.emailPlaceholder")}
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("pos.customer.phone")}
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder={t("pos.customer.phonePlaceholder")}
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer */}
        {customerMode === "create" && (
          <div className="flex items-center justify-end gap-2 p-5 border-t">
            <Button
              variant="outline"
              onClick={closeCustomerDialog}
              className="rounded-xl"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={createNewCustomer}
              disabled={
                isCreatingCustomer ||
                !newCustomerName.trim() ||
                !newCustomerEmail.trim()
              }
              className="rounded-xl"
            >
              {isCreatingCustomer ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {t("pos.customer.save")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const paymentSidebar = showPaymentSidebar && (
    <div
      className="absolute inset-0 z-50 flex"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowPaymentSidebar(false);
          setCashTendered("");
          setPaymentReference("");
          setPaymentNote("");
          setCompletedOrder(null);
        }
      }}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" />
      <div className="relative ml-auto h-full w-full max-w-[560px] bg-background text-foreground border-l border-border shadow-2xl p-5 sm:p-6 overflow-y-auto animate-in slide-in-from-right-5 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h3 className="text-xl font-semibold">
              {completedOrder
                ? t("pos.orderComplete")
                : t("pos.selectPaymentMethod")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {completedOrder ? (
                <>
                  {t("pos.orderNumber")}:{" "}
                  <span className="font-semibold">
                    #{completedOrder.orderNumber}
                  </span>
                </>
              ) : (
                <>
                  {t("pos.totalDue")}:{" "}
                  <span className="font-semibold">{fp(total)}</span>
                </>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => {
              setShowPaymentSidebar(false);
              setCashTendered("");
              setPaymentReference("");
              setPaymentNote("");
              setCompletedOrder(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {completedOrder ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <p className="text-sm text-muted-foreground">{t("pos.total")}</p>
              <p className="text-3xl font-bold tabular-nums">
                {fp(completedOrder.total)}
              </p>
            </div>
            <Button
              onClick={() => printReceipt(lastReceipt)}
              className="w-full h-11"
              variant="outline"
            >
              <Printer className="w-4 h-4 mr-2" />
              {t("pos.printReceipt")}
            </Button>
            <Button
              onClick={() => openInvoice("attachment")}
              className="w-full h-11"
              variant="outline"
            >
              <FileText className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
            <Button
              onClick={() => openInvoice("inline")}
              className="w-full h-11"
              variant="outline"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Invoice
            </Button>
            <Button onClick={clearCart} className="w-full h-11">
              <Sparkles className="w-4 h-4 mr-2" />
              {t("pos.newSale")}
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {settings.paymentMethods.includes("cash") && (
              <div className="space-y-3">
                <button
                  onClick={() => processPayment("cash")}
                  disabled={isProcessing}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200",
                    "border-border bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5",
                    isProcessing && "opacity-60 pointer-events-none",
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                    {isProcessing && processingMethod === "cash" ? (
                      <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
                    ) : (
                      <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{t("pos.cash")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("pos.cashPayment")}
                    </p>
                  </div>
                </button>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    Math.ceil(total),
                    Math.ceil(total / 5) * 5,
                    Math.ceil(total / 10) * 10,
                    Math.ceil(total / 20) * 20,
                    Math.ceil(total / 50) * 50,
                    Math.ceil(total / 100) * 100,
                  ]
                    .filter((v, i, a) => a.indexOf(v) === i && v >= total)
                    .slice(0, 4)
                    .map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        className="font-mono"
                        onClick={() => setCashTendered(String(amount))}
                      >
                        {fp(amount)}
                      </Button>
                    ))}
                </div>

                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Cash tendered"
                  value={cashTendered}
                  onChange={(event) => setCashTendered(event.target.value)}
                />

                {cashTendered && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("pos.cashTendered")}
                      </span>
                      <span className="font-semibold">
                        {fp(parseFloat(cashTendered))}
                      </span>
                    </div>
                    {parseFloat(cashTendered) >= total && (
                      <div className="flex justify-between mt-1.5 text-emerald-300 font-semibold">
                        <span>{t("pos.change")}</span>
                        <span>{fp(parseFloat(cashTendered) - total)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(settings.paymentMethods.includes("card") ||
              settings.paymentMethods.includes("manual")) && (
              <div className="grid gap-2 rounded-xl border bg-card p-3">
                <Input
                  placeholder="Payment reference (optional)"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
                <Input
                  placeholder="Payment note (optional)"
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                />
              </div>
            )}

            {settings.paymentMethods.includes("card") && (
              <button
                onClick={() => processPayment("card")}
                disabled={isProcessing}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200",
                  "border-border bg-card hover:border-blue-500/50 hover:bg-blue-500/5",
                  isProcessing && "opacity-60 pointer-events-none",
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  {isProcessing && processingMethod === "card" ? (
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : (
                    <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{t("pos.card")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("pos.cardPayment")}
                  </p>
                </div>
              </button>
            )}

            {settings.paymentMethods.includes("manual") && (
              <button
                onClick={() => processPayment("manual")}
                disabled={isProcessing}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200",
                  "border-border bg-card hover:border-violet-500/50 hover:bg-violet-500/5",
                  isProcessing && "opacity-60 pointer-events-none",
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                  {isProcessing && processingMethod === "manual" ? (
                    <Loader2 className="w-5 h-5 text-violet-600 dark:text-violet-400 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{t("pos.manual")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("pos.manualPayment")}
                  </p>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // Render: Variant Selector Modal
  // ============================================

  const variantModal = selectedProduct && (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedProduct(null);
      }}
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            {selectedProduct.images?.[0] && (
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted ring-1 ring-border/50">
                <AppImage
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <h3 className="font-semibold">{selectedProduct.name}</h3>
              <p className="text-sm text-muted-foreground">
                {t("pos.selectVariant")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setSelectedProduct(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-1 gap-2">
            {selectedProduct.variants.map((variant) => (
              <button
                key={variant._id}
                onClick={() => addToCart(selectedProduct, variant)}
                disabled={variant.stock <= 0}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all w-full",
                  variant.stock > 0
                    ? "hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm cursor-pointer active:scale-[0.99]"
                    : "opacity-40 cursor-not-allowed",
                )}
              >
                {variant.image && (
                  <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/50">
                    <AppImage
                      src={variant.image}
                      alt={variant.name}
                      width={44}
                      height={44}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{variant.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Hash className="w-3 h-3" />
                    {variant.sku}
                    <span className="text-border">|</span>
                    {variant.stock > 0 ? (
                      <span className="text-green-600 dark:text-green-400">
                        {variant.stock} {t("pos.inStock")}
                      </span>
                    ) : (
                      <span className="text-destructive">
                        {t("common.outOfStock")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-bold text-sm tabular-nums">
                  {fp(variant.price)}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  // ============================================
  // Render: Main Terminal View
  // ============================================

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative flex min-h-full flex-col bg-card pb-16 lg:h-full lg:flex-row lg:overflow-hidden lg:pb-0">
        {variantModal}
        {customerDialog}
        {paymentSidebar}
        <BarcodeCameraDialog
          open={showCameraScanner}
          onOpenChange={setShowCameraScanner}
          onScan={enqueueScannedCode}
          isResolving={isScanResolving}
        />
        <POSCalculatorDialog
          open={showCalculatorDialog}
          onOpenChange={setShowCalculatorDialog}
        />
        <POSDiscountDialog
          open={showDiscountDialog}
          onOpenChange={setShowDiscountDialog}
          subtotal={discountedSubtotal}
          tax={tax}
          taxIncluded={false}
          current={discount}
          onApply={setDiscount}
          fp={fp}
        />
        <POSLineDiscountDialog
          open={lineDiscountItemId !== null}
          onOpenChange={(open) => {
            if (!open) closeLineDiscountDialog();
          }}
          itemId={lineDiscountItemId}
          itemName={
            lineDiscountItem
              ? `${lineDiscountItem.name}${
                  lineDiscountItem.variantName
                    ? ` · ${lineDiscountItem.variantName}`
                    : ""
                }`
              : ""
          }
          lineSubtotal={
            lineDiscountItem
              ? lineDiscountItem.price * lineDiscountItem.quantity
              : 0
          }
          current={lineDiscountItem?.lineDiscount ?? null}
          onApply={applyLineDiscount}
        />
        <POSLineNoteDialog
          open={lineNoteItemId !== null}
          onOpenChange={(open) => {
            if (!open) closeLineNoteDialog();
          }}
          itemId={lineNoteItemId}
          itemName={
            lineNoteItem
              ? `${lineNoteItem.name}${
                  lineNoteItem.variantName
                    ? ` · ${lineNoteItem.variantName}`
                    : ""
                }`
              : ""
          }
          current={lineNoteItem?.lineNote ?? null}
          onSave={applyLineNote}
        />
        <POSSaleCompleteModal
          open={showSaleCompleteModal && !!completedOrder}
          onOpenChange={(open) => {
            if (!open) {
              setShowSaleCompleteModal(false);
              setShowPaymentSidebar(false);
              setCompletedOrder(null);
              setLastPaymentMethod(null);
            }
          }}
          orderNumber={completedOrder?.orderNumber ?? ""}
          total={completedOrder?.total ?? 0}
          itemCount={completedOrder?.itemCount}
          paymentMethod={lastPaymentMethod}
          fp={fp}
          onViewReceipt={() => {
            openInvoice("inline");
          }}
          onPrintReceipt={() => {
            printReceipt(lastReceipt);
          }}
          onNewSale={() => {
            setShowSaleCompleteModal(false);
            setShowPaymentSidebar(false);
            setCompletedOrder(null);
            setLastPaymentMethod(null);
            clearCart();
          }}
        />
        <POSHoldOrderDialog
          open={showHoldDialog}
          onOpenChange={setShowHoldDialog}
          onHold={(label) => {
            toast.success(
              `Order held${label ? ` · ${label}` : ""} · cart cleared`,
            );
            setCart([]);
            setCustomer(null);
            setIsWalkIn(false);
            setOrderNote("");
            setDiscount(null);
            setLineDiscountItemId(null);
            setLineNoteItemId(null);
            setSelectedCategory("");
          }}
          itemCount={totalItems}
        />
        <POSTakePaymentDialog
          open={showTakePaymentDialog}
          onOpenChange={setShowTakePaymentDialog}
          total={total}
          itemCount={totalItems}
          discount={discount}
          onProcess={async (
            method,
            cashAmount,
            reference,
            _note,
            stripePaymentIntentId,
          ) => {
            const completed = await processPayment(
              method,
              cashAmount,
              reference,
              stripePaymentIntentId,
            );
            if (completed) setShowTakePaymentDialog(false);
          }}
          onCreateStripeIntent={createStripeIntent}
          isProcessing={isProcessing}
          processingMethod={processingMethod}
          settings={settings}
          fp={fp}
        />

        {/* LEFT PANEL - Products */}
        <div
          className={cn(
            "min-h-[620px] min-w-0 flex-col lg:min-h-0 lg:flex lg:flex-1",
            mobileTab === "products" ? "flex" : "hidden",
          )}
        >
          {/* Search and scanner bar - hidden when controlled externally */}
          {!isControlled && (
            <div className="bg-card px-3 pb-2 pt-3 sm:px-5 sm:pt-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search products by name / SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 rounded-xl border border-border/60 bg-card pl-11 pr-11 text-sm placeholder:text-muted-foreground/60 transition-all focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full hover:bg-muted"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-[560px]">
                  <div className="relative min-w-0 flex-1">
                    <ScanBarcode className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          ref={scanInputRef}
                          placeholder="Scan SKU or barcode..."
                          value={scanQuery}
                          onChange={(e) => setScanQuery(e.target.value)}
                          onKeyDown={handleScanKeyDown}
                          className="h-11 rounded-xl border border-border/60 bg-card pl-11 pr-14 font-mono text-sm tracking-[0.12em] placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground/60 transition-all focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                        />
                      </TooltipTrigger>
                      <TooltipContent>Scan SKU and Barcode</TooltipContent>
                    </Tooltip>
                    {!scanQuery ? (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-xs">
                        F8
                      </span>
                    ) : null}
                    {scanQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full hover:bg-muted"
                        onClick={() => setScanQuery("")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-xl"
                          onClick={() => setShowCameraScanner(true)}
                          aria-label="Scan with Camera"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Scan with Camera</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-xl"
                          onClick={() => setShowCalculatorDialog(true)}
                          aria-label="Calculator ALT+C"
                        >
                          <Calculator className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Calculator ALT+C</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-xl"
                          onClick={() => void toggleFullscreen()}
                          aria-label={
                            isFullscreen
                              ? "Exit fullscreen"
                              : "Enter fullscreen"
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

                    <div className="flex h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {isScanResolving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ScanBarcode className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isScanResolving ? "Resolving" : "Ready to scan"}
                      </span>
                      {scanQueueLength > 0 ? (
                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-mono">
                          +{scanQueueLength}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {lastScanFeedback ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <div
                    className={cn(
                      "flex h-8 min-w-0 max-w-full items-center gap-2 rounded-full border px-3 font-medium",
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
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex h-9 items-center gap-2 rounded-full border border-border/60 px-3 text-xs font-medium text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Filters</span>
                </div>

                <Select
                  value={stockStatus}
                  onValueChange={(value) =>
                    setStockStatus(value as POSStockStatusFilter)
                  }
                >
                  <SelectTrigger className="h-9 w-[142px] max-w-full rounded-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stock</SelectItem>
                    <SelectItem value="in_stock">In stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedSource}
                  onValueChange={(value) =>
                    setSelectedSource(value as POSSourceFilter)
                  }
                >
                  <SelectTrigger className="h-9 w-[150px] max-w-full rounded-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="admin">Admin products</SelectItem>
                    <SelectItem value="vendor">Vendor products</SelectItem>
                  </SelectContent>
                </Select>

                {vendors.length > 0 && (
                  <Select
                    value={selectedVendor}
                    onValueChange={setSelectedVendor}
                  >
                    <SelectTrigger className="h-9 w-[170px] max-w-full rounded-full bg-card">
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
                )}
              </div>
            </div>
          )}

          {/* Category Tabs */}
          {categories.length > 0 && (
            <div className="bg-card">
              <ScrollArea className="w-full">
                <div className="flex gap-1 px-3 pb-3 pt-3 sm:px-5 sm:pt-4">
                  <button
                    onClick={() => setSelectedCategory("")}
                    className={cn(
                      "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      selectedCategory === ""
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    {t("pos.allProducts")}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat._id}
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === cat._id ? "" : cat._id,
                        )
                      }
                      className={cn(
                        "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                        selectedCategory === cat._id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Product Grid */}
          <ScrollArea className="min-h-0 flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
                  <p className="text-sm text-muted-foreground">
                    {t("common.loading")}...
                  </p>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 opacity-40" />
                </div>
                <p className="font-medium text-foreground/70">
                  {t("pos.noProducts")}
                </p>
                <p className="text-sm mt-1">{t("pos.noProductsHint")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:gap-4 sm:p-5 md:grid-cols-4 xl:grid-cols-6">
                {products.map((product) => {
                  const inCart = cart.find(
                    (item) => item.productId === product._id && !item.variantId,
                  );
                  const variantInCart = cart.filter(
                    (item) => item.productId === product._id && item.variantId,
                  );
                  const totalInCart = inCart
                    ? inCart.quantity
                    : variantInCart.reduce((s, i) => s + i.quantity, 0);
                  const hasVariants =
                    product.variants && product.variants.length > 0;
                  const totalStock = hasVariants
                    ? product.variants.reduce((s, v) => s + (v.stock || 0), 0)
                    : product.stock;
                  const isOutOfStock = totalStock <= 0;
                  const stockLabel =
                    totalStock > 0 && totalStock < 10
                      ? `0${totalStock}`
                      : String(totalStock);
                  const onSale =
                    !!product.comparePrice &&
                    product.comparePrice > product.price;

                  return (
                    <button
                      key={product._id}
                      onClick={() => handleProductClick(product)}
                      disabled={isOutOfStock}
                      className={cn(
                        "group relative flex flex-col text-left transition-all duration-200",
                        isOutOfStock
                          ? "cursor-not-allowed"
                          : "cursor-pointer active:scale-[0.98]",
                      )}
                    >
                      {/* Product Image */}
                      <div
                        className={cn(
                          "aspect-square rounded-2xl bg-muted relative overflow-hidden transition-all duration-200",
                          !isOutOfStock &&
                            "group-hover:shadow-md group-hover:ring-1 group-hover:ring-primary/20",
                        )}
                      >
                        {product.images?.[0] ? (
                          <AppImage
                            src={product.images[0]}
                            alt={product.name}
                            width={240}
                            height={240}
                            className={cn(
                              "w-full h-full object-cover transition-transform duration-300",
                              isOutOfStock
                                ? "opacity-60 grayscale"
                                : "group-hover:scale-105",
                            )}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-muted-foreground/20" />
                          </div>
                        )}

                        {/* Top-left: Unavailable pill OR stock count pill */}
                        {isOutOfStock ? (
                          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-rose-500 text-white text-[11px] font-semibold shadow-sm">
                            {t("pos.outOfStock")}
                          </div>
                        ) : (
                          <div className="absolute top-2.5 left-2.5 min-w-7 h-6 px-2 rounded-full bg-background text-foreground text-[11px] font-semibold flex items-center justify-center shadow-sm">
                            {stockLabel}
                          </div>
                        )}

                        {/* Top-right: Cart quantity badge */}
                        {totalInCart > 0 && (
                          <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-md ring-2 ring-background">
                            {totalInCart}
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="pt-3 px-1 space-y-1">
                        <h4
                          className={cn(
                            "text-sm font-semibold leading-snug line-clamp-1",
                            isOutOfStock
                              ? "text-muted-foreground"
                              : "text-foreground",
                          )}
                        >
                          {product.name}
                        </h4>
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              onSale
                                ? "text-emerald-600 dark:text-emerald-500"
                                : isOutOfStock
                                  ? "text-muted-foreground"
                                  : "text-foreground",
                            )}
                          >
                            {fp(product.price)}
                          </span>
                          {onSale && (
                            <span className="text-xs text-muted-foreground/70 line-through tabular-nums">
                              {fp(product.comparePrice!)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* RIGHT PANEL - Cart */}
        <div
          className={cn(
            "min-h-[520px] w-full flex-col border-t bg-card lg:flex lg:min-h-0 lg:w-[420px] lg:shrink-0 lg:border-l lg:border-t-0",
            mobileTab === "cart" ? "flex" : "hidden",
          )}
        >
          {/* Cart Header */}
          <div className="space-y-4 p-3 pb-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Order
                  </p>
                  <h2 className="font-semibold text-[15px] leading-tight">
                    {t("pos.currentSale")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {totalItems}{" "}
                    {totalItems === 1
                      ? t.has("common.item")
                        ? t("common.item")
                        : "item"
                      : t.has("common.items")
                        ? t("common.items")
                        : "items"}
                  </p>
                </div>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCart}
                  className="text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-border/60 hover:border-rose-200 rounded-full h-8 px-3"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {t("pos.clearCart")}
                </Button>
              )}
            </div>

            {/* Customer */}
            {customer ? (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl px-3.5 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {customer.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {customer.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setCustomer(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : isWalkIn ? (
              <div className="flex items-center gap-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl px-3.5 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                  <Footprints className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t("pos.customer.walkIn")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t("pos.customer.walkInDesc")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setIsWalkIn(false)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <button
                onClick={openCustomerDialog}
                className="group relative w-full flex items-center gap-2.5 rounded-xl border border-dashed border-blue-300/60 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-950/10 px-3.5 py-2.5 text-left transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
              >
                <div className="w-9 h-9 rounded-full border border-blue-200/70 dark:border-blue-800/50 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    {t("pos.addCustomer")}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Earn loyalty, attach to order
                  </p>
                </div>
                <kbd className="rounded border border-blue-300/60 bg-blue-100/60 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:text-blue-300 shrink-0">
                  F2
                </kbd>
              </button>
            )}
          </div>

          {/* Cart Items */}
          <ScrollArea className="min-h-0 flex-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-70 text-muted-foreground px-8">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                  <Receipt className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-medium text-foreground/40">
                  {t("pos.emptyCart")}
                </p>
              </div>
            ) : (
              <div className="space-y-4 px-3 sm:px-5">
                {cart.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 group animate-in fade-in slide-in-from-right-2 duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Image */}
                    {item.image ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                        <AppImage
                          src={item.image}
                          alt={item.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg shrink-0 bg-muted/50 flex items-center justify-center">
                        <Package className="w-5 h-5 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Middle: Name + details */}
                    <div className="flex-1 min-w-0">
                      {/* Name + SKU row */}
                      <div className="flex items-center gap-2 flex-wrap pr-1">
                        <p
                          className="text-sm font-semibold leading-tight truncate"
                          title={item.name}
                        >
                          {truncateByWords(item.name, 5)}
                        </p>
                        {item.sku && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">
                            {item.sku}
                          </span>
                        )}
                      </div>
                      {/* Variant pill */}
                      {item.variantName && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary dark:bg-primary/20">
                          {item.variantName}
                        </span>
                      )}
                      {/* Line discount indicator */}
                      {item.lineDiscount && (
                        <span className="ml-1.5 inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <Tag className="h-2.5 w-2.5" />
                          {item.lineDiscount.type === "percent"
                            ? `${item.lineDiscount.value}% off`
                            : `${fp(item.lineDiscount.value)} off`}
                        </span>
                      )}
                      {/* Line note indicator */}
                      {item.lineNote && (
                        <p
                          className="mt-1.5 text-[11px] italic text-muted-foreground line-clamp-2 pr-1"
                          title={item.lineNote}
                        >
                          “{item.lineNote}”
                        </p>
                      )}
                      {/* Each price (or discounted each price) */}
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {item.lineDiscount ? (
                          <>
                            <span className="line-through">
                              {fp(item.price)}
                            </span>{" "}
                            {fp(
                              item.price -
                                getLineDiscountAmount(item) /
                                  Math.max(item.quantity, 1),
                            )}{" "}
                            each
                          </>
                        ) : (
                          <>{fp(item.price)} each</>
                        )}
                      </p>
                    </div>

                    {/* Right: Price, Qty, Actions */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="text-sm font-bold tabular-nums leading-tight">
                        {item.lineDiscount
                          ? fp(
                              item.price * item.quantity -
                                getLineDiscountAmount(item),
                            )
                          : fp(item.price * item.quantity)}
                      </p>
                      <div className="flex items-center border border-border/60 rounded-full px-1 py-0.5 bg-background">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold w-6 text-center tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => openLineDiscountDialog(item.id)}
                          className={cn(
                            "p-1 rounded transition-colors",
                            item.lineDiscount
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                              : "text-muted-foreground/60 hover:text-foreground",
                          )}
                          aria-label="Add line discount"
                          title="Add line discount"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openLineNoteDialog(item.id)}
                          className={cn(
                            "p-1 rounded transition-colors",
                            item.lineNote
                              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30"
                              : "text-muted-foreground/60 hover:text-foreground",
                          )}
                          aria-label="Add line note"
                          title="Add line note"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label={t("common.delete")}
                          className="text-muted-foreground/60 hover:text-destructive p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Cart Footer */}
          <div className="space-y-3 border-t border-border/60 bg-card px-3 pb-3 pt-3 sm:px-5 sm:pb-5">
            {/* Items count + subtotal (or discounted subtotal) */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {totalItems} {totalItems === 1 ? "item" : "items"} ·{" "}
                {cart.reduce((s, i) => s + i.quantity, 0)}{" "}
                {cart.reduce((s, i) => s + i.quantity, 0) === 1
                  ? "unit"
                  : "units"}
              </span>
              <span className="tabular-nums font-semibold">
                {lineDiscountTotal > 0 ? (
                  <>
                    <span className="text-muted-foreground line-through font-normal mr-1.5">
                      {fp(subtotal)}
                    </span>
                    {fp(discountedSubtotal)}
                  </>
                ) : (
                  fp(subtotal)
                )}
              </span>
            </div>

            {/* Line discount summary (only if any line has discount) */}
            {lineDiscountTotal > 0 ? (
              <div className="flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  <span>
                    Line discounts · {cart.filter((i) => i.lineDiscount).length}{" "}
                    {cart.filter((i) => i.lineDiscount).length === 1
                      ? "item"
                      : "items"}
                  </span>
                </span>
                <span className="tabular-nums font-semibold">
                  −{fp(lineDiscountTotal)}
                </span>
              </div>
            ) : null}

            {/* Add discount link */}
            {cart.length > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setShowDiscountDialog(true)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
                    discount
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>
                    {discount
                      ? `Discount · ${discount.type === "percent" ? `${discount.value}%` : fp(discount.value)}`
                      : "Add discount"}
                  </span>
                </button>
                <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  F3
                </kbd>
              </div>
            ) : null}

            {/* TOTAL DUE */}
            <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total due
              </span>
              <span className="text-2xl font-bold tabular-nums tracking-tight">
                {fp(total)}
              </span>
            </div>

            {/* Action buttons: Hold / Discount / Checkout */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setShowHoldDialog(true)}
                className={cn(
                  "group relative flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card text-sm font-medium transition-all",
                  cart.length > 0
                    ? "hover:border-foreground/30 hover:bg-muted/40 active:scale-[0.99]"
                    : "cursor-not-allowed opacity-50",
                )}
              >
                <Bookmark className="h-4 w-4" />
                <span>Hold</span>
                <kbd className="absolute right-1.5 top-1 hidden rounded border border-border/60 bg-muted/40 px-1 font-mono text-[9px] text-muted-foreground sm:inline-block">
                  F4
                </kbd>
              </button>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setShowDiscountDialog(true)}
                className={cn(
                  "group relative flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card text-sm font-medium transition-all",
                  cart.length > 0
                    ? discount
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                      : "hover:border-foreground/30 hover:bg-muted/40 active:scale-[0.99]"
                    : "cursor-not-allowed opacity-50",
                )}
              >
                <Tag className="h-4 w-4" />
                <span>Discount</span>
                <kbd className="absolute right-1.5 top-1 hidden rounded border border-border/60 bg-muted/40 px-1 font-mono text-[9px] text-muted-foreground sm:inline-block">
                  F3
                </kbd>
              </button>
              <button
                type="button"
                disabled={cart.length === 0 || isProcessing}
                onClick={() => {
                  setCashTendered("");
                  setPaymentReference("");
                  setPaymentNote("");
                  setCompletedOrder(null);
                  setShowTakePaymentDialog(true);
                }}
                className={cn(
                  "group relative flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white transition-all",
                  cart.length > 0 && !isProcessing
                    ? "bg-primary hover:bg-primary/90 active:scale-[0.99]"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                <CreditCard className="h-4 w-4" />
                <span>Checkout</span>
                <kbd className="absolute right-1.5 top-1 hidden rounded border border-white/30 bg-white/15 px-1 font-mono text-[9px] sm:inline-block">
                  F9
                </kbd>
              </button>
            </div>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("products")}
              className={cn(
                "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-colors",
                mobileTab === "products"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Package className="h-5 w-5" />
              <span>Products</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("cart")}
              className={cn(
                "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-colors",
                mobileTab === "cart"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 ? (
                  <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                ) : null}
              </span>
              <span>Cart</span>
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
