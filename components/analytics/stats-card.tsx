"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  change?: number;
  changeLabel?: string;
  className?: string;
  valuePrefix?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  change,
  changeLabel,
  className,
  valuePrefix = "",
}: StatsCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === 0;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {valuePrefix}
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {isPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
            {isNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
            {isNeutral && <Minus className="h-4 w-4 text-muted-foreground" />}
            <span
              className={cn(
                "text-xs font-medium",
                isPositive && "text-green-500",
                isNegative && "text-red-500",
                isNeutral && "text-muted-foreground"
              )}
            >
              {isPositive && "+"}
              {change}%
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatsGridProps {
  children: ReactNode;
  className?: string;
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
