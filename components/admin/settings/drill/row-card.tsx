"use client";

import type { ReactNode } from "react";

export function RowCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      {title && (
        <header className="px-1 pb-3">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border/70">
        <ul className="divide-y divide-border/60">{children}</ul>
      </div>
    </section>
  );
}
