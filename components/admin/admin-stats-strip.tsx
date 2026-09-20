import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface AdminStatsStripItem {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  iconClassName?: string;
}

interface AdminStatsStripProps {
  items: AdminStatsStripItem[];
  columnsClassName?: string;
}

function getIconThemeClasses(iconClassName?: string) {
  if (!iconClassName) {
    return "bg-muted text-muted-foreground dark:bg-muted/70 dark:text-foreground";
  }

  if (iconClassName.includes("blue")) {
    return `${iconClassName} dark:bg-blue-500/20 dark:text-blue-300`;
  }
  if (iconClassName.includes("green")) {
    return `${iconClassName} dark:bg-green-500/20 dark:text-green-300`;
  }
  if (iconClassName.includes("indigo")) {
    return `${iconClassName} dark:bg-indigo-500/20 dark:text-indigo-300`;
  }
  if (iconClassName.includes("violet")) {
    return `${iconClassName} dark:bg-violet-500/20 dark:text-violet-300`;
  }
  if (iconClassName.includes("cyan")) {
    return `${iconClassName} dark:bg-cyan-500/20 dark:text-cyan-300`;
  }
  if (iconClassName.includes("teal")) {
    return `${iconClassName} dark:bg-teal-500/20 dark:text-teal-300`;
  }
  if (iconClassName.includes("amber")) {
    return `${iconClassName} dark:bg-amber-500/20 dark:text-amber-300`;
  }
  if (iconClassName.includes("orange")) {
    return `${iconClassName} dark:bg-orange-500/20 dark:text-orange-300`;
  }
  if (iconClassName.includes("rose")) {
    return `${iconClassName} dark:bg-rose-500/20 dark:text-rose-300`;
  }

  return `${iconClassName} dark:bg-muted/70 dark:text-foreground`;
}

export function AdminStatsStrip({
  items,
  columnsClassName = "xl:grid-cols-5",
}: AdminStatsStripProps) {
  return (
    <Card className="overflow-hidden rounded-[12px] border border-border/70 p-0 shadow-sm">
      <div
        className={`grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 ${columnsClassName}`}
      >
        {items.map((item) => (
          <div key={item.title} className="px-6 py-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-0 pt-0">
              <CardTitle className="text-md font-medium text-foreground/85">
                {item.title}
              </CardTitle>
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-black/5 dark:ring-white/10 ${getIconThemeClasses(item.iconClassName)}`}
              >
                {item.icon}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-0 pb-0">
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {typeof item.value === "number"
                  ? item.value.toLocaleString()
                  : item.value}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface AdminStatsStripSkeletonProps {
  items?: number;
  className?: string;
}

export function AdminStatsStripSkeleton({
  items = 5,
  className = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5",
}: AdminStatsStripSkeletonProps) {
  return (
    <div className={`grid gap-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton
          key={`admin-stat-skeleton-${i}`}
          className="h-44 w-full rounded-2xl"
        />
      ))}
    </div>
  );
}
