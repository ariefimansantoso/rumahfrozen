"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Redo2,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Moon,
  Phone,
  Plus,
  Store,
  Sun,
  Trash2,
  Twitter,
  Undo2,
  Youtube,
} from "lucide-react";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { ImageUploadField } from "@/components/admin/settings/fields/image-upload-field";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import {
  getDefaultFooterSettings,
  normalizeFooterSettings,
  type FooterColorScheme,
  type FooterSettings,
} from "@/lib/footer-config";
import { cn } from "@/lib/utils";
import { ColorField, FieldRow, SwitchRow } from "@/components/admin/online-store/builder-fields";
import { setNestedValue } from "@/components/admin/online-store/set-nested-value";

interface FooterBuilderProps {
  locale: string;
}

type SettingsPayload = {
  success?: boolean;
  data?: {
    footer?: unknown;
    general?: {
      storeName?: unknown;
      storeDescription?: unknown;
      storeEmail?: unknown;
      storePhone?: unknown;
      storeAddress?: unknown;
      logoUrl?: unknown;
      darkModeLogoUrl?: unknown;
    };
    social?: Record<string, unknown>;
  };
};

const socialFields = [
  { key: "facebookUrl", label: "Facebook" },
  { key: "twitterUrl", label: "Twitter / X" },
  { key: "instagramUrl", label: "Instagram" },
  { key: "youtubeUrl", label: "YouTube" },
  { key: "linkedinUrl", label: "LinkedIn" },
  { key: "tiktokUrl", label: "TikTok" },
] as const;

const HISTORY_LIMIT = 100;

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeInitialFooter(payload: SettingsPayload): FooterSettings {
  const footer = normalizeFooterSettings(payload.data?.footer);
  const general = payload.data?.general;
  const social = payload.data?.social;

  if (!footer.brand.logoUrl && getString(general?.logoUrl)) {
    footer.brand.logoUrl = getString(general?.logoUrl);
  }
  if (!footer.brand.description && getString(general?.storeDescription)) {
    footer.brand.description = getString(general?.storeDescription);
  }
  if (!footer.contact.email && getString(general?.storeEmail)) {
    footer.contact.email = getString(general?.storeEmail);
  }
  if (!footer.contact.phone && getString(general?.storePhone)) {
    footer.contact.phone = getString(general?.storePhone);
  }
  if (!footer.contact.address && getString(general?.storeAddress)) {
    footer.contact.address = getString(general?.storeAddress);
  }

  for (const field of socialFields) {
    if (!footer.social.links[field.key] && getString(social?.[field.key])) {
      footer.social.links[field.key] = getString(social?.[field.key]);
    }
  }

  return footer;
}

function cloneFooter(value: FooterSettings): FooterSettings {
  return structuredClone(value);
}

function areFootersEqual(a: FooterSettings, b: FooterSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function FooterBuilder({ locale }: FooterBuilderProps) {
  const [footer, setFooter] = useState<FooterSettings>(getDefaultFooterSettings());
  const footerRef = useRef<FooterSettings>(footer);
  const [initialFooter, setInitialFooter] = useState<FooterSettings>(
    getDefaultFooterSettings(),
  );
  const [undoStack, setUndoStack] = useState<FooterSettings[]>([]);
  const [redoStack, setRedoStack] = useState<FooterSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings", { method: "GET" });
        const payload = (await response.json()) as SettingsPayload;

        if (!response.ok || payload.success !== true) {
          throw new Error("Failed to load settings");
        }

        const parsed = normalizeInitialFooter(payload);
        footerRef.current = parsed;
        setFooter(parsed);
        setInitialFooter(parsed);
        setUndoStack([]);
        setRedoStack([]);
      } catch {
        toast.error("Failed to load footer settings");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(footer) !== JSON.stringify(initialFooter),
    [footer, initialFooter],
  );
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const commitFooterChange = useCallback(
    (updater: (current: FooterSettings) => FooterSettings) => {
      const current = footerRef.current;
      const next = updater(cloneFooter(current));

      if (areFootersEqual(current, next)) return;

      footerRef.current = next;
      setUndoStack((prev) => [
        ...prev.slice(Math.max(0, prev.length - HISTORY_LIMIT + 1)),
        cloneFooter(current),
      ]);
      setRedoStack([]);
      setFooter(next);
    },
    [],
  );

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      const previous = prev.at(-1);
      if (!previous) return prev;

      const current = footerRef.current;
      footerRef.current = cloneFooter(previous);
      setRedoStack((redo) => [
        ...redo.slice(Math.max(0, redo.length - HISTORY_LIMIT + 1)),
        cloneFooter(current),
      ]);
      setFooter(cloneFooter(previous));
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      const next = prev.at(-1);
      if (!next) return prev;

      const current = footerRef.current;
      footerRef.current = cloneFooter(next);
      setUndoStack((undoHistory) => [
        ...undoHistory.slice(Math.max(0, undoHistory.length - HISTORY_LIMIT + 1)),
        cloneFooter(current),
      ]);
      setFooter(cloneFooter(next));
      return prev.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (key === "z") {
        event.preventDefault();
        undo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  const updateField = (path: string, value: unknown) => {
    commitFooterChange((current) => setNestedValue(current, path, value));
  };

  const updateColumn = (
    columnIndex: number,
    field: "title" | "id",
    value: string,
  ) => {
    commitFooterChange((current) => {
      const next = cloneFooter(current);
      next.linkColumns[columnIndex][field] = value;
      return next;
    });
  };

  const updateColumnLink = (
    columnIndex: number,
    linkIndex: number,
    field: "label" | "href" | "target",
    value: string,
  ) => {
    commitFooterChange((current) => {
      const next = cloneFooter(current);
      const link = next.linkColumns[columnIndex].links[linkIndex];
      if (field === "target") {
        link.target = value === "_blank" ? "_blank" : "_self";
      } else {
        link[field] = value;
      }
      return next;
    });
  };

  const updateColumnLinkVisibility = (
    columnIndex: number,
    linkIndex: number,
    visible: boolean,
  ) => {
    commitFooterChange((current) => {
      const next = cloneFooter(current);
      next.linkColumns[columnIndex].links[linkIndex].visible = visible;
      return next;
    });
  };

  const addColumn = () => {
    commitFooterChange((current) => {
      const next = cloneFooter(current);
      const nextNumber = next.linkColumns.length + 1;
      next.linkColumns.push({
        id: `custom-${nextNumber}`,
        title: "New Column",
        links: [{ label: "New Link", href: "/", target: "_self", visible: true }],
      });
      return next;
    });
  };

  const removeColumn = (columnIndex: number) => {
    commitFooterChange((current) => {
      const next = cloneFooter(current);
      next.linkColumns.splice(columnIndex, 1);
      return next;
    });
  };

  const addLink = (columnIndex: number) => {
    commitFooterChange((current) => {
      const next = cloneFooter(current);
      next.linkColumns[columnIndex].links.push({
        label: "New Link",
        href: "/",
        target: "_self",
        visible: true,
      });
      return next;
    });
  };

  const removeLink = (columnIndex: number, linkIndex: number) => {
    commitFooterChange((current) => {
      const next = cloneFooter(current);
      next.linkColumns[columnIndex].links.splice(linkIndex, 1);
      return next;
    });
  };

  const save = async () => {
    try {
      setIsSaving(true);
      const normalized = normalizeFooterSettings(footer);

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "footer", data: normalized }),
      });
      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || payload.success !== true) {
        throw new Error("Failed to save footer settings");
      }

      const saved = normalizeFooterSettings(payload.data?.footer);
      footerRef.current = saved;
      setFooter(saved);
      setInitialFooter(saved);
      setUndoStack([]);
      setRedoStack([]);
      toast.success("Footer settings saved");
    } catch {
      toast.error("Failed to save footer settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title="Footer"
        status={
          <Badge variant={isDirty ? "secondary" : "default"}>
            {isDirty ? "Unsaved" : "Live"}
          </Badge>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={undo}
              disabled={!canUndo || isSaving}
              size="sm"
              aria-label="Undo footer change"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={redo}
              disabled={!canRedo || isSaving}
              size="sm"
              aria-label="Redo footer change"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
              Redo
            </Button>
            <Button onClick={save} disabled={isSaving || !isDirty} size="sm">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/admin/online-store/menus`}>Back</Link>
            </Button>
          </>
        }
      />

      <FooterPreview footer={footer} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Brand and Layout</CardTitle>
              <CardDescription>
                Control the footer logo, about description, width, and colors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ImageUploadField
                id="footer-logo"
                label="Footer logo"
                value={footer.brand.logoUrl}
                onChange={(value) => updateField("brand.logoUrl", value)}
                previewAlt={footer.brand.logoAlt || "Footer logo"}
                previewClassName="h-full w-full object-contain"
              />
              <FieldRow label="Logo alt text">
                <Input
                  value={footer.brand.logoAlt}
                  placeholder="Storify"
                  onChange={(event) =>
                    updateField("brand.logoAlt", event.target.value)
                  }
                />
              </FieldRow>
              <FieldRow label="About description">
                <Textarea
                  value={footer.brand.description}
                  rows={4}
                  onChange={(event) =>
                    updateField("brand.description", event.target.value)
                  }
                />
              </FieldRow>
              <SwitchRow
                label="Full width footer"
                checked={footer.layout.fullWidth}
                onChange={(value) => updateField("layout.fullWidth", value)}
              />
              <Separator />
              <ColorSchemeFields
                title="Light mode colors"
                scheme={footer.colors.light}
                pathPrefix="colors.light"
                onChange={updateField}
              />
              <ColorSchemeFields
                title="Dark mode colors"
                scheme={footer.colors.dark}
                pathPrefix="colors.dark"
                onChange={updateField}
              />
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Quick Page Links</CardTitle>
              <CardDescription>
                Manage footer columns for products, help, company, and legal pages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {footer.linkColumns.map((column, columnIndex) => (
                <div key={`${column.id}-${columnIndex}`} className="rounded-md border p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Input
                      value={column.title}
                      onChange={(event) =>
                        updateColumn(columnIndex, "title", event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeColumn(columnIndex)}
                      disabled={footer.linkColumns.length <= 1}
                      aria-label="Remove column"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {column.links.map((link, linkIndex) => (
                      <div
                        key={`${column.id}-link-${linkIndex}`}
                        className="grid gap-2 rounded-md bg-muted/40 p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_84px_36px]"
                      >
                        <Input
                          value={link.label}
                          placeholder="Label"
                          onChange={(event) =>
                            updateColumnLink(
                              columnIndex,
                              linkIndex,
                              "label",
                              event.target.value,
                            )
                          }
                        />
                        <Input
                          value={link.href}
                          placeholder="/page"
                          onChange={(event) =>
                            updateColumnLink(
                              columnIndex,
                              linkIndex,
                              "href",
                              event.target.value,
                            )
                          }
                        />
                        <NativeSelect
                          value={link.target}
                          onChange={(event) =>
                            updateColumnLink(
                              columnIndex,
                              linkIndex,
                              "target",
                              event.target.value,
                            )
                          }
                        >
                          <option value="_self">Same tab</option>
                          <option value="_blank">New tab</option>
                        </NativeSelect>
                        <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-background px-3">
                          <Label className="m-0 text-xs text-muted-foreground">
                            Show
                          </Label>
                          <Switch
                            checked={link.visible}
                            onCheckedChange={(value) =>
                              updateColumnLinkVisibility(
                                columnIndex,
                                linkIndex,
                                value,
                              )
                            }
                            aria-label={`Show ${link.label || "quick page"} link`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeLink(columnIndex, linkIndex)}
                          disabled={column.links.length <= 1}
                          aria-label="Remove link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => addLink(columnIndex)}
                    disabled={column.links.length >= 8}
                  >
                    <Plus className="h-4 w-4" />
                    Add Link
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addColumn}
                disabled={footer.linkColumns.length >= 6}
              >
                <Plus className="h-4 w-4" />
                Add Column
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Footer Widgets</CardTitle>
              <CardDescription>
                Toggle each visible footer widget independently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SwitchRow
                label="Show footer logo"
                checked={footer.widgets.showLogo}
                onChange={(value) => updateField("widgets.showLogo", value)}
              />
              <SwitchRow
                label="Show about description"
                checked={footer.widgets.showDescription}
                onChange={(value) => updateField("widgets.showDescription", value)}
              />
              <SwitchRow
                label="Show contact info"
                checked={footer.widgets.showContact}
                onChange={(value) => updateField("widgets.showContact", value)}
              />
              <SwitchRow
                label="Show social links"
                checked={footer.widgets.showSocialLinks}
                onChange={(value) => updateField("widgets.showSocialLinks", value)}
              />
              <SwitchRow
                label="Show quick page links"
                checked={footer.widgets.showLinkColumns}
                onChange={(value) => updateField("widgets.showLinkColumns", value)}
              />
              <SwitchRow
                label="Show copyright"
                checked={footer.widgets.showCopyright}
                onChange={(value) => updateField("widgets.showCopyright", value)}
              />
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldRow label="Widget title">
                <Input
                  value={footer.contact.title}
                  onChange={(event) => updateField("contact.title", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="Phone">
                <Input
                  value={footer.contact.phone}
                  onChange={(event) => updateField("contact.phone", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="Email">
                <Input
                  value={footer.contact.email}
                  onChange={(event) => updateField("contact.email", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="Address">
                <Textarea
                  value={footer.contact.address}
                  rows={3}
                  onChange={(event) =>
                    updateField("contact.address", event.target.value)
                  }
                />
              </FieldRow>
              <div className="grid gap-3">
                <SwitchRow
                  label="Show phone"
                  checked={footer.contact.showPhone}
                  onChange={(value) => updateField("contact.showPhone", value)}
                />
                <SwitchRow
                  label="Show email"
                  checked={footer.contact.showEmail}
                  onChange={(value) => updateField("contact.showEmail", value)}
                />
                <SwitchRow
                  label="Show address"
                  checked={footer.contact.showAddress}
                  onChange={(value) => updateField("contact.showAddress", value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldRow label="Widget title">
                <Input
                  value={footer.social.title}
                  onChange={(event) => updateField("social.title", event.target.value)}
                />
              </FieldRow>
              {socialFields.map((field) => (
                <FieldRow key={field.key} label={field.label}>
                  <Input
                    value={footer.social.links[field.key]}
                    placeholder="https://"
                    onChange={(event) =>
                      updateField(`social.links.${field.key}`, event.target.value)
                    }
                  />
                </FieldRow>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Copyright</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldRow label="Copyright text">
                <Input
                  value={footer.copyright.text}
                  onChange={(event) =>
                    updateField("copyright.text", event.target.value)
                  }
                />
              </FieldRow>
              <SwitchRow
                label="Show year"
                checked={footer.copyright.showYear}
                onChange={(value) => updateField("copyright.showYear", value)}
              />
              <SwitchRow
                label="Show store name"
                checked={footer.copyright.showStoreName}
                onChange={(value) => updateField("copyright.showStoreName", value)}
              />
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Upload the payment methods image shown in the storefront footer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SwitchRow
                label="Show payment methods"
                checked={footer.paymentMethods.enabled}
                onChange={(value) => updateField("paymentMethods.enabled", value)}
              />
              <ImageUploadField
                id="footer-payment-methods"
                label="Payment Methods"
                value={footer.paymentMethods.imageUrl}
                onChange={(value) => updateField("paymentMethods.imageUrl", value)}
                previewAlt={footer.paymentMethods.imageAlt || "Payment methods"}
                previewClassName="h-full w-full object-contain"
              />
              <FieldRow label="Image alt text">
                <Input
                  value={footer.paymentMethods.imageAlt}
                  onChange={(event) =>
                    updateField("paymentMethods.imageAlt", event.target.value)
                  }
                />
              </FieldRow>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FooterPreview({ footer }: { footer: FooterSettings }) {
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const colors = footer.colors[previewMode];
  const socialCount = Object.values(footer.social.links).filter((value) =>
    value.trim(),
  ).length;
  const showPaymentMethods =
    footer.widgets.showPaymentMethods &&
    footer.paymentMethods.enabled &&
    footer.paymentMethods.imageUrl.trim();

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <div className="border-b bg-muted/35 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Live Preview</p>
            <p className="text-xs text-muted-foreground">
              Changes below update this preview immediately.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-background p-1">
              <button
                type="button"
                onClick={() => setPreviewMode("light")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-sm transition-colors",
                  previewMode === "light"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Preview light mode"
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("dark")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-sm transition-colors",
                  previewMode === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Preview dark mode"
              >
                <Moon className="h-4 w-4" />
              </button>
            </div>
            <Badge variant="outline">
              {footer.layout.fullWidth ? "Full width" : "Contained"}
            </Badge>
          </div>
        </div>
      </div>
      <div className="bg-muted/20 p-4">
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-md border shadow-sm",
            footer.layout.fullWidth ? "w-full" : "max-w-6xl",
          )}
          style={
            {
              "--preview-footer-bg": colors.backgroundColor,
              "--preview-footer-text": colors.textColor,
              "--preview-footer-muted": colors.mutedTextColor,
              "--preview-footer-border": colors.borderColor,
              "--preview-footer-accent": colors.accentColor,
              backgroundColor: "var(--preview-footer-bg)",
              color: "var(--preview-footer-text)",
              borderColor: "var(--preview-footer-border)",
            } as CSSProperties
          }
        >
          <div className="grid grid-cols-2 gap-6 p-5 md:grid-cols-4 lg:grid-cols-6">
            <div className="col-span-2">
              {footer.widgets.showLogo ? (
                <div className="mb-4 flex items-center gap-2">
                  {footer.brand.logoUrl ? (
                    <AppImage
                      src={footer.brand.logoUrl}
                      alt={footer.brand.logoAlt || "Footer logo"}
                      width={144}
                      height={32}
                      className="h-8 w-36 object-contain object-left"
                    />
                  ) : (
                    <>
                      <Store
                        className="h-6 w-6"
                        style={{ color: "var(--preview-footer-accent)" }}
                      />
                      <span className="text-xl font-bold">Storify</span>
                    </>
                  )}
                </div>
              ) : null}
              {footer.widgets.showDescription ? (
                <p
                  className="mb-4 max-w-xs text-sm"
                  style={{ color: "var(--preview-footer-muted)" }}
                >
                  {footer.brand.description ||
                    "Build a better storefront experience for every customer."}
                </p>
              ) : null}
              {footer.widgets.showContact ? (
                <div
                  className="space-y-2 text-sm"
                  style={{ color: "var(--preview-footer-muted)" }}
                >
                  <p
                    className="font-semibold"
                    style={{ color: "var(--preview-footer-text)" }}
                  >
                    {footer.contact.title}
                  </p>
                  {footer.contact.showPhone ? (
                    <PreviewContact icon={<Phone className="h-4 w-4" />}>
                      {footer.contact.phone || "+1 555 0100"}
                    </PreviewContact>
                  ) : null}
                  {footer.contact.showEmail ? (
                    <PreviewContact icon={<Mail className="h-4 w-4" />}>
                      {footer.contact.email || "hello@example.com"}
                    </PreviewContact>
                  ) : null}
                  {footer.contact.showAddress ? (
                    <PreviewContact icon={<MapPin className="h-4 w-4" />}>
                      {footer.contact.address || "Store address"}
                    </PreviewContact>
                  ) : null}
                </div>
              ) : null}
            </div>

            {footer.widgets.showLinkColumns
              ? footer.linkColumns
                  .map((column) => ({
                    ...column,
                    links: column.links.filter((link) => link.visible),
                  }))
                  .filter((column) => column.links.length > 0)
                  .slice(0, 4)
                  .map((column, index) => (
                    <div key={`${column.id}-${index}`}>
                      <p className="mb-3 font-semibold">{column.title}</p>
                      <div
                        className="space-y-2 text-sm"
                        style={{ color: "var(--preview-footer-muted)" }}
                      >
                        {column.links.slice(0, 5).map((link, linkIndex) => (
                          <p key={`${link.href}-${linkIndex}`}>{link.label}</p>
                        ))}
                      </div>
                    </div>
                  ))
              : null}
          </div>
          <div
            className="border-t px-5 py-4"
            style={{ borderColor: "var(--preview-footer-border)" }}
          >
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              {footer.widgets.showCopyright ? (
                <p className="text-sm" style={{ color: "var(--preview-footer-muted)" }}>
                  {"\u00a9"} {footer.copyright.showYear ? new Date().getFullYear() : ""}
                  {footer.copyright.showStoreName ? " Storify. " : " "}
                  {footer.copyright.text}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-4">
                {showPaymentMethods ? (
                  <AppImage
                    src={footer.paymentMethods.imageUrl}
                    alt={footer.paymentMethods.imageAlt || "Payment methods"}
                    width={220}
                    height={34}
                    className="h-8 max-w-[220px] object-contain"
                  />
                ) : null}
                {footer.widgets.showSocialLinks && socialCount > 0 ? (
                  <div
                    className="flex items-center gap-3"
                    style={{ color: "var(--preview-footer-muted)" }}
                  >
                    <Facebook className="h-4 w-4" />
                    <Twitter className="h-4 w-4" />
                    <Instagram className="h-4 w-4" />
                    <Youtube className="h-4 w-4" />
                    <Linkedin className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PreviewContact({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="line-clamp-2">{children}</span>
    </div>
  );
}

function ColorSchemeFields({
  title,
  scheme,
  pathPrefix,
  onChange,
}: {
  title: string;
  scheme: FooterColorScheme;
  pathPrefix: string;
  onChange: (path: string, value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-semibold">{title}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <ColorField
          label="Footer background color"
          value={scheme.backgroundColor}
          onChange={(value) => onChange(`${pathPrefix}.backgroundColor`, value)}
        />
        <ColorField
          label="Footer text color"
          value={scheme.textColor}
          onChange={(value) => onChange(`${pathPrefix}.textColor`, value)}
        />
        <ColorField
          label="Muted text color"
          value={scheme.mutedTextColor}
          onChange={(value) => onChange(`${pathPrefix}.mutedTextColor`, value)}
        />
        <ColorField
          label="Border color"
          value={scheme.borderColor}
          onChange={(value) => onChange(`${pathPrefix}.borderColor`, value)}
        />
        <ColorField
          label="Accent color"
          value={scheme.accentColor}
          onChange={(value) => onChange(`${pathPrefix}.accentColor`, value)}
        />
      </div>
    </div>
  );
}

