import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ReturnPolicyPageView } from "@/components/store/return-policy-page-view";
import { getStorefrontSettings } from "@/lib/storefront-settings";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "Return and Refund Policy",
  description:
    "Learn how returns, refunds, exchanges, eligibility, and refund timing work on Storify.",
};

export default async function ReturnsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { contentPages, storeEmail, storeName, storePhone } =
    await getStorefrontSettings();
  if (!contentPages.returns.visible) {
    notFound();
  }

  return (
    <ReturnPolicyPageView
      locale={locale}
      page={contentPages.returns}
      storeName={storeName}
      supportEmail={storeEmail}
      supportPhone={storePhone}
    />
  );
}
