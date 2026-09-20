import { Heart } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { WishlistItems } from "@/components/wishlist/wishlist-items";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function WishlistPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-primary/10">
          <Heart className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {t("wishlist.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("account.wishlistDesc")}
          </p>
        </div>
      </div>

      {/* Wishlist Items */}
      <WishlistItems />
    </div>
  );
}
