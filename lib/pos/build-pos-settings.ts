import type { ISettings } from "@/models/settings.model";
import { resolveStripeCredentials } from "@/lib/credentials";

export interface POSSoundSettings {
  enabled: boolean;
  volume: number;
  addToCart: boolean;
  orderComplete: boolean;
  payment: boolean;
  error: boolean;
}

export interface POSSettings {
  taxRate: number;
  currency: string;
  locale: string;
  storeName?: string;
  storePhone?: string;
  storeEmail?: string;
  storeAddress?: string;
  storeDomain?: string;
  paymentMethods: string[];
  stripe?: {
    enabled: boolean;
    configured: boolean;
    publishableKey?: string;
  };
  posLocationId?: string;
  printedReceiptsEnabled?: boolean;
  receiptPrinter?: string;
  sound?: POSSoundSettings;
}

export function buildPOSSettings(settings: ISettings): POSSettings {
  const customize = settings.pos?.customize;
  const stripeCredentials = resolveStripeCredentials(settings.payment?.stripe);
  const stripeEnabled = Boolean(settings.payment?.stripe?.enabled);
  return {
    taxRate: settings.orders?.taxRate ?? 0,
    currency: settings.general?.defaultCurrency ?? "USD",
    locale: settings.general?.defaultLanguage ?? "en",
    storeName: settings.general?.storeName ?? "Store",
    storePhone: settings.general?.storePhone ?? "",
    storeEmail: settings.general?.storeEmail ?? "",
    storeAddress: settings.general?.storeAddress ?? "",
    storeDomain: settings.general?.storeDomain ?? "",
    paymentMethods: settings.pos?.checkout?.paymentMethods ?? ["cash", "card"],
    stripe: {
      enabled: stripeEnabled,
      configured: stripeEnabled && Boolean(stripeCredentials.secretKey),
      publishableKey: stripeCredentials.publishableKey,
    },
    posLocationId: settings.pos?.defaultPosLocationId,
    printedReceiptsEnabled: customize?.printedReceiptsEnabled ?? false,
    receiptPrinter: customize?.receiptPrinter ?? "",
    sound: {
      enabled: customize?.soundEnabled ?? true,
      volume: customize?.soundVolume ?? 50,
      addToCart: customize?.soundAddToCart ?? true,
      orderComplete: customize?.soundOrderComplete ?? true,
      payment: customize?.soundPayment ?? true,
      error: customize?.soundError ?? true,
    },
  };
}
