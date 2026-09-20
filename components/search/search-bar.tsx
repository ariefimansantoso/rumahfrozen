"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  showFiltersButton?: boolean;
  onFiltersClick?: () => void;
}

export function SearchBar({
  className,
  placeholder,
  showFiltersButton = false,
  onFiltersClick,
}: SearchBarProps) {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params.locale as string) || "en";

  const [query, setQuery] = useState(searchParams.get("search") || "");

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
  }, [searchParams]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());

      if (query.trim()) {
        params.set("search", query.trim());
        params.set("page", "1");
      } else {
        params.delete("search");
      }

      router.push(`/${locale}/products?${params.toString()}`);
    },
    [query, searchParams, router, locale]
  );

  const handleClear = () => {
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    router.push(`/${locale}/products?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className={cn("relative", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              placeholder ||
              t("search.placeholder")
            }
            className="pl-10 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit">
          {t("search.search")}
        </Button>
        {showFiltersButton && (
          <Button type="button" variant="outline" onClick={onFiltersClick}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
