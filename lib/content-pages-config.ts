export const CONTENT_PAGE_KEYS = [
  "terms",
  "privacy",
  "returns",
  "cookies",
  "accessibility",
  "contact",
  "faq",
] as const;

export const NON_FAQ_CONTENT_PAGE_KEYS = [
  "terms",
  "privacy",
  "cookies",
  "accessibility",
] as const;

export type ContentPageKey = (typeof CONTENT_PAGE_KEYS)[number];
export type NonFaqContentPageKey = (typeof NON_FAQ_CONTENT_PAGE_KEYS)[number];

export interface ContentPageData {
  title: string;
  content: string;
  visible: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqPageData {
  title: string;
  subtitle: string;
  items: FaqItem[];
  visible: boolean;
}

export interface ReturnPolicyTextItem {
  id: string;
  text: string;
}

export interface ReturnPolicyStep {
  id: string;
  title: string;
  description: string;
}

export interface ReturnPolicyRule {
  id: string;
  title: string;
  description: string;
}

export interface ReturnPolicyStatusRow {
  id: string;
  label: string;
  description: string;
}

export interface ReturnPolicyPageData {
  title: string;
  eyebrow: string;
  description: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  returnWindowLabel: string;
  returnWindowValue: string;
  summaryItems: ReturnPolicyTextItem[];
  howItWorksTitle: string;
  howItWorksDescription: string;
  steps: ReturnPolicyStep[];
  eligibleTitle: string;
  eligibleItems: ReturnPolicyTextItem[];
  excludedTitle: string;
  excludedItems: ReturnPolicyTextItem[];
  refundRulesTitle: string;
  refundRulesDescription: string;
  refundRules: ReturnPolicyRule[];
  statusesTitle: string;
  statusesDescription: string;
  statuses: ReturnPolicyStatusRow[];
  beforeReturnTitle: string;
  beforeReturnDescription: string;
  helpTitle: string;
  ctaTitle: string;
  ctaDescription: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  visible: boolean;
}

export interface ContactPageData {
  title: string;
  description: string;
  heroImageUrl: string;
  getInTouchTitle: string;
  getInTouchDescription: string;
  formTitle: string;
  formDescription: string;
  headOfficeTitle: string;
  emailTitle: string;
  phoneTitle: string;
  hoursTitle: string;
  supportHours: string;
  showMap: boolean;
  mapTitle: string;
  mapDescription: string;
  mapProvider: "google" | "openstreetmap" | "custom";
  mapAddress: string;
  mapLatitude: string;
  mapLongitude: string;
  mapZoom: number;
  mapHeight: number;
  mapEmbedUrl: string;
  mapButtonLabel: string;
  showSocialLinks: boolean;
  visible: boolean;
}

export interface CustomPageData {
  id: string;
  title: string;
  handle: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPagesSettings {
  terms: ContentPageData;
  privacy: ContentPageData;
  returns: ReturnPolicyPageData;
  cookies: ContentPageData;
  accessibility: ContentPageData;
  contact: ContactPageData;
  faq: FaqPageData;
  customPages: CustomPageData[];
}

export interface HeaderAppPageOption {
  label: string;
  publicPath: string;
  keywords: string[];
}

export const HEADER_APP_PAGE_OPTIONS: HeaderAppPageOption[] = [
  {
    label: "Home",
    publicPath: "/",
    keywords: ["home", "storefront"],
  },
  {
    label: "Products",
    publicPath: "/products",
    keywords: ["products", "shop", "catalog"],
  },
  {
    label: "Collections",
    publicPath: "/collections",
    keywords: ["collections", "groups"],
  },
  {
    label: "Categories",
    publicPath: "/categories",
    keywords: ["categories", "category", "departments"],
  },
  {
    label: "Brands",
    publicPath: "/brands",
    keywords: ["brands", "brand", "manufacturers"],
  },
  {
    label: "Blog",
    publicPath: "/blog",
    keywords: ["blog", "articles", "news"],
  },
  {
    label: "Track Order",
    publicPath: "/track-order",
    keywords: ["track", "tracking", "order"],
  },
  {
    label: "Returns",
    publicPath: "/returns",
    keywords: ["returns", "refund", "support"],
  },
  {
    label: "Become a Vendor",
    publicPath: "/become-vendor",
    keywords: ["vendor", "seller", "sell"],
  },
  {
    label: "Pre-order",
    publicPath: "/pre-order",
    keywords: ["pre-order", "preorder", "coming soon"],
  },
  {
    label: "Cart",
    publicPath: "/cart",
    keywords: ["cart", "basket"],
  },
  {
    label: "Checkout",
    publicPath: "/checkout",
    keywords: ["checkout", "payment", "purchase"],
  },
  {
    label: "Account",
    publicPath: "/account",
    keywords: ["account", "customer"],
  },
  {
    label: "Orders",
    publicPath: "/account/orders",
    keywords: ["orders", "purchases"],
  },
  {
    label: "Pre-orders",
    publicPath: "/account/orders/pre-orders",
    keywords: ["pre-orders", "preorders", "account orders"],
  },
  {
    label: "Inbox",
    publicPath: "/account/inbox",
    keywords: ["inbox", "messages", "support"],
  },
  {
    label: "Notifications",
    publicPath: "/account/notifications",
    keywords: ["notifications", "alerts"],
  },
  {
    label: "Wishlist",
    publicPath: "/account/wishlist",
    keywords: ["wishlist", "saved"],
  },
  {
    label: "Profile",
    publicPath: "/account/profile",
    keywords: ["profile", "customer profile"],
  },
  {
    label: "Addresses",
    publicPath: "/account/addresses",
    keywords: ["addresses", "shipping address"],
  },
  {
    label: "Preferences",
    publicPath: "/account/preferences",
    keywords: ["preferences", "settings"],
  },
  {
    label: "Security",
    publicPath: "/account/security",
    keywords: ["security", "password"],
  },
];

export const CONTENT_PAGE_META: Record<
  ContentPageKey,
  {
    adminTitle: string;
    adminPath: string;
    publicPath: string;
    description: string;
  }
> = {
  terms: {
    adminTitle: "Terms of Service",
    adminPath: "/admin/online-store/pages/terms-of-service",
    publicPath: "/terms",
    description: "Manage your storefront terms for customer usage and obligations.",
  },
  privacy: {
    adminTitle: "Privacy Policy",
    adminPath: "/admin/online-store/pages/privacy-policy",
    publicPath: "/privacy",
    description: "Manage how customer data is collected, stored, and used.",
  },
  returns: {
    adminTitle: "Return and Refund Policy",
    adminPath: "/admin/online-store/pages/return-and-refund-policy",
    publicPath: "/returns",
    description: "Manage return windows, eligibility rules, refund timing, and support copy.",
  },
  cookies: {
    adminTitle: "Cookie Policy",
    adminPath: "/admin/online-store/pages/cookie-policy",
    publicPath: "/cookies",
    description: "Manage cookie usage, consent details, and tracking disclosures.",
  },
  accessibility: {
    adminTitle: "Accessibility",
    adminPath: "/admin/online-store/pages/accessibility",
    publicPath: "/accessibility",
    description: "Manage your accessibility commitments and support details.",
  },
  contact: {
    adminTitle: "Contact Us",
    adminPath: "/admin/online-store/pages/contact",
    publicPath: "/contact",
    description: "Manage your storefront contact page, form copy, and map.",
  },
  faq: {
    adminTitle: "FAQ",
    adminPath: "/admin/online-store/pages/faq",
    publicPath: "/faq",
    description: "Manage your frequently asked questions and customer support guidance.",
  },
};

export const RESERVED_CONTENT_PAGE_HANDLES = new Set([
  "terms",
  "privacy",
  "cookies",
  "accessibility",
  "faq",
  "products",
  "collections",
  "cart",
  "checkout",
  "account",
  "returns",
  "contact",
]);

export function slugifyContentPageHandle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const DEFAULT_CONTENT_PAGES_SETTINGS: ContentPagesSettings = {
  terms: {
    title: "Terms of Service",
    content:
      "<h2>Terms of Service</h2><p>Add your store's terms of service here.</p>",
    visible: true,
  },
  privacy: {
    title: "Privacy Policy",
    content:
      "<h2>Privacy Policy</h2><p>Add your privacy policy details here.</p>",
    visible: true,
  },
  returns: {
    title: "Return and Refund Policy",
    eyebrow: "Returns and refunds",
    description:
      "We want every {storeName} order to feel clear after checkout. This page explains when items can be returned, how refund reviews work, and what happens after an approved return reaches us.",
    primaryActionLabel: "View my orders",
    secondaryActionLabel: "Track an order",
    returnWindowLabel: "Return window",
    returnWindowValue: "30 days from delivery",
    summaryItems: [
      {
        id: "summary-eligible",
        text: "Eligible delivered items can be returned after review.",
      },
      {
        id: "summary-refunds",
        text: "Refunds are issued after approval and inspection.",
      },
      {
        id: "summary-exclusions",
        text: "Final sale, digital, and unsafe-to-resell items may be excluded.",
      },
    ],
    howItWorksTitle: "How a return works",
    howItWorksDescription:
      "Returns and refunds are separate steps. A return request handles eligibility, shipment, and inspection. A refund sends or records the money after the return is approved.",
    steps: [
      {
        id: "step-open-order",
        title: "Open your order",
        description:
          "Go to your account order history or track your order using the order number and checkout contact details.",
      },
      {
        id: "step-choose-items",
        title: "Choose eligible items",
        description:
          "Select the item quantity you want to return and share the reason, notes, and photos when needed.",
      },
      {
        id: "step-review",
        title: "Wait for review",
        description:
          "Our team, and the vendor when applicable, reviews the request against the return window and item condition.",
      },
      {
        id: "step-send-back",
        title: "Send the item back",
        description:
          "After approval, follow the return instructions. Keep your carrier receipt until the return is closed.",
      },
      {
        id: "step-inspection",
        title: "Inspection and refund",
        description:
          "Once received and inspected, eligible refunds are issued to the original payment method or recorded manually.",
      },
    ],
    eligibleTitle: "Eligible returns",
    eligibleItems: [
      {
        id: "eligible-delivered",
        text: "Delivered physical products requested within 30 days of delivery.",
      },
      {
        id: "eligible-condition",
        text: "Items in unused, clean, and resaleable condition unless they arrived damaged or defective.",
      },
      {
        id: "eligible-packaging",
        text: "Items with original packaging, tags, accessories, and included documents.",
      },
      {
        id: "eligible-partial",
        text: "Partial quantities from an order, as long as they have not already been returned or refunded.",
      },
    ],
    excludedTitle: "Items that may not qualify",
    excludedItems: [
      {
        id: "excluded-digital",
        text: "Digital goods, services, downloadable products, and gift cards.",
      },
      {
        id: "excluded-final-sale",
        text: "Final sale, clearance, customized, or personalized products.",
      },
      {
        id: "excluded-sensitive",
        text: "Perishable, hygiene-sensitive, intimate, or opened sealed goods when not defective.",
      },
      {
        id: "excluded-damaged",
        text: "Items damaged by misuse, missing parts, or returned outside the approved window.",
      },
    ],
    refundRulesTitle: "Refund rules",
    refundRulesDescription:
      "Refunds are capped at the remaining refundable order balance. Shipping, taxes, discounts, and fees may be adjusted based on the approved items and the condition received.",
    refundRules: [
      {
        id: "refund-original-method",
        title: "Original payment method",
        description:
          "Card, PayPal, Razorpay, and Paystack refunds are sent back through the original payment provider when possible.",
      },
      {
        id: "refund-partial",
        title: "Partial refunds",
        description:
          "If only part of an order is returned, the refund may include the item amount, eligible tax, and selected fees.",
      },
      {
        id: "refund-manual",
        title: "Manual refunds",
        description:
          "COD, cash, POS, and manual payments may be handled outside the payment gateway and recorded by the store team.",
      },
      {
        id: "refund-inventory",
        title: "Inventory review",
        description:
          "Refunds and inventory are separate decisions. Items are restocked only after inspection confirms they can be resold.",
      },
    ],
    statusesTitle: "Return request statuses",
    statusesDescription:
      "These are the typical states you may see as the return moves from request review to refund completion.",
    statuses: [
      {
        id: "status-requested",
        label: "Requested",
        description: "Your return request has been submitted for review.",
      },
      {
        id: "status-approved",
        label: "Approved",
        description: "The return is accepted and return instructions are provided.",
      },
      {
        id: "status-in-transit",
        label: "In transit",
        description: "The returned item is on its way back to the store or vendor.",
      },
      {
        id: "status-received",
        label: "Received",
        description: "The returned item has arrived and is waiting for inspection.",
      },
      {
        id: "status-refund-pending",
        label: "Refund pending",
        description: "The approved refund is being prepared or sent to the payment provider.",
      },
      {
        id: "status-refunded",
        label: "Refunded",
        description: "The refund has been issued or manually recorded.",
      },
    ],
    beforeReturnTitle: "Before sending anything back",
    beforeReturnDescription:
      "Please wait for approval and return instructions. Items sent back without approval can take longer to identify and may not qualify for refund processing.",
    helpTitle: "Need help?",
    ctaTitle: "Ready to review an order?",
    ctaDescription:
      "Start from your order history if you have an account. If you checked out without signing in, use the tracking page with your order number and checkout email or phone.",
    ctaPrimaryLabel: "My orders",
    ctaSecondaryLabel: "Track order",
    visible: true,
  },
  cookies: {
    title: "Cookie Policy",
    content:
      "<h2>Cookie Policy</h2><p>Describe the cookies your site uses and why.</p>",
    visible: true,
  },
  accessibility: {
    title: "Accessibility",
    content:
      "<h2>Accessibility</h2><p>Share your accessibility standards and support contact details.</p>",
    visible: true,
  },
  contact: {
    title: "Contact Us",
    description:
      "Have a question about an order, product, vendor, or account? Our team is ready to help you find the right answer.",
    heroImageUrl: "/contact-hero-storify.png",
    getInTouchTitle: "Get in Touch",
    getInTouchDescription:
      "Reach us through the details below, or send a message and we will get back to you as soon as possible.",
    formTitle: "Send us a message",
    formDescription:
      "Share the details and our support team will route your message to the right person.",
    headOfficeTitle: "Head Office",
    emailTitle: "Email Us",
    phoneTitle: "Call Us",
    hoursTitle: "Support Hours",
    supportHours: "Sunday to Thursday, 9:00 AM - 6:00 PM",
    showMap: true,
    mapTitle: "Visit Our Store",
    mapDescription:
      "Use the map below to find our office location and plan your visit.",
    mapProvider: "google",
    mapAddress: "",
    mapLatitude: "",
    mapLongitude: "",
    mapZoom: 14,
    mapHeight: 440,
    mapEmbedUrl: "",
    mapButtonLabel: "Open in Google Maps",
    showSocialLinks: true,
    visible: true,
  },
  faq: {
    title: "Frequently Asked Questions",
    subtitle: "Find quick answers to common questions about shopping, shipping, and returns.",
    visible: true,
    items: [
      {
        id: "faq-shipping",
        question: "How long does shipping take?",
        answer:
          "Standard shipping usually takes 3-7 business days depending on your location.",
      },
      {
        id: "faq-returns",
        question: "What is your return policy?",
        answer:
          "You can return eligible items within 30 days of delivery. Items must be unused and in original packaging.",
      },
      {
        id: "faq-tracking",
        question: "How can I track my order?",
        answer:
          "Once your order ships, you will receive a tracking link by email and in your account order history.",
      },
    ],
  },
  customPages: [],
};

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const next =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, Math.round(next)));
}

function normalizeMapProvider(
  value: unknown,
  fallback: ContactPageData["mapProvider"],
): ContactPageData["mapProvider"] {
  return value === "google" || value === "openstreetmap" || value === "custom"
    ? value
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFaqItems(value: unknown): FaqItem[] {
  const fallbackItems = DEFAULT_CONTENT_PAGES_SETTINGS.faq.items;
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const fallback = fallbackItems[index] ?? fallbackItems[0];
      const id = normalizeString(item.id, `faq-${index + 1}`);
      const question = normalizeString(item.question, fallback.question);
      const answer = normalizeString(item.answer, fallback.answer);

      return {
        id,
        question,
        answer,
      };
    })
    .filter((item): item is FaqItem => Boolean(item));

  if (normalized.length > 0) {
    return normalized;
  }

  return JSON.parse(JSON.stringify(fallbackItems)) as FaqItem[];
}

function normalizeReturnPolicyTextItems(
  value: unknown,
  fallbackItems: ReturnPolicyTextItem[],
): ReturnPolicyTextItem[] {
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const fallback = fallbackItems[index] ?? fallbackItems[0];
      const id = normalizeString(item.id, `item-${index + 1}`);
      const text = normalizeString(item.text, fallback.text);

      return { id, text };
    })
    .filter((item): item is ReturnPolicyTextItem => Boolean(item));

  return normalized.length > 0
    ? normalized
    : (JSON.parse(JSON.stringify(fallbackItems)) as ReturnPolicyTextItem[]);
}

function normalizeReturnPolicySteps(value: unknown): ReturnPolicyStep[] {
  const fallbackItems = DEFAULT_CONTENT_PAGES_SETTINGS.returns.steps;
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const fallback = fallbackItems[index] ?? fallbackItems[0];
      const id = normalizeString(item.id, `step-${index + 1}`);
      const title = normalizeString(item.title, fallback.title);
      const description = normalizeString(item.description, fallback.description);

      return { id, title, description };
    })
    .filter((item): item is ReturnPolicyStep => Boolean(item));

  return normalized.length > 0
    ? normalized
    : (JSON.parse(JSON.stringify(fallbackItems)) as ReturnPolicyStep[]);
}

function normalizeReturnPolicyRules(value: unknown): ReturnPolicyRule[] {
  const fallbackItems = DEFAULT_CONTENT_PAGES_SETTINGS.returns.refundRules;
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const fallback = fallbackItems[index] ?? fallbackItems[0];
      const id = normalizeString(item.id, `rule-${index + 1}`);
      const title = normalizeString(item.title, fallback.title);
      const description = normalizeString(item.description, fallback.description);

      return { id, title, description };
    })
    .filter((item): item is ReturnPolicyRule => Boolean(item));

  return normalized.length > 0
    ? normalized
    : (JSON.parse(JSON.stringify(fallbackItems)) as ReturnPolicyRule[]);
}

function normalizeReturnPolicyStatuses(value: unknown): ReturnPolicyStatusRow[] {
  const fallbackItems = DEFAULT_CONTENT_PAGES_SETTINGS.returns.statuses;
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const fallback = fallbackItems[index] ?? fallbackItems[0];
      const id = normalizeString(item.id, `status-${index + 1}`);
      const label = normalizeString(item.label, fallback.label);
      const description = normalizeString(item.description, fallback.description);

      return { id, label, description };
    })
    .filter((item): item is ReturnPolicyStatusRow => Boolean(item));

  return normalized.length > 0
    ? normalized
    : (JSON.parse(JSON.stringify(fallbackItems)) as ReturnPolicyStatusRow[]);
}

function normalizeCustomPages(value: unknown): CustomPageData[] {
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const id = normalizeString(item.id, `page-${index + 1}`);
      const title = normalizeString(item.title, `Page ${index + 1}`);
      const handle = normalizeString(item.handle, `page-${index + 1}`);
      const content = normalizeString(item.content, "");
      const metaTitle = normalizeString(item.metaTitle, "");
      const metaDescription = normalizeString(item.metaDescription, "");
      const visible = typeof item.visible === "boolean" ? item.visible : true;
      const createdAt = normalizeString(item.createdAt, new Date().toISOString());
      const updatedAt = normalizeString(item.updatedAt, createdAt);

      return {
        id,
        title,
        handle,
        content,
        metaTitle,
        metaDescription,
        visible,
        createdAt,
        updatedAt,
      };
    })
    .filter((item): item is CustomPageData => Boolean(item));

  return normalized;
}

export function getDefaultContentPagesSettings(): ContentPagesSettings {
  return JSON.parse(
    JSON.stringify(DEFAULT_CONTENT_PAGES_SETTINGS),
  ) as ContentPagesSettings;
}

export function normalizeContentPagesSettings(value: unknown): ContentPagesSettings {
  const source = isRecord(value) ? value : {};
  const defaults = getDefaultContentPagesSettings();

  const terms = isRecord(source.terms) ? source.terms : {};
  const privacy = isRecord(source.privacy) ? source.privacy : {};
  const returns = isRecord(source.returns) ? source.returns : {};
  const cookies = isRecord(source.cookies) ? source.cookies : {};
  const accessibility = isRecord(source.accessibility)
    ? source.accessibility
    : {};
  const contact = isRecord(source.contact) ? source.contact : {};
  const faq = isRecord(source.faq) ? source.faq : {};

  return {
    terms: {
      title: normalizeString(terms.title, defaults.terms.title),
      content: normalizeString(terms.content, defaults.terms.content),
      visible:
        typeof terms.visible === "boolean"
          ? terms.visible
          : defaults.terms.visible,
    },
    privacy: {
      title: normalizeString(privacy.title, defaults.privacy.title),
      content: normalizeString(privacy.content, defaults.privacy.content),
      visible:
        typeof privacy.visible === "boolean"
          ? privacy.visible
          : defaults.privacy.visible,
    },
    returns: {
      title: normalizeString(returns.title, defaults.returns.title),
      eyebrow: normalizeString(returns.eyebrow, defaults.returns.eyebrow),
      description: normalizeString(
        returns.description,
        defaults.returns.description,
      ),
      primaryActionLabel: normalizeString(
        returns.primaryActionLabel,
        defaults.returns.primaryActionLabel,
      ),
      secondaryActionLabel: normalizeString(
        returns.secondaryActionLabel,
        defaults.returns.secondaryActionLabel,
      ),
      returnWindowLabel: normalizeString(
        returns.returnWindowLabel,
        defaults.returns.returnWindowLabel,
      ),
      returnWindowValue: normalizeString(
        returns.returnWindowValue,
        defaults.returns.returnWindowValue,
      ),
      summaryItems: normalizeReturnPolicyTextItems(
        returns.summaryItems,
        defaults.returns.summaryItems,
      ),
      howItWorksTitle: normalizeString(
        returns.howItWorksTitle,
        defaults.returns.howItWorksTitle,
      ),
      howItWorksDescription: normalizeString(
        returns.howItWorksDescription,
        defaults.returns.howItWorksDescription,
      ),
      steps: normalizeReturnPolicySteps(returns.steps),
      eligibleTitle: normalizeString(
        returns.eligibleTitle,
        defaults.returns.eligibleTitle,
      ),
      eligibleItems: normalizeReturnPolicyTextItems(
        returns.eligibleItems,
        defaults.returns.eligibleItems,
      ),
      excludedTitle: normalizeString(
        returns.excludedTitle,
        defaults.returns.excludedTitle,
      ),
      excludedItems: normalizeReturnPolicyTextItems(
        returns.excludedItems,
        defaults.returns.excludedItems,
      ),
      refundRulesTitle: normalizeString(
        returns.refundRulesTitle,
        defaults.returns.refundRulesTitle,
      ),
      refundRulesDescription: normalizeString(
        returns.refundRulesDescription,
        defaults.returns.refundRulesDescription,
      ),
      refundRules: normalizeReturnPolicyRules(returns.refundRules),
      statusesTitle: normalizeString(
        returns.statusesTitle,
        defaults.returns.statusesTitle,
      ),
      statusesDescription: normalizeString(
        returns.statusesDescription,
        defaults.returns.statusesDescription,
      ),
      statuses: normalizeReturnPolicyStatuses(returns.statuses),
      beforeReturnTitle: normalizeString(
        returns.beforeReturnTitle,
        defaults.returns.beforeReturnTitle,
      ),
      beforeReturnDescription: normalizeString(
        returns.beforeReturnDescription,
        defaults.returns.beforeReturnDescription,
      ),
      helpTitle: normalizeString(returns.helpTitle, defaults.returns.helpTitle),
      ctaTitle: normalizeString(returns.ctaTitle, defaults.returns.ctaTitle),
      ctaDescription: normalizeString(
        returns.ctaDescription,
        defaults.returns.ctaDescription,
      ),
      ctaPrimaryLabel: normalizeString(
        returns.ctaPrimaryLabel,
        defaults.returns.ctaPrimaryLabel,
      ),
      ctaSecondaryLabel: normalizeString(
        returns.ctaSecondaryLabel,
        defaults.returns.ctaSecondaryLabel,
      ),
      visible: normalizeBoolean(returns.visible, defaults.returns.visible),
    },
    cookies: {
      title: normalizeString(cookies.title, defaults.cookies.title),
      content: normalizeString(cookies.content, defaults.cookies.content),
      visible:
        typeof cookies.visible === "boolean"
          ? cookies.visible
          : defaults.cookies.visible,
    },
    accessibility: {
      title: normalizeString(accessibility.title, defaults.accessibility.title),
      content: normalizeString(
        accessibility.content,
        defaults.accessibility.content,
      ),
      visible:
        typeof accessibility.visible === "boolean"
          ? accessibility.visible
          : defaults.accessibility.visible,
    },
    contact: {
      title: normalizeString(contact.title, defaults.contact.title),
      description: normalizeString(
        contact.description,
        defaults.contact.description,
      ),
      heroImageUrl: normalizeString(
        contact.heroImageUrl,
        defaults.contact.heroImageUrl,
      ),
      getInTouchTitle: normalizeString(
        contact.getInTouchTitle,
        defaults.contact.getInTouchTitle,
      ),
      getInTouchDescription: normalizeString(
        contact.getInTouchDescription,
        defaults.contact.getInTouchDescription,
      ),
      formTitle: normalizeString(contact.formTitle, defaults.contact.formTitle),
      formDescription: normalizeString(
        contact.formDescription,
        defaults.contact.formDescription,
      ),
      headOfficeTitle: normalizeString(
        contact.headOfficeTitle,
        defaults.contact.headOfficeTitle,
      ),
      emailTitle: normalizeString(contact.emailTitle, defaults.contact.emailTitle),
      phoneTitle: normalizeString(contact.phoneTitle, defaults.contact.phoneTitle),
      hoursTitle: normalizeString(contact.hoursTitle, defaults.contact.hoursTitle),
      supportHours: normalizeString(
        contact.supportHours,
        defaults.contact.supportHours,
      ),
      showMap: normalizeBoolean(contact.showMap, defaults.contact.showMap),
      mapTitle: normalizeString(contact.mapTitle, defaults.contact.mapTitle),
      mapDescription: normalizeString(
        contact.mapDescription,
        defaults.contact.mapDescription,
      ),
      mapProvider: normalizeMapProvider(
        contact.mapProvider,
        defaults.contact.mapProvider,
      ),
      mapAddress: normalizeString(
        contact.mapAddress,
        normalizeString(contact.mapQuery, defaults.contact.mapAddress),
      ),
      mapLatitude: normalizeString(
        contact.mapLatitude,
        defaults.contact.mapLatitude,
      ),
      mapLongitude: normalizeString(
        contact.mapLongitude,
        defaults.contact.mapLongitude,
      ),
      mapZoom: normalizeNumber(contact.mapZoom, defaults.contact.mapZoom, 1, 20),
      mapHeight: normalizeNumber(
        contact.mapHeight,
        defaults.contact.mapHeight,
        220,
        720,
      ),
      mapEmbedUrl: normalizeString(contact.mapEmbedUrl, defaults.contact.mapEmbedUrl),
      mapButtonLabel: normalizeString(
        contact.mapButtonLabel,
        defaults.contact.mapButtonLabel,
      ),
      showSocialLinks: normalizeBoolean(
        contact.showSocialLinks,
        defaults.contact.showSocialLinks,
      ),
      visible: normalizeBoolean(contact.visible, defaults.contact.visible),
    },
    faq: {
      title: normalizeString(faq.title, defaults.faq.title),
      subtitle: normalizeString(faq.subtitle, defaults.faq.subtitle),
      visible: typeof faq.visible === "boolean" ? faq.visible : defaults.faq.visible,
      items: normalizeFaqItems(faq.items),
    },
    customPages: normalizeCustomPages(source.customPages),
  };
}
