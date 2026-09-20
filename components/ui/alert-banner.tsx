"use client";

import { type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Alert Variants
 */
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 flex gap-3 items-start",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        success:
          "bg-green-50 text-green-900 border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-800",
        error:
          "bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-800",
        warning:
          "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-800",
        info: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Alert Icons
 */
const AlertIcons: Record<string, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  default: <Info className="h-5 w-5 text-muted-foreground" />,
};

interface AlertBannerProps extends VariantProps<typeof alertVariants> {
  title?: string;
  message: string;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Alert Banner Component
 * For inline alerts and notifications
 */
export function AlertBanner({
  variant = "default",
  title,
  message,
  onDismiss,
  action,
  className,
}: AlertBannerProps) {
  const icon = AlertIcons[variant || "default"];

  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <p className="text-sm opacity-90">{message}</p>
        {action && (
          <Button
            variant="link"
            size="sm"
            className="mt-2 h-auto p-0 text-current underline"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-6 w-6 -mr-2 -mt-1 opacity-70 hover:opacity-100"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Status Badge Component
 * For inline status indicators
 */
interface StatusBadgeProps {
  status: "success" | "error" | "warning" | "info" | "pending";
  label?: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const statusLabels: Record<string, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Info",
  pending: "Pending",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-green-500": status === "success",
          "bg-red-500": status === "error",
          "bg-yellow-500": status === "warning",
          "bg-blue-500": status === "info",
          "bg-gray-500 animate-pulse": status === "pending",
        })}
      />
      {label || statusLabels[status]}
    </span>
  );
}

/**
 * Inline Error Display
 * For form field errors
 */
interface InlineErrorProps {
  message?: string;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  if (!message) return null;

  return (
    <p
      className={cn(
        "text-sm text-destructive flex items-center gap-1 mt-1",
        className
      )}
    >
      <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Success Message
 */
interface SuccessMessageProps {
  message: string;
  className?: string;
}

export function SuccessMessage({ message, className }: SuccessMessageProps) {
  return (
    <p
      className={cn(
        "text-sm text-green-600 dark:text-green-400 flex items-center gap-1",
        className
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </p>
  );
}
