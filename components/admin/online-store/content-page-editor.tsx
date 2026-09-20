"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/toast-notification";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import {
  CONTENT_PAGE_META,
  normalizeContentPagesSettings,
  type NonFaqContentPageKey,
} from "@/lib/content-pages-config";

type SettingsResponse = {
  success?: boolean;
  data?: {
    contentPages?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ContentPageEditor({
  locale,
  pageKey,
}: {
  locale: string;
  pageKey: NonFaqContentPageKey;
}) {
  const pageMeta = CONTENT_PAGE_META[pageKey];

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visible, setVisible] = useState(true);
  const [initialTitle, setInitialTitle] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [initialVisible, setInitialVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/admin/settings", { method: "GET" });
        const payload = (await response.json()) as SettingsResponse;

        if (
          !response.ok ||
          payload.success !== true ||
          !isRecord(payload.data)
        ) {
          throw new Error("Failed to load settings");
        }

        const normalized = normalizeContentPagesSettings(
          payload.data.contentPages,
        );
        setTitle(normalized[pageKey].title);
        setContent(normalized[pageKey].content);
        setVisible(normalized[pageKey].visible);
        setInitialTitle(normalized[pageKey].title);
        setInitialContent(normalized[pageKey].content);
        setInitialVisible(normalized[pageKey].visible);
      } catch {
        toast.error(`Failed to load ${pageMeta.adminTitle} editor`);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [pageKey, pageMeta.adminTitle]);

  const isDirty = useMemo(
    () =>
      title !== initialTitle ||
      content !== initialContent ||
      visible !== initialVisible,
    [title, initialTitle, content, initialContent, visible, initialVisible],
  );

  const save = async () => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "contentPages",
          data: {
            [pageKey]: {
              title,
              content,
              visible,
            },
          },
        }),
      });

      const payload = (await response.json()) as SettingsResponse;
      if (!response.ok || payload.success !== true || !isRecord(payload.data)) {
        throw new Error("Failed to save");
      }

      const normalized = normalizeContentPagesSettings(
        payload.data.contentPages,
      );
      setTitle(normalized[pageKey].title);
      setContent(normalized[pageKey].content);
      setVisible(normalized[pageKey].visible);
      setInitialTitle(normalized[pageKey].title);
      setInitialContent(normalized[pageKey].content);
      setInitialVisible(normalized[pageKey].visible);
      toast.success(`${pageMeta.adminTitle} saved successfully`);
    } catch {
      toast.error(`Failed to save ${pageMeta.adminTitle}`);
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = () => {
    window.open(
      `/${locale}${pageMeta.publicPath}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Loading page editor...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={pageMeta.adminTitle}
        description={pageMeta.description}
        actions={
          <>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/online-store/pages">Back to Pages</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPreview}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </>
        }
      />

      <Card className="rounded-sm border border-border bg-card p-4 shadow-[0_3px_14px_rgba(15,23,42,0.06)] md:p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Page Title
            </p>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={pageMeta.adminTitle}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Page Content
            </p>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={`Write ${pageMeta.adminTitle} content...`}
              className="min-h-[360px]"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Visibility
            </p>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Visible on storefront
                </p>
                <p className="text-xs text-muted-foreground">
                  Hide to temporarily unpublish this page.
                </p>
              </div>
              <Switch checked={visible} onCheckedChange={setVisible} />
            </div>
          </div>
        </div>
      </Card>

      {!isDirty && (
        <p className="text-sm text-muted-foreground">
          All changes are saved. This page is synced with storefront content.
        </p>
      )}
    </div>
  );
}
