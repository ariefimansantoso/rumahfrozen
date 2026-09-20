"use client";

import { useTranslations } from "next-intl";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CountrySelect } from "@/components/common/country-multi-select";
import type {
  ProductFormData,
  ShippingFormContext,
} from "@/components/admin/product-form/schema";

interface ShippingCardProps {
  form: UseFormReturn<ProductFormData>;
  isVendor: boolean;
  locale: string;
  shippingContext: ShippingFormContext;
  watchedIsPhysicalProduct: boolean;
  watchedMissingShippingWeight: boolean;
}

export function ShippingCard({
  form,
  isVendor,
  locale,
  shippingContext,
  watchedIsPhysicalProduct,
  watchedMissingShippingWeight,
}: ShippingCardProps) {
  const t = useTranslations();
  const watchedCountryOfOrigin = useWatch({
    control: form.control,
    name: "shipping.countryOfOrigin",
  });
  const watchedHsCode = useWatch({
    control: form.control,
    name: "shipping.hsCode",
  });

  return (
    <Card className="gap-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>
            {t("admin.productForm.sections.shipping")}
          </CardTitle>
          <Button asChild type="button" variant="ghost" size="sm">
            <Link
              href={
                isVendor
                  ? `/${locale}/vendor/settings`
                  : `/${locale}/admin/settings/shipping`
              }
            >
              Shipping and delivery
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="shipping.isPhysicalProduct"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <FormLabel>
                {t("admin.productForm.fields.physicalProduct")}
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {watchedIsPhysicalProduct && (
          <>
            {!shippingContext.enabled && (
              <p className="text-sm text-muted-foreground">
                Shipping rates are currently disabled. Product shipping
                data will be ready when rates are enabled.
              </p>
            )}
            {shippingContext.usesWeightRates &&
              watchedMissingShippingWeight && (
                <p className="text-sm text-destructive">
                  A product or variant weight is required by your active
                  weight-based rates.
                </p>
              )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="shipping.weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.productForm.fields.weight")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) =>
                          field.onChange(
                            parseFloat(e.target.value) || undefined,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipping.weightUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.productForm.fields.unit")}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "admin.productForm.fields.unit",
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="lb">lb</SelectItem>
                        <SelectItem value="oz">oz</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="shipping.countryOfOrigin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.productForm.fields.countryOfOrigin")}
                    </FormLabel>
                    <FormControl>
                      <CountrySelect
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder={t(
                          "admin.productForm.placeholders.country",
                        )}
                        searchPlaceholder={t(
                          "checkout.searchCountry",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shipping.hsCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.productForm.fields.hsCode")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          "admin.productForm.fields.hsCode",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="shipping.customsDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("admin.productForm.fields.customsDescription")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t(
                        "admin.productForm.placeholders.customsDescription",
                      )}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {shippingContext.customsEnabled &&
              (!watchedCountryOfOrigin?.trim() ||
                !watchedHsCode?.trim()) && (
                <p className="text-sm text-muted-foreground">
                  Add country of origin and HS code for more complete
                  international customs records.
                </p>
              )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
