"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useUnsavedNavigation } from "./use-unsaved-navigation";

export function DrillRow({
  href,
  icon: Icon,
  title,
  primaryValue,
  secondaryValue,
  trailing,
}: {
  href: string;
  icon?: LucideIcon;
  title: string;
  primaryValue?: string;
  secondaryValue?: string;
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const navigate = useUnsavedNavigation();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    void navigate(href, () => router.push(href));
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight">
            {title}
          </span>
          {primaryValue && (
            <span className="mt-0.5 block truncate text-sm text-muted-foreground leading-tight">
              {primaryValue}
            </span>
          )}
          {secondaryValue && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground leading-tight">
              {secondaryValue}
            </span>
          )}
        </span>
        {trailing && <span className="shrink-0">{trailing}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </button>
    </li>
  );
}
