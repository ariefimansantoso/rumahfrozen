import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export interface LoadingShellProps {
  label?: string;
}

export function LoadingShell({ label = "Loading" }: LoadingShellProps) {
  return (
    <main className="min-h-[70vh] w-full px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <p className="sr-only" aria-live="polite">
          {label}
        </p>

        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-56" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-4 shadow-sm"
              aria-hidden="true"
            >
              <Skeleton className="h-4 w-24" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

