"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AbandonedCartsClient() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/abandoned-carts");
      const data = await res.json();
      if (data.success) setRows(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const detect = async () => {
    setDetecting(true);
    try {
      const res = await fetch("/api/admin/abandoned-carts/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: 24 }),
      });
      await res.json();
      await load();
    } finally {
      setDetecting(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Abandoned carts detected in the last 24 hours
          </span>
          <Button onClick={detect} disabled={detecting}>
            {detecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Detect Now
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Items</th>
                  <th className="py-2 pr-4">Last Action</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b">
                    <td className="py-2 pr-4">{row._id}</td>
                    <td className="py-2 pr-4">{row.totalItems ?? row.items?.length ?? 0}</td>
                    <td className="py-2 pr-4">
                      {row.lastActionAt
                        ? new Date(row.lastActionAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-2 pr-4">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
