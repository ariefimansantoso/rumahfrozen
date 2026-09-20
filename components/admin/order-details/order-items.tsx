"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppImage } from "@/components/ui/app-image";
import { useCurrency } from "@/providers/currency-provider";
import { IOrder } from "@/types";

interface OrderItemsProps {
  order: IOrder;
}

export function OrderItems({ order }: OrderItemsProps) {
  const t = useTranslations("admin");
  const { formatPrice } = useCurrency();

  const isSplitShipment = order.subOrders && order.subOrders.length > 1;

  return (
    <Card className="gap-4 p-0">
      <CardHeader className="pt-6">
        <CardTitle>{t("orderDetails.orderItems")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isSplitShipment && (
          <div className="px-6 pb-4">
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 font-semibold">
                {t("orderDetails.splitShipment")}
              </AlertTitle>
              <AlertDescription className="text-amber-700">
                {t("orderDetails.splitShipmentDescription")}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">{t("orderDetails.item")}</TableHead>
              <TableHead>{t("orderDetails.price")}</TableHead>
              <TableHead>{t("orderDetails.quantity")}</TableHead>
              <TableHead className="text-right">{t("orderDetails.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16 min-w-16 overflow-hidden rounded-md border bg-muted">
                      <AppImage
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium line-clamp-2">
                        {item.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t("orderDetails.sku")}: {item.sku}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{formatPrice(item.price)}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(item.price * item.quantity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="p-6 border-t bg-muted/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("orderDetails.subtotal")}</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("orderDetails.shipping")}</span>
            <span>{formatPrice(order.shippingCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("orderDetails.tax")}</span>
            <span>{formatPrice(order.tax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("orderDetails.discount")}</span>
            <span className="text-red-600">-{formatPrice(order.discount)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>{t("orderDetails.totalLabel")}</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
