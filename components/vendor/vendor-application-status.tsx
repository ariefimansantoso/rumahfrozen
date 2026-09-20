import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { VENDOR_STATUS } from "@/config/app.config";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VendorApplicationStatusProps {
  status?: string;
  storeName?: string;
}

export function VendorApplicationStatus({
  status,
  storeName,
}: VendorApplicationStatusProps) {
  const isPending = status === VENDOR_STATUS.PENDING;
  const isRejected = status === VENDOR_STATUS.REJECTED;
  const isSuspended = status === VENDOR_STATUS.SUSPENDED;

  const Icon = isPending
    ? Clock
    : isRejected
      ? XCircle
      : isSuspended
        ? AlertTriangle
        : CheckCircle2;

  const title = isPending
    ? "Application under review"
    : isRejected
      ? "Application rejected"
      : isSuspended
        ? "Vendor account suspended"
        : "Vendor application status";

  const description = isPending
    ? "Your vendor profile exists, but it is waiting for admin approval. Until then, vendor tools, public store visibility, products, orders, payments, and payouts are locked."
    : isRejected
      ? "Your vendor application was not approved. Your normal user account remains active, but vendor selling access is unavailable."
      : isSuspended
        ? "Your vendor selling access is suspended. Products, orders, payments, and payouts are locked until an admin restores access."
        : "Your vendor access is not active yet.";

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full border-border bg-card shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Icon className="h-7 w-7 text-muted-foreground" />
            </div>
            <Badge variant="outline" className="mb-4 capitalize">
              {status || "pending"}
            </Badge>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {storeName ? (
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {storeName}
              </p>
            ) : null}
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
