import type { ComponentProps, ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardStatTrendDirection = "up" | "down" | "neutral";

export interface DashboardStatTrendConfig {
  value: ReactNode;
  direction?: DashboardStatTrendDirection;
}

export interface DashboardStatCardItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
  subLabel?: ReactNode;
  icon?: ReactNode;
  trend?: DashboardStatTrendConfig;
  className?: string;
}

export interface DashboardStatCardProps
  extends Omit<ComponentProps<"article">, "children"> {
  label: ReactNode;
  value: ReactNode;
  subLabel?: ReactNode;
  icon?: ReactNode;
  trend?: DashboardStatTrendConfig;
  /** When true, the label and icon stay visible but the value/sub-label swap to skeletons. */
  loading?: boolean;
}

export interface DashboardStatsGridProps {
  stats: DashboardStatCardItem[];
  className?: string;
  cardClassName?: string;
}

export interface DashboardStatTrendProps extends DashboardStatTrendConfig {
  className?: string;
}

const trendClassNames: Record<DashboardStatTrendDirection, string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  neutral: "text-muted-foreground",
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function DashboardStatTrend({
  value,
  direction = "neutral",
  className,
}: DashboardStatTrendProps) {
  const Icon = trendIcons[direction];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-sm",
        trendClassNames[direction],
        className,
      )}
    >
      {value}
      <Icon className="size-3.5" />
    </span>
  );
}

export function DashboardStatCard({
  label,
  value,
  subLabel,
  icon,
  trend,
  loading = false,
  className,
  ...props
}: DashboardStatCardProps) {
  const valueTitle =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : undefined;

  return (
    <article
      className={cn(
        "!rounded-sm border border-border bg-card px-5 py-5",
        className,
      )}
      {...props}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm leading-none text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <span className="shrink-0 text-muted-foreground [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-6 w-32" />
      ) : (
        <p
          className="truncate text-xl font-semibold leading-none tracking-tight text-foreground"
          title={valueTitle}
        >
          {value}
        </p>
      )}

      {loading ? (
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      ) : subLabel || trend ? (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm leading-none text-muted-foreground">
          {subLabel ? <span className="min-w-0 truncate">{subLabel}</span> : null}
          {trend ? <DashboardStatTrend {...trend} /> : null}
        </div>
      ) : null}
    </article>
  );
}

export function DashboardStatsGrid({
  stats,
  className,
  cardClassName,
}: DashboardStatsGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6",
        className,
      )}
    >
      {stats.map(({ id, className: itemClassName, ...stat }) => (
        <DashboardStatCard
          key={id}
          {...stat}
          className={cn(cardClassName, itemClassName)}
        />
      ))}
    </div>
  );
}

export function DashboardStatCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "!rounded-sm border border-border bg-card px-5 py-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-5 rounded-full" />
      </div>
      <Skeleton className="h-6 w-32" />
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

export function DashboardStatsGridSkeleton({
  items = 6,
  className,
  cardClassName,
}: {
  items?: number;
  className?: string;
  cardClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6",
        className,
      )}
    >
      {Array.from({ length: items }).map((_, index) => (
        <DashboardStatCardSkeleton
          key={`dashboard-stat-skeleton-${index}`}
          className={cardClassName}
        />
      ))}
    </div>
  );
}
