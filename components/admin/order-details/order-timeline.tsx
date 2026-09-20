"use client";

import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { CheckCircle, Clock, FileText, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface OrderTimelineProps {
  orderId: string;
}

interface AuditLog {
  _id: string;
  action: string;
  createdAt: string;
  userEmail?: string;
  changes?: {
    summary?: string;
  };
  metadata?: Record<string, unknown>;
}

interface AuditLogsResponse {
  success: boolean;
  data: {
    logs: AuditLog[];
  };
}

export function OrderTimeline({ orderId }: OrderTimelineProps) {
  const t = useTranslations("admin");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [showComments, setShowComments] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    Promise.resolve()
      .then(() => {
        if (isCurrent) {
          setLoading(true);
        }

        return fetch(
          `/api/admin/audit-logs?resource=order&resourceId=${orderId}`,
        );
      })
      .then((res) => res.json() as Promise<AuditLogsResponse>)
      .then((data) => {
        if (isCurrent && data.success) {
          setLogs(data.data.logs);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to fetch timeline:", error);
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [orderId]);

  const handlePostNote = async () => {
    if (!note.trim()) return;

    // In a real app, this would post a comment/note to a separate collection
    // For now, we'll just log it as an audit event or update order notes
    // Implementation depends on backend support for comments
    // Here we'll just clear the input to simulate
    setNote("");
  };

  const getIcon = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "STATUS_CHANGE":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "UPDATE":
        return <FileText className="h-4 w-4 text-orange-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>{t("orderDetails.timeline")}</CardTitle>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show-comments"
            checked={showComments}
            onCheckedChange={(c) => setShowComments(!!c)}
          />
          <label
            htmlFor="show-comments"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t("orderDetails.showComments")}
          </label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          <Textarea
            placeholder={t("orderDetails.addMessagePlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-25"
          />
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
            </div>
            <Button size="sm" onClick={handlePostNote} disabled={!note.trim()}>
              {t("orderDetails.post")}
            </Button>
          </div>
        </div>

        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {loading ? (
            <div className="space-y-4 pl-12">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              {t("orderDetails.noEventsYet")}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log._id}
                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  {getIcon(log.action)}
                </div>

                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card text-card-foreground shadow-sm">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-sm">
                      {log.changes?.summary || log.action}
                    </div>
                    <time className="font-caveat font-medium text-xs text-primary">
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                      })}
                    </time>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("orderDetails.by")} {log.userEmail || t("orderDetails.system")}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
