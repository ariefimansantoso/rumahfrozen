"use client";

import posthog from "posthog-js";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Star,
  Minus,
  Plus,
  Check,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/providers/currency-provider";
import { useCart } from "@/hooks/use-cart";
import { toast } from "@/components/ui/toast-notification";
import { type Locale } from "@/config/i18n.config";
import { ProductCollapsibleSection } from "./product-collapsible-section";
import { ProductImageGallery } from "./product-image-gallery";
import { ProductShareButtons } from "./product-share-buttons";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import { sanitizeHtml } from "@/lib/sanitize";
import { trackAddToCart, trackProductView } from "@/lib/analytics/events";

// Deferred so the large size-chart tables/modal load only when opened.
const ProductSizeGuide = dynamic(() => import("./product-size-guide"));

interface Product {
  _id: string;
  name: string;
  title?: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  comparePrice?: number;
  sku: string;
  barcode?: string;
  stock: number;
  preorder?: {
    enabled?: boolean;
    releaseDate?: string | Date;
    message?: string;
    limit?: number;
    reservedQuantity?: number;
    preorderOnly?: boolean;
    autoConvert?: boolean;
    paymentMode?: "full" | "deposit" | "pay_later";
    depositType?: "percentage" | "fixed";
    depositValue?: number;
    batchName?: string;
  };
  images: string[];
  media?: {
    _id: string;
    type?: "image" | "video" | "model";
    url: string;
    alt?: string;
    position?: number;
    mimeType?: string;
    thumbnailUrl?: string;
  }[];
  category?: { _id: string; name: string; slug: string };
  brand?: { _id: string; name: string; slug: string; logo?: string };
  tags: string[];
  attributes: { name: string; value: string }[];
  shipping?: {
    isPhysicalProduct?: boolean;
    weight?: number;
    weightUnit?: "g" | "kg" | "lb" | "oz";
    countryOfOrigin?: string;
    hsCode?: string;
  };
  options?: {
    name: string;
    values: {
      _id: string;
      value: string;
      position?: number;
      colorCode?: string;
    }[];
  }[];
  variants: {
    _id: string;
    name: string;
    sku: string;
    barcode?: string;
    price: number;
    comparePrice?: number;
    stock: number;
    attributes: { name: string; value: string }[];
    optionValues?: (
      | string
      | {
          optionId: string;
          optionName: string;
          valueId: string;
          value: string;
          colorCode?: string;
        }
    )[];
    requiresShipping?: boolean;
    weight?: number;
    weightUnit?: "g" | "kg" | "lb" | "oz";
    mediaId?: string;
    image?: string;
    preorder?: Product["preorder"];
  }[];
  rating: number;
  reviewCount: number;
  featured: boolean;
  vendorId?: {
    _id: string;
    storeName: string;
    slug: string;
    logo?: string;
    rating: number;
  };
}

type OptionValueObj = {
  optionId: string;
  optionName: string;
  valueId: string;
  value: string;
  colorCode?: string;
};

type ProductMediaKind = "image" | "video" | "model";
type ProductDetailsSection = "description" | "specifications" | "reviews";
type ProductInfoSectionKind =
  | "sizeFit"
  | "technicalDetails"
  | "dimensionsDetails"
  | "productInformation"
  | "productDetails";
type ProductInfoField = {
  label: string;
  value: string;
  href?: string;
};

type DisplayMedia = {
  id: string;
  type: ProductMediaKind;
  url: string;
  alt: string;
  mimeType?: string;
  thumbnailUrl?: string;
};

function getProductInfoSectionKind(product: Product): ProductInfoSectionKind {
  const categoryText = [
    product.category?.name,
    product.category?.slug,
    ...(product.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(cloth|clothes|clothing|fashion|apparel|wear|shirt|t-shirt|tee|pant|jean|dress|shoe|sneaker|hoodie|jacket)\b/.test(
      categoryText,
    )
  ) {
    return "sizeFit";
  }

  if (
    /\b(electronic|electronics|phone|mobile|laptop|computer|camera|audio|speaker|headphone|gadget|device|tv|television)\b/.test(
      categoryText,
    )
  ) {
    return "technicalDetails";
  }

  if (
    /\b(furniture|home|decor|table|chair|sofa|bed|mattress|cabinet|shelf|lighting)\b/.test(
      categoryText,
    )
  ) {
    return "dimensionsDetails";
  }

  if (
    /\b(beauty|cosmetic|skincare|makeup|perfume|fragrance|health|personal-care)\b/.test(
      categoryText,
    )
  ) {
    return "productInformation";
  }

  return "productDetails";
}

function normalizeAttributeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildAttributeLookup(
  productAttributes: Product["attributes"],
  variantAttributes?: Product["variants"][number]["attributes"],
) {
  const lookup = new Map<string, string>();
  const addAttributes = (attributes?: Product["attributes"]) => {
    attributes?.forEach((attribute) => {
      const key = normalizeAttributeKey(attribute.name || "");
      const value = attribute.value?.trim();
      if (key && value) lookup.set(key, value);
    });
  };

  addAttributes(productAttributes);
  addAttributes(variantAttributes);

  return lookup;
}

function getAttributeValue(
  attributes: Map<string, string>,
  keys: string[],
) {
  for (const key of keys) {
    const value = attributes.get(normalizeAttributeKey(key));
    if (value) return value;
  }
  return undefined;
}

function formatProductWeight(
  weight?: number,
  weightUnit?: "g" | "kg" | "lb" | "oz",
) {
  if (typeof weight !== "number" || Number.isNaN(weight) || weight <= 0) {
    return undefined;
  }
  return `${weight}${weightUnit ? ` ${weightUnit}` : ""}`;
}

function formatPreorderDate(value?: string | Date) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getPreorderRemaining(settings?: Product["preorder"]) {
  const limit = Number(settings?.limit || 0);
  if (!Number.isFinite(limit) || limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - Number(settings?.reservedQuantity || 0));
}

function isPreorderOpen(settings?: Product["preorder"]) {
  if (!settings?.enabled) return false;
  const releaseDate = settings.releaseDate
    ? new Date(settings.releaseDate)
    : null;
  if (
    settings.autoConvert !== false &&
    releaseDate &&
    !Number.isNaN(releaseDate.getTime()) &&
    releaseDate.getTime() < Date.now()
  ) {
    return false;
  }
  return getPreorderRemaining(settings) > 0;
}

function calculatePreorderDueNow(params: {
  unitPrice: number;
  quantity: number;
  settings?: Product["preorder"];
}) {
  const lineTotal = Math.max(0, params.unitPrice * params.quantity);
  const mode = params.settings?.paymentMode || "full";
  if (mode === "pay_later") return { dueNow: 0, dueLater: lineTotal };
  if (mode !== "deposit") return { dueNow: lineTotal, dueLater: 0 };

  const rawValue = Number(params.settings?.depositValue || 0);
  const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
  const dueNow =
    params.settings?.depositType === "fixed"
      ? Math.min(lineTotal, value * params.quantity)
      : Math.min(lineTotal, (lineTotal * Math.min(value, 100)) / 100);
  return { dueNow, dueLater: Math.max(0, lineTotal - dueNow) };
}

function humanizeAttributeLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isColorOptionName(optionName: string) {
  return ["color", "colour", "colors", "colours"].some((keyword) =>
    optionName.toLowerCase().includes(keyword),
  );
}

function isSizeOptionName(optionName: string) {
  return ["size", "sizing"].some((keyword) =>
    optionName.toLowerCase().includes(keyword),
  );
}

function getSelectedOptionEntries({
  product,
  selectedVariant,
  selectedOptions,
}: {
  product: Product;
  selectedVariant?: Product["variants"][number];
  selectedOptions: string[];
}) {
  const productOptions = product.options || [];
  const optionValues = (selectedVariant?.optionValues || []) as (
    | string
    | OptionValueObj
  )[];

  if (optionValues.length > 0) {
    return optionValues
      .map((optionValue, index) => {
        if (typeof optionValue === "string") {
          return {
            name: productOptions[index]?.name || "",
            value: optionValue,
          };
        }

        return {
          name: optionValue.optionName || productOptions[index]?.name || "",
          value: optionValue.value,
        };
      })
      .filter((entry) => entry.name && entry.value);
  }

  return selectedOptions
    .map((value, index) => ({
      name: productOptions[index]?.name || "",
      value,
    }))
    .filter((entry) => entry.name && entry.value);
}

function getOptionValues(product: Product, matcher: (name: string) => boolean) {
  const option = product.options?.find((item) => matcher(item.name));
  if (!option) return [];

  return Array.from(
    new Set(
      option.values
        .map((item) => item.value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function getVariantOptionValue(
  product: Product,
  variant: Product["variants"][number],
  matcher: (name: string) => boolean,
) {
  const optionValues = (variant.optionValues || []) as (
    | string
    | OptionValueObj
  )[];

  for (let index = 0; index < optionValues.length; index += 1) {
    const optionValue = optionValues[index];
    const optionName =
      typeof optionValue === "string"
        ? product.options?.[index]?.name || ""
        : optionValue.optionName || product.options?.[index]?.name || "";
    const value =
      typeof optionValue === "string" ? optionValue : optionValue.value;

    if (matcher(optionName) && value) return value;
  }

  return undefined;
}

function getProductInfoFields({
  product,
  selectedVariant,
  selectedOptions,
  sectionKind,
  locale,
}: {
  product: Product;
  selectedVariant?: Product["variants"][number];
  selectedOptions: string[];
  sectionKind: ProductInfoSectionKind;
  locale: Locale;
}): ProductInfoField[] {
  const attributes = buildAttributeLookup(
    product.attributes || [],
    selectedVariant?.attributes || [],
  );
  const categoryHref = product.category
    ? `/${locale}/categories/${product.category.slug}`
    : undefined;
  const brandHref = product.brand
    ? `/${locale}/brands/${encodeURIComponent(product.brand.slug)}`
    : undefined;
  const weight =
    formatProductWeight(selectedVariant?.weight, selectedVariant?.weightUnit) ||
    formatProductWeight(product.shipping?.weight, product.shipping?.weightUnit);

  const fields: ProductInfoField[] = [
    {
      label: "SKU",
      value: selectedVariant?.sku || product.sku,
    },
  ];

  if (product.brand?.name) {
    fields.push({
      label: "Brand",
      value: product.brand.name,
      href: brandHref,
    });
  }

  if (product.category?.name) {
    fields.push({
      label: "Category",
      value: product.category.name,
      href: categoryHref,
    });
  }

  if (sectionKind === "sizeFit") {
    const selectedEntries = getSelectedOptionEntries({
      product,
      selectedVariant,
      selectedOptions,
    });
    const selectedColor = selectedEntries.find((entry) =>
      isColorOptionName(entry.name),
    )?.value;
    const selectedSize = selectedEntries.find((entry) =>
      isSizeOptionName(entry.name),
    )?.value;

    if (selectedColor) fields.push({ label: "Color", value: selectedColor });
    if (selectedSize) {
      fields.push({ label: "Size shown", value: selectedSize });
    }
  }

  const configs: Record<
    ProductInfoSectionKind,
    { label: string; keys: string[] }[]
  > = {
    sizeFit: [
      {
        label: "Material",
        keys: ["material", "fabric", "composition", "upper_material"],
      },
      { label: "Fit", keys: ["fit", "fit_type", "silhouette"] },
      {
        label: "Size shown",
        keys: ["size_display", "size_shown", "display_size", "model_size"],
      },
      {
        label: "Model info",
        keys: ["model_info", "model_height", "model_wears", "model_size"],
      },
      { label: "Care", keys: ["care", "care_instructions", "wash_care"] },
    ],
    technicalDetails: [
      { label: "Brand", keys: ["brand", "manufacturer"] },
      { label: "Model", keys: ["model", "model_number", "part_number"] },
      { label: "Warranty", keys: ["warranty", "guarantee"] },
      { label: "Power", keys: ["power", "battery", "battery_life"] },
      { label: "Connectivity", keys: ["connectivity", "connection"] },
      { label: "Dimensions", keys: ["dimensions", "size"] },
      { label: "In the box", keys: ["in_the_box", "box_contents"] },
    ],
    dimensionsDetails: [
      { label: "Material", keys: ["material", "finish"] },
      { label: "Dimensions", keys: ["dimensions", "size", "l_w_h"] },
      { label: "Assembly", keys: ["assembly", "assembly_required"] },
      { label: "Load capacity", keys: ["load_capacity", "weight_capacity"] },
      { label: "Care", keys: ["care", "care_instructions", "cleaning"] },
      { label: "Origin", keys: ["country_of_origin", "origin"] },
    ],
    productInformation: [
      { label: "Net content", keys: ["net_content", "volume", "quantity"] },
      { label: "Ingredients", keys: ["ingredients"] },
      { label: "Suitable for", keys: ["skin_type", "hair_type", "suitable_for"] },
      { label: "How to use", keys: ["how_to_use", "usage", "directions"] },
      { label: "Shelf life", keys: ["shelf_life", "expiry", "expiration"] },
      { label: "Warnings", keys: ["warnings", "caution"] },
    ],
    productDetails: [
      { label: "Brand", keys: ["brand", "manufacturer"] },
      { label: "Model", keys: ["model", "model_number"] },
      { label: "Material", keys: ["material"] },
      { label: "Dimensions", keys: ["dimensions", "size"] },
      { label: "Warranty", keys: ["warranty", "guarantee"] },
      { label: "Origin", keys: ["country_of_origin", "origin"] },
    ],
  };

  configs[sectionKind].forEach((config) => {
    const value = getAttributeValue(attributes, config.keys);
    if (value) fields.push({ label: config.label, value });
  });

  if (sectionKind === "sizeFit") {
    const availableColors = getOptionValues(product, isColorOptionName);
    const availableSizes = getOptionValues(product, isSizeOptionName);
    const selectedEntries = getSelectedOptionEntries({
      product,
      selectedVariant,
      selectedOptions,
    });
    const selectedColor = selectedEntries.find((entry) =>
      isColorOptionName(entry.name),
    )?.value;

    if (availableColors.length > 0) {
      fields.push({
        label: "Color variants",
        value: availableColors.join(", "),
      });
    }
    if (availableSizes.length > 0) {
      fields.push({
        label: selectedColor ? `${selectedColor} sizes` : "Available sizes",
        value: availableSizes.join(", "),
      });
    }
  }

  if (weight) fields.push({ label: "Weight", value: weight });
  if (product.shipping?.countryOfOrigin) {
    fields.push({ label: "Origin", value: product.shipping.countryOfOrigin });
  }
  if (selectedVariant?.barcode || product.barcode) {
    fields.push({
      label: "Barcode",
      value: selectedVariant?.barcode || product.barcode || "",
    });
  }

  const usedLabels = new Set(fields.map((field) => field.label.toLowerCase()));
  for (const [key, value] of attributes.entries()) {
    const label = humanizeAttributeLabel(key);
    if (usedLabels.has(label.toLowerCase())) continue;
    fields.push({ label, value });
    usedLabels.add(label.toLowerCase());
    if (fields.length >= 12) break;
  }

  return fields
    .filter((field) => field.value.trim().length > 0)
    .filter(
      (field, index, allFields) =>
        allFields.findIndex(
          (candidate) =>
            candidate.label.toLowerCase() === field.label.toLowerCase(),
        ) === index,
    )
    .slice(0, 12);
}

function inferMediaType(media: {
  type?: ProductMediaKind;
  url: string;
  mimeType?: string;
}): ProductMediaKind {
  if (media.type) return media.type;
  const mimeType = media.mimeType?.toLowerCase() || "";
  const url = media.url.toLowerCase();

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

function firstImageUrl(media: DisplayMedia[], images: string[]) {
  return (
    media.find((item) => item.type === "image")?.url ||
    images.find(Boolean) ||
    media.find((item) => item.thumbnailUrl)?.thumbnailUrl ||
    ""
  );
}

const colorMap: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#a855f7",
  pink: "#ec4899",
  black: "#000000",
  white: "#ffffff",
  gray: "#6b7280",
  grey: "#6b7280",
  brown: "#92400e",
  navy: "#1e3a8a",
  beige: "#d4c4a8",
  cream: "#fffdd0",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  maroon: "#7f1d1d",
  olive: "#65a30d",
  coral: "#fb7185",
  mint: "#86efac",
  gold: "#ca8a04",
  silver: "#94a3b8",
};

function getColorCode(value: string, colorCode?: string): string | null {
  if (colorCode) return colorCode;
  const lowerValue = value.toLowerCase();
  return colorMap[lowerValue] || null;
}

function getVariantColorCodeForOptionValue({
  product,
  optionName,
  valueId,
  value,
}: {
  product: Product;
  optionName: string;
  valueId: string;
  value: string;
}) {
  for (const variant of product.variants || []) {
    const optionValues = (variant.optionValues || []) as (
      | string
      | OptionValueObj
    )[];

    for (let index = 0; index < optionValues.length; index += 1) {
      const optionValue = optionValues[index];
      if (typeof optionValue === "string") continue;

      const variantOptionName =
        optionValue.optionName || product.options?.[index]?.name || "";
      const matchesOption =
        variantOptionName.toLowerCase() === optionName.toLowerCase();
      const matchesValue =
        optionValue.valueId === valueId || optionValue.value === value;

      if (matchesOption && matchesValue && optionValue.colorCode) {
        return optionValue.colorCode;
      }
    }
  }

  return undefined;
}

interface ProductDetailsProps {
  product: Product;
  locale: Locale;
}

export function ProductDetails({ product, locale }: ProductDetailsProps) {
  const t = useTranslations();
  const router = useRouter();
  const { currency, formatPrice } = useCurrency();
  const { addItem, clearCart, items } = useCart();

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const hasSpecifications =
    Array.isArray(product.attributes) && product.attributes.length > 0;
  const hasDescription = !!product.description?.trim();
  const hasReviews = (product.reviewCount ?? 0) > 0;
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const specificationsRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] =
    useState<ProductDetailsSection>("description");

  const scrollToSection = (target: ProductDetailsSection) => {
    const el =
      target === "description"
        ? descriptionRef.current
        : target === "specifications"
          ? specificationsRef.current
          : document.getElementById("reviews");
    if (!el) return;
    setActiveSection(target);
    const header = document.querySelector<HTMLElement>("[data-sticky-header]");
    const offset = (header?.offsetHeight ?? 64) + 24;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    const desc = descriptionRef.current;
    if (!desc) return;

    const targets: Element[] = [desc];
    const spec = specificationsRef.current;
    const reviews = hasReviews ? document.getElementById("reviews") : null;
    if (hasSpecifications && spec) targets.push(spec);
    if (reviews) targets.push(reviews);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const target = visible.target as HTMLElement;
        const id = target.dataset.section ?? target.id;
        if (
          id === "description" ||
          id === "specifications" ||
          id === "reviews"
        ) {
          setActiveSection(id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [hasReviews, hasSpecifications]);

  const displayMedia = useMemo(() => {
    if (Array.isArray(product.media) && product.media.length > 0) {
      return [...product.media]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((m) => ({
          id: m._id,
          type: inferMediaType(m),
          url: m.url,
          alt: m.alt || product.name,
          mimeType: m.mimeType,
          thumbnailUrl: m.thumbnailUrl,
        }));
    }
    return (product.images || []).map((url, idx) => ({
      id: String(idx),
      type: "image" as const,
      url,
      alt: product.name,
    }));
  }, [product.images, product.media, product.name]);
  const cartPreviewImage = useMemo(
    () => firstImageUrl(displayMedia, product.images || []),
    [displayMedia, product.images],
  );

  const selectedVariant = useMemo(() => {
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      return undefined;
    }
    const hasOptions =
      Array.isArray(product.options) && product.options.length > 0;
    if (!hasOptions) return product.variants[0];
    const key = selectedOptions.join("||");
    return (
      product.variants.find((v) => {
        const vKey = ((v.optionValues ?? []) as (string | OptionValueObj)[])
          .map((ov) => (typeof ov === "string" ? ov : ov.value))
          .join("||");
        return vKey === key;
      }) || product.variants[0]
    );
  }, [product.options, product.variants, selectedOptions]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (
      Array.isArray(product.options) &&
      product.options.length > 0 &&
      Array.isArray(product.variants) &&
      product.variants.length > 0
    ) {
      const first = product.variants[0];
      const initial = Array.isArray(first.optionValues)
        ? (first.optionValues as (string | OptionValueObj)[]).map((ov) =>
            typeof ov === "string" ? ov : ov.value,
          )
        : product.options.map((o) => o.values?.[0]?.value || "");
      setSelectedOptions(initial);
    } else {
      setSelectedOptions([]);
    }
    setSelectedImage(0);
    setQuantity(1);
  }, [product._id, product.options, product.variants]);

  useEffect(() => {
    if (!selectedVariant) return;
    if (
      selectedVariant.mediaId &&
      Array.isArray(product.media) &&
      product.media.length > 0
    ) {
      const idx = displayMedia.findIndex(
        (m) => m.id === selectedVariant.mediaId,
      );
      if (idx >= 0) setSelectedImage(idx);
    }
  }, [displayMedia, product.media, selectedVariant]);

  const discountPercentage =
    (selectedVariant?.comparePrice ?? product.comparePrice) &&
    (selectedVariant?.comparePrice ?? product.comparePrice)! >
      (selectedVariant?.price ?? product.price)
      ? Math.round(
          (((selectedVariant?.comparePrice ?? product.comparePrice)! -
            (selectedVariant?.price ?? product.price)) /
            (selectedVariant?.comparePrice ?? product.comparePrice)!) *
            100,
        )
      : 0;
  const currentStock = selectedVariant?.stock ?? product.stock;
  const selectedPreorder = selectedVariant?.preorder?.enabled
    ? selectedVariant.preorder
    : product.preorder;
  const preorderOpen = isPreorderOpen(selectedPreorder);
  const preorderPurchase =
    preorderOpen && (selectedPreorder?.preorderOnly || currentStock <= 0);
  const preorderRemaining = getPreorderRemaining(selectedPreorder);
  const maxPurchasableQuantity = preorderPurchase
    ? Math.min(
        100,
        Number.isFinite(preorderRemaining) ? preorderRemaining : 100,
      )
    : currentStock;
  const preorderDateLabel = formatPreorderDate(selectedPreorder?.releaseDate);
  const preorderLimit = Number(selectedPreorder?.limit || 0);
  const preorderReserved = Math.max(
    0,
    Number(selectedPreorder?.reservedQuantity || 0),
  );
  const preorderProgress =
    preorderLimit > 0
      ? Math.min(100, Math.round((preorderReserved / preorderLimit) * 100))
      : 0;
  const preorderTerms = calculatePreorderDueNow({
    unitPrice: selectedVariant?.price ?? product.price,
    quantity,
    settings: selectedPreorder,
  });
  const analyticsItem = useMemo(
    () => ({
      item_id: String(product._id),
      item_name: product.name,
      item_variant: selectedVariant?._id
        ? String(selectedVariant._id)
        : undefined,
      item_category: product.category?.name,
      item_brand: product.brand?.name,
      sku: selectedVariant?.sku || product.sku,
      price: selectedVariant?.price ?? product.price,
      quantity,
    }),
    [
      product._id,
      product.name,
      product.price,
      product.sku,
      product.category?.name,
      product.brand?.name,
      quantity,
      selectedVariant?._id,
      selectedVariant?.price,
      selectedVariant?.sku,
    ],
  );

  useEffect(() => {
    trackProductView({
      currency: currency.code,
      value: selectedVariant?.price ?? product.price,
      items: [analyticsItem],
    });
  }, [
    analyticsItem,
    currency.code,
    product.price,
    selectedVariant?.price,
  ]);

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    try {
      await addItem({
        productId: product._id,
        variantId: selectedVariant?._id,
        name: selectedVariant
          ? `${product.name} - ${selectedVariant.name}`
          : product.name,
        price: selectedVariant?.price ?? product.price,
        image:
          displayMedia[selectedImage]?.type === "image"
            ? displayMedia[selectedImage].url
            : cartPreviewImage,
        quantity,
      });
      posthog.capture("product_added_to_cart", {
        product_id: product._id,
        product_name: product.name,
        product_slug: product.slug,
        price: selectedVariant?.price ?? product.price,
        quantity,
        variant_id: selectedVariant?._id,
        variant_name: selectedVariant?.name,
        category: product.category?.name,
        brand: product.brand?.name,
      });
      trackAddToCart({
        currency: currency.code,
        value: (selectedVariant?.price ?? product.price) * quantity,
        items: [analyticsItem],
      });
      toast.success(t("cart.itemAdded"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    setIsBuyingNow(true);
    try {
      // "Buy Now" goes straight to checkout for this single item, so clear
      // the existing cart when it contains items of a different purchase type
      // (the API rejects mixed standard/pre-order carts).
      const requestedPurchaseType = preorderPurchase ? "preorder" : "standard";
      const hasMixedCart = items.some(
        (item) => (item.purchaseType || "standard") !== requestedPurchaseType,
      );
      if (hasMixedCart) {
        await clearCart();
      }

      await addItem({
        productId: product._id,
        variantId: selectedVariant?._id,
        name: selectedVariant
          ? `${product.name} - ${selectedVariant.name}`
          : product.name,
        price: selectedVariant?.price ?? product.price,
        image:
          displayMedia[selectedImage]?.type === "image"
            ? displayMedia[selectedImage].url
            : cartPreviewImage,
        quantity,
      });
      trackAddToCart({
        currency: currency.code,
        value: (selectedVariant?.price ?? product.price) * quantity,
        items: [analyticsItem],
      });
      router.push(`/${locale}/checkout`);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("common.error");
      toast.error(message);
    } finally {
      setIsBuyingNow(false);
    }
  };

  const isColorOption = (optionName: string) => {
    const colorKeywords = ["color", "colour", "colors", "colours"];
    return colorKeywords.some((k) => optionName.toLowerCase().includes(k));
  };
  const isSizeOption = (optionName: string) => {
    const sizeKeywords = ["size", "sizing"];
    return sizeKeywords.some((k) => optionName.toLowerCase().includes(k));
  };
  const optionEntries = useMemo(() => {
    const opts = Array.isArray(product.options) ? product.options : [];
    return opts
      .map((opt, idx) => ({
        opt,
        idx,
        rank: isColorOption(opt.name) ? 0 : isSizeOption(opt.name) ? 1 : 2,
      }))
      .sort((a, b) => a.rank - b.rank || a.idx - b.idx);
  }, [product.options]);

  const normalizeOptionLabel = (name: string) => {
    if (isColorOption(name)) return "Color";
    if (isSizeOption(name)) return "Size";
    return name;
  };
  const tf = (
    key: string,
    fallback: string,
    values?: Record<string, string | number>,
  ) => {
    if (t.has(key)) {
      return t(key as never, values as never);
    }
    if (!values) return fallback;
    return fallback.replace(/\{(\w+)\}/g, (_, token) =>
      String(values[token] ?? `{${token}}`),
    );
  };
  const buyNowLabel = t.has("common.buyNow")
    ? t("common.buyNow")
    : t.has("product.buyNow")
      ? t("product.buyNow")
      : "Buy now";
  const productInfoSectionKind = getProductInfoSectionKind(product);
  const productInfoSectionTitle = {
    sizeFit: tf("product.sizeAndFit", "Size & Fit"),
    technicalDetails: tf("product.technicalDetails", "Technical Details"),
    dimensionsDetails: tf(
      "product.dimensionsDetails",
      "Dimensions & Details",
    ),
    productInformation: tf(
      "product.productInformation",
      "Product Information",
    ),
    productDetails: tf("product.productDetails", "Product Details"),
  }[productInfoSectionKind];
  const productInfoFields = useMemo(
    () =>
      getProductInfoFields({
        product,
        selectedVariant,
        selectedOptions,
        sectionKind: productInfoSectionKind,
        locale,
      }),
    [locale, product, productInfoSectionKind, selectedOptions, selectedVariant],
  );
  const formatDisplayPrice = (price: number) => {
    if (hasMounted) {
      return formatPrice(price);
    }

    // Keep SSR and first client render deterministic to avoid hydration mismatches.
    return formatCurrency(price, "USD", "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  const sectionTabs: { id: ProductDetailsSection; label: string }[] = [
    { id: "description", label: tf("product.description", "Description") },
  ];
  if (hasSpecifications) {
    sectionTabs.push({
      id: "specifications",
      label: tf("product.specifications", "Specifications"),
    });
  }
  if (hasReviews) {
    sectionTabs.push({
      id: "reviews",
      label: tf("product.reviews", "Reviews"),
    });
  }

  return (
    <div className="space-y-14">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-12">
        <div className="xl:sticky xl:top-[10.75rem] xl:self-start">
          <ProductImageGallery
            media={displayMedia}
            productName={product.name}
            selectedIndex={selectedImage}
            onSelect={setSelectedImage}
            discountPercentage={discountPercentage}
          />
        </div>

        <div>
          <div className="space-y-8">
            <div className="space-y-4">
              {/* <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href={`/${locale}`} className="hover:text-foreground">
                  {t("common.home")}
                </Link>
                <span>/</span>
                {product.category ? (
                  <Link
                    href={`/${locale}/categories/${product.category.slug}`}
                    className="hover:text-foreground"
                  >
                    {product.category.name}
                  </Link>
                ) : (
                  <span>{t("common.products")}</span>
                )}
                <span>/</span>
                <span className="text-foreground">{product.name}</span>
              </div> */}

              {product.brand?.name ? (
                <Link
                  href={`/${locale}/brands/${encodeURIComponent(
                    product.brand.slug,
                  )}`}
                  className="inline-flex w-fit text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                >
                  {product.brand.name}
                </Link>
              ) : null}

              <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl xl:text-3xl xl:leading-[1.05]">
                {product.name}
              </h1>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, index) => {
                  const isFilled = index < Math.round(product.rating);
                  return (
                    <Star
                      key={`rating-star-${index}`}
                      className={cn(
                        "h-4 w-4",
                        isFilled
                          ? "fill-amber-500 text-amber-500"
                          : "fill-muted-foreground text-muted-foreground opacity-30",
                      )}
                    />
                  );
                })}
                <Link
                  href="#reviews"
                  className="ml-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  ({product.reviewCount} {t("common.reviews")})
                </Link>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-semibold leading-none text-foreground">
                      {formatDisplayPrice(selectedVariant?.price ?? product.price)}
                    </span>
                    {(selectedVariant?.comparePrice ?? product.comparePrice) &&
                      (selectedVariant?.comparePrice ?? product.comparePrice)! >
                        (selectedVariant?.price ?? product.price) && (
                        <span className="text-2xl font-medium leading-none text-muted-foreground line-through">
                          {formatDisplayPrice(
                            selectedVariant?.comparePrice ??
                              product.comparePrice!,
                          )}
                        </span>
                      )}
                  </div>

                  <div
                    className={cn(
                      "inline-flex items-center rounded-[6px] px-3 py-1 text-sm font-semibold",
                      preorderPurchase
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                        : currentStock > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                          : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
                    )}
                  >
                    {preorderPurchase
                      ? tf("product.preorder", "Pre-order")
                      : currentStock > 0
                      ? t("product.inStock")
                      : t("product.outOfStock")}
                  </div>
                </div>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {product.shortDescription ||
                  tf("product.noDescription", "No description available.")}
              </p>
            </div>

            {optionEntries.length > 0 && (
              <div className="space-y-4 xl:space-y-6">
                {optionEntries.map(({ opt, idx }) => {
                  const isColor = isColorOption(opt.name);
                  const isSize = isSizeOption(opt.name);
                  return (
                    <div key={opt.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-base font-medium text-foreground">
                          {normalizeOptionLabel(opt.name)}
                        </div>
                        {isSize && (
                          <button
                            type="button"
                            className="text-sm font-medium text-sky-600 hover:text-sky-500"
                            onClick={() => setIsSizeGuideOpen(true)}
                          >
                            {t("product.sizeGuide")}
                          </button>
                        )}
                      </div>

                      {isColor ? (
                        <div className="flex flex-wrap gap-2.5">
                          {(opt.values || []).map((v) => {
                            const isSelected = selectedOptions[idx] === v.value;
                            const colorCode = getColorCode(
                              v.value,
                              v.colorCode ||
                                getVariantColorCodeForOptionValue({
                                  product,
                                  optionName: opt.name,
                                  valueId: v._id,
                                  value: v.value,
                                }),
                            );
                            return (
                              <button
                                key={v._id}
                                type="button"
                                onClick={() => {
                                  const next = [...selectedOptions];
                                  next[idx] = v.value;
                                  setSelectedOptions(next);
                                  setQuantity(1);
                                }}
                                className={cn(
                                  "relative h-8 w-8 rounded-full border transition",
                                  isSelected
                                    ? "border-foreground ring-2 ring-foreground/20"
                                    : "border-transparent hover:border-border",
                                )}
                                style={{
                                  backgroundColor: colorCode || "#e5e7eb",
                                }}
                                title={v.value}
                              >
                                {isSelected && colorCode && (
                                  <Check
                                    className={cn(
                                      "absolute inset-0 m-auto h-4 w-4",
                                      colorCode === "#ffffff" ||
                                        colorCode === "#fffdd0"
                                        ? "text-zinc-900"
                                        : "text-white",
                                    )}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(opt.values || []).map((v) => {
                            const isSelected = selectedOptions[idx] === v.value;
                            return (
                              <button
                                key={v._id}
                                type="button"
                                onClick={() => {
                                  const next = [...selectedOptions];
                                  next[idx] = v.value;
                                  setSelectedOptions(next);
                                  setQuantity(1);
                                }}
                                className={cn(
                                  "rounded-sm border px-4 py-2 text-sm font-semibold transition",
                                  isSelected
                                    ? "border-2 border-foreground bg-background text-foreground"
                                    : "border-border bg-background text-foreground/80 hover:border-muted-foreground/50",
                                )}
                              >
                                {v.value}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-border bg-muted">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="inline-flex h-full w-12 items-center justify-center bg-muted text-muted-foreground transition hover:bg-muted/80 disabled:opacity-50"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="inline-flex h-full w-16 items-center justify-center border-x border-border bg-muted/80 text-center text-[23px] font-normal leading-none text-foreground">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      Math.min(maxPurchasableQuantity, quantity + 1),
                    )
                  }
                  disabled={quantity >= maxPurchasableQuantity}
                  className="inline-flex h-full w-12 items-center justify-center bg-muted text-foreground/80 transition hover:bg-muted/80 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-1 min-w-[260px] items-center gap-3">
                <Button
                  size="lg"
                  className="h-12 flex-1 rounded-sm bg-foreground px-5 text-base font-semibold text-background hover:bg-foreground/90"
                  onClick={handleAddToCart}
                  disabled={
                    maxPurchasableQuantity <= 0 ||
                    isAddingToCart ||
                    isBuyingNow
                  }
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  {preorderPurchase
                    ? tf("product.preorderNow", "Pre-order now")
                    : t("common.addToCart")}
                </Button>
                <Button
                  size="lg"
                  className="h-12 flex-1 rounded-sm bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                  onClick={handleBuyNow}
                  disabled={
                    maxPurchasableQuantity <= 0 ||
                    isBuyingNow ||
                    isAddingToCart
                  }
                >
                  {preorderPurchase
                    ? tf("product.preorderCheckout", "Pre-order checkout")
                    : buyNowLabel}
                </Button>
              </div>
            </div>

            {preorderPurchase && (
              <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {preorderDateLabel
                      ? tf("product.preorderShips", "Expected ship date: {date}", {
                          date: preorderDateLabel,
                        })
                      : tf("product.preorderShipsSoon", "Expected to ship soon")}
                  </p>
                  {Number.isFinite(preorderRemaining) ? (
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-500/20 dark:text-blue-100">
                      {Math.max(0, preorderRemaining)} spots left
                    </span>
                  ) : null}
                </div>

                {preorderLimit > 0 ? (
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-blue-200/70 dark:bg-blue-950">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${preorderProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-800/80 dark:text-blue-100/75">
                      {preorderReserved} of {preorderLimit} reservations claimed
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-2 rounded-md bg-white/70 p-3 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-100 sm:grid-cols-2">
                  <div>
                    <span className="block text-blue-700/80 dark:text-blue-200/80">
                      Due today
                    </span>
                    <span className="font-semibold">
                      {formatPrice(preorderTerms.dueNow)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-blue-700/80 dark:text-blue-200/80">
                      Due before shipping
                    </span>
                    <span className="font-semibold">
                      {formatPrice(preorderTerms.dueLater)}
                    </span>
                  </div>
                </div>

                {selectedPreorder?.batchName ? (
                  <p className="text-xs font-medium">
                    Batch: {selectedPreorder.batchName}
                  </p>
                ) : null}
                {selectedPreorder?.message ? <p>{selectedPreorder.message}</p> : null}
              </div>
            )}

            {!preorderPurchase && currentStock > 0 && currentStock < 10 && (
              <p className="text-sm text-orange-600">
                {tf("product.lowStock", "Only {count} left in stock", {
                  count: currentStock,
                })}
              </p>
            )}

            <ProductShareButtons
              productName={product.name}
              image={product.images?.[0]}
            />

            <div className="h-px w-full bg-border/80" />

            <div className="space-y-2">
              <ProductCollapsibleSection title={productInfoSectionTitle}>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  {productInfoFields.map((field) => (
                    <div
                      key={`${field.label}-${field.value}`}
                      className="grid grid-cols-[112px_1fr] gap-2"
                    >
                      <span className="font-medium text-foreground/80">
                        {field.label}:
                      </span>
                      {field.href ? (
                        <Link
                          href={field.href}
                          className="min-w-0 break-words underline underline-offset-4 hover:text-foreground"
                        >
                          {field.value}
                        </Link>
                      ) : (
                        <span className="min-w-0 break-words">
                          {field.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ProductCollapsibleSection>

              <ProductCollapsibleSection title={tf("product.faq", "FAQ")}>
                <p className="text-sm text-muted-foreground">
                  {tf(
                    "product.faqHint",
                    "Common questions about this product will appear here.",
                  )}
                </p>
              </ProductCollapsibleSection>
            </div>
          </div>
        </div>
      </div>

      {isSizeGuideOpen && (
        <ProductSizeGuide
          product={product}
          onClose={() => setIsSizeGuideOpen(false)}
        />
      )}

      <section className="py-8">
        <div className="mb-8 flex flex-wrap items-center border-b border-border">
          {sectionTabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              className={cn(
                "relative -mb-px inline-flex h-12 items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition-colors",
                activeSection === id
                  ? "border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-400"
                  : "border-transparent text-foreground hover:bg-muted/60 hover:text-blue-600 dark:hover:text-blue-400",
              )}
            >
              <span>{label}</span>
              {id === "reviews" && (
                <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-zinc-300 px-2 py-0.5 text-xs font-semibold leading-none text-white dark:bg-zinc-600">
                  {product.reviewCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="max-w-4xl space-y-8 text-sm leading-7 text-muted-foreground">
          <div
            ref={descriptionRef}
            data-section="description"
            className="scroll-mt-24"
          >
            <h3 className="mb-4 text-xl font-semibold text-foreground">
              {tf("product.description", "Description")}
            </h3>
            {hasDescription ? (
              <div
                className="rich-text-content max-w-none text-muted-foreground [&_img]:h-auto [&_img]:max-h-[640px] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border [&_img]:object-contain"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(product.description),
                }}
              />
            ) : (
              <p>{tf("product.noDescription", "No description available.")}</p>
            )}
          </div>

          {hasSpecifications && (
            <div
              ref={specificationsRef}
              data-section="specifications"
              className="scroll-mt-24"
            >
              <h3 className="mb-4 text-xl font-semibold text-foreground">
                {tf("product.specifications", "Specifications")}
              </h3>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {product.attributes.map((attr, index) => (
                      <tr key={`${attr.name}-${index}`}>
                        <th
                          scope="row"
                          className="w-1/3 bg-muted/30 px-4 py-3 text-left align-top font-medium text-foreground"
                        >
                          {attr.name}
                        </th>
                        <td className="px-4 py-3 align-top text-foreground/90">
                          {attr.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {product.tags.length > 0 && (
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {tf("common.tags", "Tags")}:
            </span>
            {product.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
