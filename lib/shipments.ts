import type { Address, IOrder, IVendor, OrderItem } from "@/types";
import type { ISettings } from "@/models/settings.model";

export function completeAddress(
  address: Partial<Address> | undefined,
  fallbackName: string,
): Address {
  return {
    fullName:
      address?.fullName ||
      [address?.firstName, address?.lastName].filter(Boolean).join(" ") ||
      fallbackName,
    firstName: address?.firstName,
    lastName: address?.lastName,
    street: address?.street || "",
    apartment: address?.apartment,
    city: address?.city || "",
    state: address?.state || "",
    postalCode: address?.postalCode || "",
    country: address?.country || "",
    phone: address?.phone,
  };
}

export function adminShipFrom(settings: ISettings): Address {
  return completeAddress(
    {
      fullName: settings.general?.storeName || "Store",
      street: settings.general?.storeAddress || "",
      phone: settings.general?.storePhone || "",
    },
    settings.general?.storeName || "Store",
  );
}

export function vendorShipFrom(vendor: IVendor): Address {
  const origin = vendor.shipping?.origin;
  return completeAddress(
    {
      fullName: vendor.storeName,
      street: origin?.address1 || vendor.address?.street || "",
      apartment: origin?.address2,
      city: origin?.city || vendor.address?.city || "",
      state: origin?.state || vendor.address?.state || "",
      postalCode: origin?.postalCode || vendor.address?.postalCode || "",
      country: origin?.country || vendor.address?.country || "",
      phone: vendor.address?.phone,
    },
    vendor.storeName,
  );
}

export function shipmentItemsForOrder(
  order: Pick<IOrder, "items" | "subOrders">,
  vendorId?: string,
): OrderItem[] {
  if (!vendorId) return order.items || [];
  const subOrder = order.subOrders?.find(
    (entry) => String(entry.vendorId) === vendorId,
  );
  return subOrder?.items || [];
}

