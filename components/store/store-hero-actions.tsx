"use client";

import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMultiVendorMode } from "@/providers/app-settings-provider";

export function StoreHeroActions({ locale }: { locale: string }) {
  const t = useTranslations();
  const { isMultiVendor, isLoading } = useMultiVendorMode();

  return (
    <>
      <Badge variant="secondary" className="mb-4">
        {isMultiVendor ? t("common.multiVendorMarketplace") : t("common.onlineStore")}
      </Badge>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild>
          <Link href={`/${locale}/products`}>
            {t("common.shopNow")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        {!isLoading && isMultiVendor && (
          <Button size="lg" variant="outline" asChild>
            <Link href={`/${locale}/become-vendor`}>
              <Store className="mr-2 h-4 w-4" />
              {t("home.becomeASeller")}
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}

