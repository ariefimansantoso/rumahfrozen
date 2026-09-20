"use client";

import { IOrder } from "@/types";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, CreditCard } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderCustomerProps {
  order: IOrder & {
    customerId?: {
      _id: string;
      name: string;
      email: string;
      phone?: string;
      image?: string;
    } | string;
  };
}

export function OrderCustomer({ order }: OrderCustomerProps) {
  const t = useTranslations("admin");

  const customer = typeof order.customerId === 'object' ? order.customerId : null;
  const shipping = order.shippingAddress;
  const billing = order.billingAddress || shipping;
  const getAddressName = (address: typeof shipping) =>
    address.fullName ||
    [address.firstName, address.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>{t("orderDetails.customer")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={customer?.image} />
              <AvatarFallback>
                {customer?.name?.charAt(0).toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{customer?.name || t("orderDetails.guestCheckout")}</p>
              {customer && (
                <p className="text-sm text-muted-foreground">
                  {t("orderDetails.customerSince")} {new Date().getFullYear()}
                </p>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">{t("orderDetails.contactInfo")}</h4>
            </div>
            <div className="grid gap-2 text-sm">
              {customer?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${customer.email}`} className="hover:underline">
                    {customer.email}
                  </a>
                </div>
              )}
              {(customer?.phone || shipping.phone) && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${customer?.phone || shipping.phone}`} className="hover:underline">
                    {customer?.phone || shipping.phone}
                  </a>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">{t("orderDetails.shippingAddress")}</h4>
            </div>
            <div className="text-sm">
              {getAddressName(shipping) ? <p>{getAddressName(shipping)}</p> : null}
              <p>{shipping.street}</p>
              {shipping.apartment ? <p>{shipping.apartment}</p> : null}
              <p>{shipping.city}, {shipping.state} {shipping.postalCode}</p>
              <p>{shipping.country}</p>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">{t("orderDetails.billingAddress")}</h4>
            </div>
            <div className="text-sm">
              {getAddressName(billing) ? <p>{getAddressName(billing)}</p> : null}
              <p>{billing.street}</p>
              {billing.apartment ? <p>{billing.apartment}</p> : null}
              <p>{billing.city}, {billing.state} {billing.postalCode}</p>
              <p>{billing.country}</p>
            </div>

            <Separator className="my-4" />

             <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">{t("orderDetails.payment")}</h4>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{order.paymentMethod.replace(/_/g, " ")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
