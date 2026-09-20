"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AiFieldActionsProps = {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function AiFieldActions({
  children,
  action,
  className,
}: AiFieldActionsProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <div>{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
