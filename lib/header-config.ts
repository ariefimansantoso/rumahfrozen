export interface HeaderColorScheme {
  backgroundColor: string;
  textColor: string;
  searchBackgroundColor: string;
  searchTextColor: string;
}

export type HeaderNavPosition = "left" | "right";

export interface HeaderSettings {
  layout: {
    sticky: boolean;
    fullWidth: boolean;
  };
  brand: {
    logoUrl: string;
    darkLogoUrl: string;
    logoAlt: string;
    desktopLogoWidth: number;
    mobileLogoWidth: number;
  };
  colors: {
    light: HeaderColorScheme;
    dark: HeaderColorScheme;
  };
  search: {
    enabled: boolean;
    showAiButton: boolean;
    placeholder: string;
    desktopWidth: number;
    height: number;
    borderRadius: number;
    borderColor: string;
  };
  market: {
    showLanguageSelector: boolean;
    showCurrencySelector: boolean;
    defaultLanguage: string;
    defaultCurrency: string;
  };
  mobile: {
    showSearch: boolean;
    showAccountSummary: boolean;
    showCategoryShortcuts: boolean;
    showCollections: boolean;
    showMarketSelectors: boolean;
    showThemeSelector: boolean;
  };
  widgets: {
    showThemeToggle: boolean;
    showAccountMenu: boolean;
    showWishlist: boolean;
    showCart: boolean;
  };
  categoryMenu: {
    enabled: boolean;
    position: HeaderNavPosition;
    showMegaMenu: boolean;
    showQuickLinks: boolean;
    label: string;
    quickLimit: number;
    mobileLimit: number;
    showPromoCard: boolean;
    promoTitle: string;
    promoSubtitle: string;
    promoImageSrc: string;
    promoHref: string;
  };
  collectionsMenu: {
    enabled: boolean;
    position: HeaderNavPosition;
    label: string;
    limit: number;
  };
  utilityMenu: {
    enabled: boolean;
  };
  pagesMenu: {
    enabled: boolean;
    appPagePaths: string[];
    pageKeys: string[];
    customPageIds: string[];
    order: string[];
    positions: Record<string, HeaderNavPosition>;
  };
}

const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  layout: {
    sticky: true,
    fullWidth: false,
  },
  brand: {
    logoUrl: "",
    darkLogoUrl: "",
    logoAlt: "",
    desktopLogoWidth: 144,
    mobileLogoWidth: 112,
  },
  colors: {
    light: {
      backgroundColor: "#ffffff",
      textColor: "#111827",
      searchBackgroundColor: "#ffffff",
      searchTextColor: "#111827",
    },
    dark: {
      backgroundColor: "#050505",
      textColor: "#ffffff",
      searchBackgroundColor: "#111111",
      searchTextColor: "#ffffff",
    },
  },
  search: {
    enabled: true,
    showAiButton: true,
    placeholder: "Search products...",
    desktopWidth: 640,
    height: 40,
    borderRadius: 999,
    borderColor: "#dddddd",
  },
  market: {
    showLanguageSelector: true,
    showCurrencySelector: true,
    defaultLanguage: "en",
    defaultCurrency: "USD",
  },
  widgets: {
    showThemeToggle: true,
    showAccountMenu: true,
    showWishlist: true,
    showCart: true,
  },
  categoryMenu: {
    enabled: true,
    position: "left",
    showMegaMenu: true,
    showQuickLinks: true,
    label: "All Categories",
    quickLimit: 3,
    mobileLimit: 8,
    showPromoCard: false,
    promoTitle: "",
    promoSubtitle: "",
    promoImageSrc: "",
    promoHref: "",
  },
  collectionsMenu: {
    enabled: true,
    position: "left",
    label: "Collections",
    limit: 12,
  },
  utilityMenu: {
    enabled: true,
  },
  pagesMenu: {
    enabled: true,
    appPagePaths: ["/blog", "/track-order"],
    pageKeys: [],
    customPageIds: [],
    order: ["app:/blog", "app:/track-order"],
    positions: {
      "app:/blog": "right",
      "app:/track-order": "right",
    },
  },
  mobile: {
    showSearch: true,
    showAccountSummary: true,
    showCategoryShortcuts: true,
    showCollections: true,
    showMarketSelectors: true,
    showThemeSelector: true,
  },
};

function cloneDefaults(): HeaderSettings {
  return JSON.parse(JSON.stringify(DEFAULT_HEADER_SETTINGS)) as HeaderSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePosition(value: unknown, fallback: HeaderNavPosition) {
  return value === "left" || value === "right" ? value : fallback;
}

function normalizeLimit(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizePositionRecord(value: unknown): Record<string, HeaderNavPosition> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, position]) => {
      if (position !== "left" && position !== "right") return [];
      const normalizedKey = key.trim();
      return normalizedKey ? [[normalizedKey, position]] : [];
    }),
  );
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    trimmed,
  )
    ? trimmed
    : fallback;
}

function normalizeColorScheme(
  value: unknown,
  fallback: HeaderColorScheme,
): HeaderColorScheme {
  const source = isRecord(value) ? value : {};

  return {
    backgroundColor: normalizeHexColor(
      source.backgroundColor,
      fallback.backgroundColor,
    ),
    textColor: normalizeHexColor(source.textColor, fallback.textColor),
    searchBackgroundColor: normalizeHexColor(
      source.searchBackgroundColor,
      fallback.searchBackgroundColor,
    ),
    searchTextColor: normalizeHexColor(
      source.searchTextColor,
      fallback.searchTextColor,
    ),
  };
}

export function getDefaultHeaderSettings(): HeaderSettings {
  return cloneDefaults();
}

export function normalizeHeaderSettings(value: unknown): HeaderSettings {
  const defaults = cloneDefaults();
  const source = isRecord(value) ? value : {};

  const layout = isRecord(source.layout) ? source.layout : {};
  const brand = isRecord(source.brand) ? source.brand : {};
  const colors = isRecord(source.colors) ? source.colors : {};
  const legacyLightColors = {
    backgroundColor: colors.backgroundColor,
    textColor: colors.textColor,
    searchBackgroundColor: colors.searchBackgroundColor,
    searchTextColor: colors.searchTextColor,
  };
  const search = isRecord(source.search) ? source.search : {};
  const market = isRecord(source.market) ? source.market : {};
  const mobile = isRecord(source.mobile) ? source.mobile : {};
  const widgets = isRecord(source.widgets) ? source.widgets : {};
  const categoryMenu = isRecord(source.categoryMenu) ? source.categoryMenu : {};
  const collectionsMenu = isRecord(source.collectionsMenu)
    ? source.collectionsMenu
    : {};
  const utilityMenu = isRecord(source.utilityMenu) ? source.utilityMenu : {};
  const pagesMenu = isRecord(source.pagesMenu) ? source.pagesMenu : {};

  return {
    layout: {
      sticky: normalizeBoolean(layout.sticky, defaults.layout.sticky),
      fullWidth: normalizeBoolean(layout.fullWidth, defaults.layout.fullWidth),
    },
    brand: {
      logoUrl: defaults.brand.logoUrl,
      darkLogoUrl: defaults.brand.darkLogoUrl,
      logoAlt: normalizeString(brand.logoAlt, defaults.brand.logoAlt),
      desktopLogoWidth: normalizeLimit(
        brand.desktopLogoWidth,
        defaults.brand.desktopLogoWidth,
        80,
        260,
      ),
      mobileLogoWidth: normalizeLimit(
        brand.mobileLogoWidth,
        defaults.brand.mobileLogoWidth,
        72,
        180,
      ),
    },
    colors: {
      light: normalizeColorScheme(
        isRecord(colors.light) ? colors.light : legacyLightColors,
        defaults.colors.light,
      ),
      dark: normalizeColorScheme(colors.dark, defaults.colors.dark),
    },
    search: {
      enabled: normalizeBoolean(search.enabled, defaults.search.enabled),
      showAiButton: normalizeBoolean(
        search.showAiButton,
        defaults.search.showAiButton,
      ),
      placeholder: normalizeString(search.placeholder, defaults.search.placeholder),
      desktopWidth: normalizeLimit(
        search.desktopWidth,
        defaults.search.desktopWidth,
        360,
        900,
      ),
      height: normalizeLimit(search.height, defaults.search.height, 34, 52),
      borderRadius: normalizeLimit(
        search.borderRadius,
        defaults.search.borderRadius,
        0,
        999,
      ),
      borderColor: normalizeHexColor(
        search.borderColor,
        defaults.search.borderColor,
      ),
    },
    market: {
      showLanguageSelector: normalizeBoolean(
        market.showLanguageSelector,
        defaults.market.showLanguageSelector,
      ),
      showCurrencySelector: normalizeBoolean(
        market.showCurrencySelector,
        defaults.market.showCurrencySelector,
      ),
      defaultLanguage: normalizeString(
        market.defaultLanguage,
        defaults.market.defaultLanguage,
      ).toLowerCase(),
      defaultCurrency: normalizeString(
        market.defaultCurrency,
        defaults.market.defaultCurrency,
      ).toUpperCase(),
    },
    mobile: {
      showSearch: normalizeBoolean(
        mobile.showSearch,
        defaults.mobile.showSearch,
      ),
      showAccountSummary: normalizeBoolean(
        mobile.showAccountSummary,
        defaults.mobile.showAccountSummary,
      ),
      showCategoryShortcuts: normalizeBoolean(
        mobile.showCategoryShortcuts,
        defaults.mobile.showCategoryShortcuts,
      ),
      showCollections: normalizeBoolean(
        mobile.showCollections,
        defaults.mobile.showCollections,
      ),
      showMarketSelectors: normalizeBoolean(
        mobile.showMarketSelectors,
        defaults.mobile.showMarketSelectors,
      ),
      showThemeSelector: normalizeBoolean(
        mobile.showThemeSelector,
        defaults.mobile.showThemeSelector,
      ),
    },
    widgets: {
      showThemeToggle: normalizeBoolean(
        widgets.showThemeToggle,
        defaults.widgets.showThemeToggle,
      ),
      showAccountMenu: normalizeBoolean(
        widgets.showAccountMenu,
        defaults.widgets.showAccountMenu,
      ),
      showWishlist: normalizeBoolean(
        widgets.showWishlist,
        defaults.widgets.showWishlist,
      ),
      showCart: normalizeBoolean(widgets.showCart, defaults.widgets.showCart),
    },
    categoryMenu: {
      enabled: normalizeBoolean(categoryMenu.enabled, defaults.categoryMenu.enabled),
      position: normalizePosition(
        categoryMenu.position,
        defaults.categoryMenu.position,
      ),
      showMegaMenu: normalizeBoolean(
        categoryMenu.showMegaMenu,
        defaults.categoryMenu.showMegaMenu,
      ),
      showQuickLinks: normalizeBoolean(
        categoryMenu.showQuickLinks,
        defaults.categoryMenu.showQuickLinks,
      ),
      label: normalizeString(categoryMenu.label, defaults.categoryMenu.label),
      quickLimit: normalizeLimit(
        categoryMenu.quickLimit,
        defaults.categoryMenu.quickLimit,
        0,
        24,
      ),
      mobileLimit: normalizeLimit(
        categoryMenu.mobileLimit,
        defaults.categoryMenu.mobileLimit,
        0,
        16,
      ),
      showPromoCard: normalizeBoolean(
        categoryMenu.showPromoCard,
        defaults.categoryMenu.showPromoCard,
      ),
      promoTitle: normalizeString(
        categoryMenu.promoTitle,
        defaults.categoryMenu.promoTitle,
      ),
      promoSubtitle: normalizeString(
        categoryMenu.promoSubtitle,
        defaults.categoryMenu.promoSubtitle,
      ),
      promoImageSrc: normalizeString(
        categoryMenu.promoImageSrc,
        defaults.categoryMenu.promoImageSrc,
      ),
      promoHref: normalizeString(
        categoryMenu.promoHref,
        defaults.categoryMenu.promoHref,
      ),
    },
    collectionsMenu: {
      enabled: normalizeBoolean(
        collectionsMenu.enabled,
        defaults.collectionsMenu.enabled,
      ),
      position: normalizePosition(
        collectionsMenu.position,
        defaults.collectionsMenu.position,
      ),
      label: normalizeString(collectionsMenu.label, defaults.collectionsMenu.label),
      limit: normalizeLimit(collectionsMenu.limit, defaults.collectionsMenu.limit, 0, 24),
    },
    utilityMenu: {
      enabled: normalizeBoolean(utilityMenu.enabled, defaults.utilityMenu.enabled),
    },
    pagesMenu: {
      enabled: normalizeBoolean(pagesMenu.enabled, defaults.pagesMenu.enabled),
      appPagePaths: Array.isArray(pagesMenu.appPagePaths)
        ? normalizeStringArray(pagesMenu.appPagePaths)
        : defaults.pagesMenu.appPagePaths,
      pageKeys: Array.isArray(pagesMenu.pageKeys)
        ? normalizeStringArray(pagesMenu.pageKeys)
        : defaults.pagesMenu.pageKeys,
      customPageIds: Array.isArray(pagesMenu.customPageIds)
        ? normalizeStringArray(pagesMenu.customPageIds)
        : defaults.pagesMenu.customPageIds,
      order: Array.isArray(pagesMenu.order)
        ? normalizeStringArray(pagesMenu.order)
        : defaults.pagesMenu.order,
      positions: {
        ...defaults.pagesMenu.positions,
        ...normalizePositionRecord(pagesMenu.positions),
      },
    },
  };
}
