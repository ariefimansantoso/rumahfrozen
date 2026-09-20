"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaUploader } from "@/components/ui/media-uploader";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { USER_ACCOUNT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import {
  DEFAULT_VENDOR_PERMISSIONS,
  VENDOR_PERMISSIONS,
  type VendorPermission,
} from "@/config/permissions.config";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/order-settings";

interface VendorFormProps {
  locale: string;
  vendorId?: string;
}

interface VendorFormValues {
  storeName: string;
  slug: string;
  description: string;
  logo: string;
  banner: string;
  commission: number;
  status: string;
  userStatus: "active" | "inactive" | "banned";
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  permissions: VendorPermission[];
}

const defaultValues: VendorFormValues = {
  storeName: "",
  slug: "",
  description: "",
  logo: "",
  banner: "",
  commission: DEFAULT_VENDOR_COMMISSION_RATE,
  status: VENDOR_STATUS.PENDING,
  userStatus: USER_ACCOUNT_STATUS.ACTIVE,
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  permissions: DEFAULT_VENDOR_PERMISSIONS,
};

const VENDOR_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const VENDOR_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

type VendorPermissionResource = {
  key: string;
  label: string;
  view?: VendorPermission;
  legacyManage?: VendorPermission;
  create?: VendorPermission;
  edit?: VendorPermission;
  delete?: VendorPermission;
};

const VENDOR_PERMISSION_RESOURCES: VendorPermissionResource[] = [
  {
    key: "pos",
    label: "Point of Sale",
    view: VENDOR_PERMISSIONS.ACCESS_POS,
    create: VENDOR_PERMISSIONS.CREATE_POS,
    edit: VENDOR_PERMISSIONS.EDIT_POS,
    delete: VENDOR_PERMISSIONS.DELETE_POS,
  },
  {
    key: "orders",
    label: "Orders",
    view: VENDOR_PERMISSIONS.VIEW_ORDERS,
    legacyManage: VENDOR_PERMISSIONS.MANAGE_ORDERS,
    create: VENDOR_PERMISSIONS.CREATE_ORDERS,
    edit: VENDOR_PERMISSIONS.EDIT_ORDERS,
    delete: VENDOR_PERMISSIONS.DELETE_ORDERS,
  },
  {
    key: "products",
    label: "Products",
    view: VENDOR_PERMISSIONS.VIEW_PRODUCTS,
    legacyManage: VENDOR_PERMISSIONS.MANAGE_PRODUCTS,
    create: VENDOR_PERMISSIONS.CREATE_PRODUCTS,
    edit: VENDOR_PERMISSIONS.EDIT_PRODUCTS,
    delete: VENDOR_PERMISSIONS.DELETE_PRODUCTS,
  },
  {
    key: "store-settings",
    label: "Store Settings",
    view: VENDOR_PERMISSIONS.VIEW_STORE_SETTINGS,
    legacyManage: VENDOR_PERMISSIONS.MANAGE_STORE_SETTINGS,
    create: VENDOR_PERMISSIONS.CREATE_STORE_SETTINGS,
    edit: VENDOR_PERMISSIONS.EDIT_STORE_SETTINGS,
    delete: VENDOR_PERMISSIONS.DELETE_STORE_SETTINGS,
  },
  {
    key: "payouts",
    label: "Payouts",
    view: VENDOR_PERMISSIONS.VIEW_PAYOUTS,
    legacyManage: VENDOR_PERMISSIONS.MANAGE_PAYOUTS,
    create: VENDOR_PERMISSIONS.CREATE_PAYOUTS,
    edit: VENDOR_PERMISSIONS.EDIT_PAYOUTS,
    delete: VENDOR_PERMISSIONS.DELETE_PAYOUTS,
  },
  {
    key: "analytics",
    label: "Analytics",
    view: VENDOR_PERMISSIONS.VIEW_ANALYTICS,
    create: VENDOR_PERMISSIONS.CREATE_ANALYTICS,
    edit: VENDOR_PERMISSIONS.EDIT_ANALYTICS,
    delete: VENDOR_PERMISSIONS.DELETE_ANALYTICS,
  },
  {
    key: "brands",
    label: "Brands",
    view: VENDOR_PERMISSIONS.VIEW_BRANDS,
    create: VENDOR_PERMISSIONS.CREATE_BRANDS,
    edit: VENDOR_PERMISSIONS.EDIT_BRANDS,
  },
  {
    key: "discounts",
    label: "Discounts",
    view: VENDOR_PERMISSIONS.VIEW_DISCOUNTS,
    legacyManage: VENDOR_PERMISSIONS.MANAGE_DISCOUNTS,
    create: VENDOR_PERMISSIONS.CREATE_DISCOUNTS,
    edit: VENDOR_PERMISSIONS.EDIT_DISCOUNTS,
    delete: VENDOR_PERMISSIONS.DELETE_DISCOUNTS,
  },
];

function normalizeVendorPermissions(
  input: VendorPermission[],
): VendorPermission[] {
  const next = new Set<VendorPermission>(input);

  for (const resource of VENDOR_PERMISSION_RESOURCES) {
    if (resource.legacyManage && next.has(resource.legacyManage)) {
      if (resource.create) next.add(resource.create);
      if (resource.edit) next.add(resource.edit);
      if (resource.delete) next.add(resource.delete);
    }
  }

  return Array.from(next);
}

function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function VendorForm({ locale, vendorId }: VendorFormProps) {
  const router = useRouter();
  const { confirm } = useConfirmation();

  const [isFetching, setIsFetching] = useState(Boolean(vendorId));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<VendorFormValues>(defaultValues);

  const isEdit = Boolean(vendorId);
  const pageTitle = useMemo(
    () => (isEdit ? "Vendor Details" : "Add Vendor"),
    [isEdit],
  );

  const fetchVendor = useCallback(async () => {
    if (!vendorId) return;
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch vendor");
      }
      const vendor = data.data;
      setForm({
        storeName: vendor.storeName || "",
        slug: vendor.slug || "",
        description: vendor.description || "",
        logo: vendor.logo || "",
        banner: vendor.banner || "",
        commission:
          typeof vendor.commission === "number"
            ? vendor.commission
            : DEFAULT_VENDOR_COMMISSION_RATE,
        status: vendor.status || VENDOR_STATUS.PENDING,
        userStatus: vendor.user?.status || USER_ACCOUNT_STATUS.ACTIVE,
        ownerName: vendor.user?.name || "",
        ownerEmail: vendor.user?.email || "",
        ownerPhone: vendor.user?.phone || "",
        permissions: Array.isArray(vendor.permissions)
          ? normalizeVendorPermissions(vendor.permissions)
          : [],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch vendor",
      );
    } finally {
      setIsFetching(false);
    }
  }, [vendorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVendor();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchVendor]);

  useEffect(() => {
    if (vendorId) return;
    let active = true;
    void fetch("/api/admin/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const rate = payload?.data?.orders?.commission?.vendorRate;
        if (active && typeof rate === "number" && Number.isFinite(rate)) {
          setForm((current) => ({ ...current, commission: rate }));
        }
      })
      .catch(() => {
        // The API applies the configured default if settings cannot be loaded.
      });
    return () => {
      active = false;
    };
  }, [vendorId]);

  const setField = <K extends keyof VendorFormValues>(
    key: K,
    value: VendorFormValues[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const hasPermission = useCallback(
    (permission?: VendorPermission) =>
      permission ? form.permissions.includes(permission) : false,
    [form.permissions],
  );

  const hasActionPermission = useCallback(
    (
      resource: VendorPermissionResource,
      action: "create" | "edit" | "delete",
    ) => {
      const actionPermission = resource[action];
      if (actionPermission && form.permissions.includes(actionPermission))
        return true;
      return resource.legacyManage
        ? form.permissions.includes(resource.legacyManage)
        : false;
    },
    [form.permissions],
  );

  const setResourceView = useCallback(
    (resource: VendorPermissionResource, checked: boolean) => {
      setForm((prev) => {
        let next = [...prev.permissions];
        if (resource.view) {
          if (checked && !next.includes(resource.view)) {
            next.push(resource.view);
          }
          if (!checked) {
            next = next.filter((p) => p !== resource.view);
          }
        }
        if (!checked) {
          if (resource.legacyManage) {
            next = next.filter((p) => p !== resource.legacyManage);
          }
          if (resource.create) next = next.filter((p) => p !== resource.create);
          if (resource.edit) next = next.filter((p) => p !== resource.edit);
          if (resource.delete) next = next.filter((p) => p !== resource.delete);
        }
        return { ...prev, permissions: next };
      });
    },
    [],
  );

  const setResourceAction = useCallback(
    (
      resource: VendorPermissionResource,
      action: "create" | "edit" | "delete",
      checked: boolean,
    ) => {
      const actionPermission = resource[action];
      if (!actionPermission) return;
      setForm((prev) => {
        let next = [...prev.permissions];
        if (resource.legacyManage) {
          next = next.filter((p) => p !== resource.legacyManage);
        }
        if (checked) {
          if (!next.includes(actionPermission)) next.push(actionPermission);
          if (resource.view && !next.includes(resource.view)) {
            next.push(resource.view);
          }
        } else {
          next = next.filter((p) => p !== actionPermission);
        }
        return { ...prev, permissions: next };
      });
    },
    [],
  );

  const handleSubmit = async () => {
    if (!form.storeName.trim()) return toast.error("Store name is required");
    if (!form.ownerName.trim()) return toast.error("Owner name is required");
    if (!form.ownerEmail.trim()) return toast.error("Owner email is required");
    if (form.permissions.length === 0) {
      return toast.error("Select at least one permission");
    }

    setIsSaving(true);
    try {
      const payload = {
        storeName: form.storeName.trim(),
        slug: toSlug(form.slug || form.storeName),
        description: form.description.trim() || undefined,
        logo: form.logo.trim() || undefined,
        banner: form.banner.trim() || undefined,
        commission: Math.max(0, Math.min(100, Number(form.commission) || 0)),
        status: form.status,
        userStatus: form.userStatus,
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim().toLowerCase(),
        ownerPhone: form.ownerPhone.trim() || undefined,
        permissions: form.permissions,
      };

      const res = await fetch(
        isEdit ? `/api/admin/vendors/${vendorId}` : "/api/admin/vendors",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save vendor");
      }
      toast.success(
        isEdit ? "Vendor updated successfully" : "Vendor created successfully",
      );
      if (isEdit) {
        router.refresh();
      } else {
        router.push(`/${locale}/admin/vendors`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save vendor",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!vendorId) return;
    const ok = await confirm({
      title: "Delete vendor",
      description:
        "This removes the vendor profile and reverts the owner role to customer.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete vendor");
      }
      toast.success("Vendor deleted successfully");
      router.push(`/${locale}/admin/vendors`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete vendor",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 -mx-2 md:mx-0">
      <AdminFormStickyHeader
        flushWithAdminShell
        title={pageTitle}
        description={
          isEdit ? "View and update vendor profile" : "Create a new vendor"
        }
        actions={
          <>
            <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isEdit ? "Save changes" : "Create vendor"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${locale}/admin/vendors`)}
            >
              Back to vendors
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Store Profile</CardTitle>
              <CardDescription>Public storefront details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store name *</Label>
                <Input
                  id="storeName"
                  value={form.storeName}
                  onChange={(e) => setField("storeName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Store slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value)}
                  placeholder="auto-from-store-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Store logo</Label>
                  <MediaUploader
                    value={
                      form.logo
                        ? [
                            {
                              _id: "logo",
                              url: form.logo,
                              type: "image",
                              mimeType: "image/*",
                              alt: `${form.storeName || "Store"} logo`,
                              position: 0,
                            },
                          ]
                        : []
                    }
                    onChange={(items) => {
                      const logo = items.find((item) => item.type === "image");
                      setField("logo", logo?.url || "");
                    }}
                    maxFiles={1}
                    acceptTypes={["image"]}
                    accept={VENDOR_IMAGE_ACCEPT}
                    allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                    uploadTitle="Drag and drop image, or click to browse"
                    uploadDescription="Image format: JPG, PNG, JPEG, WEBP."
                    sizeGuide="Recommended size: 512 x 512 px"
                    mediaGridClassName="grid-cols-1 md:grid-cols-1 max-w-32"
                    previewAspectRatio="1 / 1"
                    previewFit="contain"
                    previewTileClassName="bg-slate-50"
                    showCoverBadge={false}
                    coverHint={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Store banner</Label>
                  <MediaUploader
                    value={
                      form.banner
                        ? [
                            {
                              _id: "banner",
                              url: form.banner,
                              type: "image",
                              mimeType: "image/*",
                              alt: `${form.storeName || "Store"} banner`,
                              position: 0,
                            },
                          ]
                        : []
                    }
                    onChange={(items) => {
                      const banner = items.find(
                        (item) => item.type === "image",
                      );
                      setField("banner", banner?.url || "");
                    }}
                    maxFiles={1}
                    acceptTypes={["image"]}
                    accept={VENDOR_IMAGE_ACCEPT}
                    allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                    uploadTitle="Drag and drop image, or click to browse"
                    uploadDescription="Image format: JPG, PNG, JPEG, WEBP."
                    sizeGuide="Recommended size: 1360 x 314 px"
                    mediaGridClassName="grid-cols-1 md:grid-cols-1"
                    previewAspectRatio="1360 / 314"
                    previewFit="contain"
                    previewTileClassName="bg-slate-50"
                    showCoverBadge={false}
                    coverHint={false}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Permissions</CardTitle>
                  <CardDescription>
                    Configure dedicated view/create/edit/delete access per
                    resource
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setField("permissions", DEFAULT_VENDOR_PERMISSIONS)
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setField("permissions", [])}
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-background">
                      <tr className="border-b">
                        <th className="text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase px-4 py-3">
                          Resource
                        </th>
                        <th className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2 py-3">
                          View
                        </th>
                        <th className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2 py-3">
                          Create
                        </th>
                        <th className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2 py-3">
                          Edit
                        </th>
                        <th className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2 py-3">
                          Delete
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {VENDOR_PERMISSION_RESOURCES.map((resource, idx) => (
                        <tr
                          key={resource.key}
                          className={
                            idx % 2 === 0
                              ? "bg-background border-b"
                              : "bg-muted/20 border-b"
                          }
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-sm">
                              {resource.label}
                            </p>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <Checkbox
                              checked={hasPermission(resource.view)}
                              onCheckedChange={(checked) =>
                                setResourceView(resource, Boolean(checked))
                              }
                              className="mx-auto"
                            />
                          </td>
                          <td className="px-2 py-3 text-center">
                            <Checkbox
                              checked={hasActionPermission(resource, "create")}
                              onCheckedChange={(checked) =>
                                setResourceAction(
                                  resource,
                                  "create",
                                  Boolean(checked),
                                )
                              }
                              disabled={!resource.create}
                              className="mx-auto"
                            />
                          </td>
                          <td className="px-2 py-3 text-center">
                            <Checkbox
                              checked={hasActionPermission(resource, "edit")}
                              onCheckedChange={(checked) =>
                                setResourceAction(
                                  resource,
                                  "edit",
                                  Boolean(checked),
                                )
                              }
                              disabled={!resource.edit}
                              className="mx-auto"
                            />
                          </td>
                          <td className="px-2 py-3 text-center">
                            <Checkbox
                              checked={hasActionPermission(resource, "delete")}
                              onCheckedChange={(checked) =>
                                setResourceAction(
                                  resource,
                                  "delete",
                                  Boolean(checked),
                                )
                              }
                              disabled={!resource.delete}
                              className="mx-auto"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner Account</CardTitle>
              <CardDescription>
                User account linked to this vendor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner name *</Label>
                <Input
                  id="ownerName"
                  value={form.ownerName}
                  onChange={(e) => setField("ownerName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => setField("ownerEmail", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerPhone">Owner phone</Label>
                <Input
                  id="ownerPhone"
                  value={form.ownerPhone}
                  onChange={(e) => setField("ownerPhone", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Approval and account state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Vendor status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VENDOR_STATUS.PENDING}>
                      Pending
                    </SelectItem>
                    <SelectItem value={VENDOR_STATUS.APPROVED}>
                      Approved
                    </SelectItem>
                    <SelectItem value={VENDOR_STATUS.SUSPENDED}>
                      Suspended
                    </SelectItem>
                    <SelectItem value={VENDOR_STATUS.REJECTED}>
                      Rejected
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Owner account status</Label>
                <Select
                  value={form.userStatus}
                  onValueChange={(value) =>
                    setField(
                      "userStatus",
                      value as VendorFormValues["userStatus"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={USER_ACCOUNT_STATUS.ACTIVE}>
                      Active
                    </SelectItem>
                    <SelectItem value={USER_ACCOUNT_STATUS.INACTIVE}>
                      Inactive
                    </SelectItem>
                    <SelectItem value={USER_ACCOUNT_STATUS.BANNED}>
                      Banned
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission">Commission %</Label>
                <Input
                  id="commission"
                  type="number"
                  min={0}
                  max={100}
                  value={form.commission}
                  onChange={(e) =>
                    setField("commission", Number(e.target.value || 0))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {isEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Danger zone</CardTitle>
                <CardDescription>Delete this vendor profile</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete vendor
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
