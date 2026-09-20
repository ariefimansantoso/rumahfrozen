"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useMultiVendorMode } from "@/providers/app-settings-provider";

export function StoreSellerCTA({ locale, storeName }: { locale: string; storeName: string }) {
  const t = useTranslations();
  const { isMultiVendor, isLoading } = useMultiVendorMode();

  if (isLoading || !isMultiVendor) return null;

  return (
    <section className="py-16 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t("home.startSelling", { storeName })}
          </h2>
          <p className="mb-8 opacity-90">{t("home.startSellingDescription")}</p>
          <Button size="lg" variant="secondary" asChild>
            <Link href={`/${locale}/become-vendor`}>
              {t("home.getStartedFree")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

