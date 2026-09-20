"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { useEffect } from "react";

export function WishlistHeaderIcon() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const { items, fetchWishlist, isSynced } = useWishlist();

  useEffect(() => {
    if (!isSynced) {
      fetchWishlist();
    }
  }, [isSynced, fetchWishlist]);

  const itemCount = items.length;

  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link href={`/${locale}/wishlist`} aria-label="Wishlist">
        <Heart className="h-5 w-5" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
            {itemCount > 9 ? "9+" : itemCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
