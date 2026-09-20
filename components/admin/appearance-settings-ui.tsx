"use client";

import type React from "react";
import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SettingCard({
  icon,
  label,
  checked,
  onCheckedChange,
  hasInfo,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hasInfo?: boolean;
}) {
  return (
    <div
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "cursor-pointer relative flex flex-col justify-between p-4 h-[100px] rounded-2xl border transition-all duration-200 select-none",
        checked
          ? "bg-background border-border shadow-sm"
          : "bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-border",
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "transition-colors",
            checked ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={checked}
            onCheckedChange={onCheckedChange}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-medium text-sm">{label}</span>
        {hasInfo && <Info className="h-4 w-4 text-muted-foreground/40" />}
      </div>
    </div>
  );
}

export function SectionContainer({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative p-4 pt-8 rounded-2xl border border-border/60 bg-muted/10">
      <span className="absolute -top-2.5 left-4 px-2.5 py-1 bg-primary/10 text-primary border border-primary/25 text-[10px] font-bold uppercase rounded-full tracking-wider flex items-center gap-1 ring-4 ring-background shadow-sm">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

export function NavLayoutCard({
  type,
  isActive,
  onClick,
}: {
  type: "vertical" | "horizontal" | "mini";
  isActive: boolean;
  onClick: () => void;
}) {
  const renderVisual = () => {
    const sidebarColor = isActive ? "bg-primary" : "bg-muted-foreground/30";
    const contentLight = isActive ? "bg-primary/15" : "bg-muted-foreground/10";
    const contentDark = isActive ? "bg-primary/8" : "bg-muted-foreground/5";

    if (type === "vertical") {
      return (
        <div className="flex h-full w-full gap-1 p-1.5">
          <div className={cn("w-[35%] h-full rounded-md", sidebarColor)} />
          <div className="flex-1 flex flex-col gap-1">
            <div className={cn("h-[30%] w-full rounded-md", contentLight)} />
            <div className={cn("flex-1 w-full rounded-md", contentDark)} />
          </div>
        </div>
      );
    }
    if (type === "horizontal") {
      return (
        <div className="flex flex-col h-full w-full gap-1 p-1.5">
          <div
            className={cn(
              "h-[25%] w-full rounded-md flex items-center justify-center gap-1",
              contentLight,
            )}
          >
            <div className="h-0.5 w-2 rounded-full bg-muted-foreground/30" />
            <div className="h-0.5 w-2 rounded-full bg-muted-foreground/30" />
          </div>
          <div className={cn("flex-1 w-full rounded-md", contentDark)} />
        </div>
      );
    }

    return (
      <div className="flex h-full w-full gap-1 p-1.5">
        <div className="w-[18%] h-full flex flex-col items-center pt-1.5">
          <div className={cn("h-1.5 w-1.5 rounded-full", sidebarColor)} />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className={cn("h-[30%] w-full rounded-md", contentLight)} />
          <div className={cn("flex-1 w-full rounded-md", contentDark)} />
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer aspect-[4/3] rounded-xl flex items-center justify-center transition-all overflow-hidden",
        isActive
          ? "border-2 border-primary bg-background shadow-sm ring-2 ring-primary/20"
          : "border border-transparent bg-muted/40 hover:bg-muted/60",
      )}
    >
      <div className="w-full h-full bg-background rounded-lg overflow-hidden">
        {renderVisual()}
      </div>
    </div>
  );
}

export function NavColorCard({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const isIntegrate = label === "Integrate";

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer flex items-center justify-center gap-2 h-11 rounded-2xl transition-all font-medium text-sm",
        isActive
          ? "bg-background border border-border shadow-sm text-foreground"
          : "bg-transparent border border-transparent text-muted-foreground hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "h-6 w-6 rounded-lg border-2 flex items-start p-0.5 gap-0.5 overflow-hidden",
          isActive
            ? "border-primary/50 bg-primary/5"
            : "border-muted-foreground/30 bg-muted/50",
        )}
      >
        <div
          className={cn(
            "w-1.5 h-full rounded-sm",
            isActive
              ? "bg-primary"
              : isIntegrate
                ? "bg-primary/60"
                : "bg-muted-foreground/40",
          )}
        />
        <div className="flex-1 h-full flex flex-col gap-0.5">
          <div
            className={cn(
              "h-1/3 w-full rounded-sm",
              isActive ? "bg-primary/20" : "bg-muted-foreground/15",
            )}
          />
          <div
            className={cn(
              "flex-1 w-full rounded-sm",
              isActive ? "bg-primary/10" : "bg-muted-foreground/10",
            )}
          />
        </div>
      </div>
      <span>{label}</span>
    </div>
  );
}

export function PresetColorCard({
  color,
  isActive,
  onClick,
}: {
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer overflow-hidden rounded-xl transition-all h-16 p-1.5",
        isActive
          ? "bg-background border border-border/80 shadow-sm"
          : "bg-transparent border border-transparent hover:bg-muted/30",
      )}
    >
      <div className="flex h-full w-full gap-1 bg-background rounded-lg overflow-hidden p-1">
        <div
          className="w-[35%] h-full rounded-md"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 flex flex-col gap-0.5 h-full">
          <div
            className="h-[35%] w-full rounded-md"
            style={{ backgroundColor: color, opacity: 0.3 }}
          />
          <div
            className="flex-1 w-full rounded-md"
            style={{ backgroundColor: color, opacity: 0.15 }}
          />
        </div>
      </div>
    </div>
  );
}
