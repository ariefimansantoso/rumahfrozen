"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Shield, Mail, Send, Store, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import type { StaffPermission } from "@/config/permissions.config";
import { cn } from "@/lib/utils";

interface StaffFormProps {
  locale: string;
  staffId?: string; // user _id for edit mode
  area?: "admin" | "vendor";
}

interface FormValues {
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "banned";
  permissions: StaffPermission[];
  vendorIds: string[];
  locationIds: string[];
  fulfillmentRegions: string;
  department: string;
  notes: string;
  isActive: boolean;
  sendInvite: boolean;
}

const defaultValues: FormValues = {
  name: "",
  email: "",
  phone: "",
  status: "active",
  permissions: [
    STAFF_PERMISSIONS.ACCESS_POS,
    STAFF_PERMISSIONS.VIEW_ORDERS,
    STAFF_PERMISSIONS.VIEW_PRODUCTS,
    STAFF_PERMISSIONS.VIEW_CUSTOMERS,
  ],
  vendorIds: [],
  locationIds: [],
  fulfillmentRegions: "",
  department: "",
  notes: "",
  isActive: true,
  sendInvite: true,
};

interface ScopeOption {
  _id: string;
  name: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  access_pos: "POS",
  manage_pos: "Manage POS",
  create_pos: "Create POS",
  edit_pos: "Edit POS",
  delete_pos: "Delete POS",
  view_orders: "View Orders",
  manage_orders: "Manage Orders",
  create_orders: "Create Orders",
  edit_orders: "Edit Orders",
  delete_orders: "Delete Orders",
  view_products: "View Products",
  manage_products: "Manage Products",
  create_products: "Create Products",
  edit_products: "Edit Products",
  delete_products: "Delete Products",
  view_customers: "View Customers",
  manage_customers: "Manage Customers",
  create_customers: "Create Customers",
  edit_customers: "Edit Customers",
  delete_customers: "Delete Customers",
  view_inventory: "View Inventory",
  manage_inventory: "Manage Inventory",
  create_inventory: "Create Inventory",
  edit_inventory: "Edit Inventory",
  delete_inventory: "Delete Inventory",
  view_analytics: "Analytics",
};

type PermissionResource = {
  key: string;
  label: string;
  view?: StaffPermission;
  legacyManage?: StaffPermission;
  create?: StaffPermission;
  edit?: StaffPermission;
  delete?: StaffPermission;
};

const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    key: "pos",
    label: "Point of Sale",
    view: STAFF_PERMISSIONS.ACCESS_POS,
    legacyManage: STAFF_PERMISSIONS.MANAGE_POS,
    create: STAFF_PERMISSIONS.CREATE_POS,
    edit: STAFF_PERMISSIONS.EDIT_POS,
    delete: STAFF_PERMISSIONS.DELETE_POS,
  },
  {
    key: "orders",
    label: "Orders",
    view: STAFF_PERMISSIONS.VIEW_ORDERS,
    legacyManage: STAFF_PERMISSIONS.MANAGE_ORDERS,
    create: STAFF_PERMISSIONS.CREATE_ORDERS,
    edit: STAFF_PERMISSIONS.EDIT_ORDERS,
    delete: STAFF_PERMISSIONS.DELETE_ORDERS,
  },
  {
    key: "products",
    label: "Products",
    view: STAFF_PERMISSIONS.VIEW_PRODUCTS,
    legacyManage: STAFF_PERMISSIONS.MANAGE_PRODUCTS,
    create: STAFF_PERMISSIONS.CREATE_PRODUCTS,
    edit: STAFF_PERMISSIONS.EDIT_PRODUCTS,
    delete: STAFF_PERMISSIONS.DELETE_PRODUCTS,
  },
  {
    key: "customers",
    label: "Customers",
    view: STAFF_PERMISSIONS.VIEW_CUSTOMERS,
    legacyManage: STAFF_PERMISSIONS.MANAGE_CUSTOMERS,
    create: STAFF_PERMISSIONS.CREATE_CUSTOMERS,
    edit: STAFF_PERMISSIONS.EDIT_CUSTOMERS,
    delete: STAFF_PERMISSIONS.DELETE_CUSTOMERS,
  },
  {
    key: "inventory",
    label: "Inventory",
    view: STAFF_PERMISSIONS.VIEW_INVENTORY,
    legacyManage: STAFF_PERMISSIONS.MANAGE_INVENTORY,
    create: STAFF_PERMISSIONS.CREATE_INVENTORY,
    edit: STAFF_PERMISSIONS.EDIT_INVENTORY,
    delete: STAFF_PERMISSIONS.DELETE_INVENTORY,
  },
  {
    key: "analytics",
    label: "Analytics",
    view: STAFF_PERMISSIONS.VIEW_ANALYTICS,
  },
];

function normalizeStaffPermissions(
  input: StaffPermission[],
): StaffPermission[] {
  const next = new Set<StaffPermission>(input);

  for (const resource of PERMISSION_RESOURCES) {
    if (resource.legacyManage && next.has(resource.legacyManage)) {
      if (resource.create) next.add(resource.create);
      if (resource.edit) next.add(resource.edit);
      if (resource.delete) next.add(resource.delete);
    }
  }

  return Array.from(next);
}

export function StaffForm({ locale, staffId, area = "admin" }: StaffFormProps) {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const apiBasePath = area === "vendor" ? "/api/vendor/staff" : "/api/admin/staff";
  const staffListPath = `/${locale}/${area}/staff`;

  const [isFetching, setIsFetching] = useState(!!staffId);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [form, setForm] = useState<FormValues>(defaultValues);
  const [vendors, setVendors] = useState<ScopeOption[]>([]);
  const [locations, setLocations] = useState<ScopeOption[]>([]);

  const isEdit = Boolean(staffId);
  const pageTitle = useMemo(
    () => (isEdit ? "Edit Staff Member" : "Add Staff Member"),
    [isEdit],
  );
  const pageDescription = useMemo(
    () =>
      isEdit
        ? "Update staff member details and permissions"
        : "Create a new staff member with specific permissions",
    [isEdit],
  );

  const fetchStaff = useCallback(async () => {
    if (!staffId) return;
      setIsFetching(true);
    try {
      const res = await fetch(`${apiBasePath}/${staffId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load staff member");
      }
      const d = data.data;
      setForm({
        name: d.name || "",
        email: d.email || "",
        phone: d.phone || "",
        status: d.status || "active",
        permissions: normalizeStaffPermissions(
          d.staffProfile?.permissions || [],
        ),
        vendorIds: (d.staffProfile?.vendorIds || []).map(String),
        locationIds: (d.staffProfile?.locationIds || []).map(String),
        fulfillmentRegions: (d.staffProfile?.fulfillmentRegions || []).join(
          "\n",
        ),
        department: d.staffProfile?.department || "",
        notes: d.staffProfile?.notes || "",
        isActive: d.staffProfile?.isActive ?? true,
        sendInvite: false,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load staff member",
      );
    } finally {
      setIsFetching(false);
    }
  }, [apiBasePath, staffId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    if (area !== "admin") return;
    const fetchScopeOptions = async () => {
      const [vendorsRes, locationsRes] = await Promise.allSettled([
        fetch("/api/admin/vendors?limit=100"),
        fetch("/api/admin/locations?includeInactive=false"),
      ]);

      if (vendorsRes.status === "fulfilled" && vendorsRes.value.ok) {
        const data = await vendorsRes.value.json();
        const rows = data.data?.data || data.data || [];
        if (Array.isArray(rows)) {
          setVendors(
            rows.map((vendor: { _id: string; storeName?: string; name?: string }) => ({
              _id: String(vendor._id),
              name: vendor.storeName || vendor.name || "Vendor",
            })),
          );
        }
      }

      if (locationsRes.status === "fulfilled" && locationsRes.value.ok) {
        const data = await locationsRes.value.json();
        const rows = data.data || [];
        if (Array.isArray(rows)) {
          setLocations(
            rows.map((location: { _id: string; name?: string }) => ({
              _id: String(location._id),
              name: location.name || "Location",
            })),
          );
        }
      }
    };

    fetchScopeOptions().catch(() => {
      setVendors([]);
      setLocations([]);
    });
  }, [area]);

  const setField = <K extends keyof FormValues>(
    key: K,
    value: FormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const hasPermission = useCallback(
    (permission?: StaffPermission) =>
      permission ? form.permissions.includes(permission) : false,
    [form.permissions],
  );

  const hasActionPermission = useCallback(
    (resource: PermissionResource, action: "create" | "edit" | "delete") => {
      const actionPermission = resource[action];
      if (actionPermission && form.permissions.includes(actionPermission)) {
        return true;
      }
      return resource.legacyManage
        ? form.permissions.includes(resource.legacyManage)
        : false;
    },
    [form.permissions],
  );

  const setResourceView = useCallback(
    (resource: PermissionResource, checked: boolean) => {
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
          if (resource.create) {
            next = next.filter((p) => p !== resource.create);
          }
          if (resource.edit) {
            next = next.filter((p) => p !== resource.edit);
          }
          if (resource.delete) {
            next = next.filter((p) => p !== resource.delete);
          }
        }
        return { ...prev, permissions: next };
      });
    },
    [],
  );

  const setResourceAction = useCallback(
    (
      resource: PermissionResource,
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
          if (!next.includes(actionPermission)) {
            next.push(actionPermission);
          }
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

  const selectAllPermissions = () => {
    setForm((prev) => ({
      ...prev,
      permissions: Object.values(STAFF_PERMISSIONS),
    }));
  };

  const clearAllPermissions = () => {
    setForm((prev) => ({
      ...prev,
      permissions: [],
    }));
  };

  const toggleStringListValue = (
    key: "vendorIds" | "locationIds",
    value: string,
    checked: boolean,
  ) => {
    setForm((prev) => {
      const next = new Set(prev[key]);
      if (checked) next.add(value);
      else next.delete(value);
      return { ...prev, [key]: Array.from(next) };
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (form.permissions.length === 0) {
      toast.error("Select at least one permission");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        status: form.status,
        permissions: form.permissions,
        ...(area === "admin"
          ? {
              vendorIds: form.vendorIds,
              locationIds: form.locationIds,
              fulfillmentRegions: form.fulfillmentRegions
                .split(/[\n,]+/)
                .map((value) => value.trim())
                .filter(Boolean),
            }
          : {}),
        department: form.department.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      };

      const res = await fetch(
        isEdit ? `${apiBasePath}/${staffId}` : apiBasePath,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save staff member");
      }

      toast.success(
        isEdit
          ? "Staff member updated successfully"
          : "Staff member created successfully",
      );

      // Send invite email on creation if enabled
      if (!isEdit && form.sendInvite && data.data?._id) {
        try {
          const inviteRes = await fetch(
            `${apiBasePath}/${data.data._id}/invite?locale=${encodeURIComponent(locale)}`,
            { method: "POST" },
          );
          const inviteData = await inviteRes.json();
          if (inviteRes.ok && inviteData.success) {
            toast.success("Invite email sent successfully");
          } else {
            toast.error(
              inviteData.message || "Staff created but invite email failed",
            );
          }
        } catch {
          toast.error("Staff created but failed to send invite email");
        }
      }

      if (isEdit) {
        router.refresh();
      } else {
        router.push(staffListPath);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save staff member",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!staffId) return;

    const shouldDelete = await confirm({
      title: "Remove staff member",
      description:
        "This will remove staff access and revert the user to a customer account. This action cannot be undone.",
      confirmText: "Remove",
      variant: "destructive",
    });

    if (!shouldDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${apiBasePath}/${staffId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to remove staff member");
      }
      toast.success("Staff member removed successfully");
      router.push(staffListPath);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove staff member",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!staffId) return;

    setIsSendingInvite(true);
    try {
      const res = await fetch(
        `${apiBasePath}/${staffId}/invite?locale=${encodeURIComponent(locale)}`,
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send invite email");
      }
      toast.success(data.data?.message || "Invite email sent successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invite email",
      );
    } finally {
      setIsSendingInvite(false);
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
        description={pageDescription}
        actions={
          <>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSaving || isDeleting}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create staff member"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(staffListPath)}
              disabled={isSaving || isDeleting}
            >
              Back to staff
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Staff member identity and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="e.g. john@example.com"
                    disabled={isEdit}
                  />
                  {isEdit && (
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed after creation
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="e.g. +1 555 0123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) => setField("department", e.target.value)}
                    placeholder="e.g. Sales, Warehouse"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setField("status", value as FormValues["status"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Permissions
                  </CardTitle>
                  <CardDescription>
                    Control what this staff member can access
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllPermissions}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllPermissions}
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/50 border-b px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Each column is independent. You can allow only create, only
                    edit, only delete, or any combination per resource.
                  </p>
                </div>
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
                      {PERMISSION_RESOURCES.map((resource, idx) => {
                        const canView = hasPermission(resource.view);
                        const canCreate = hasActionPermission(
                          resource,
                          "create",
                        );
                        const canEdit = hasActionPermission(resource, "edit");
                        const canDelete = hasActionPermission(
                          resource,
                          "delete",
                        );
                        return (
                          <tr
                            key={resource.key}
                            className={cn(
                              "border-b last:border-b-0",
                              idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                            )}
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-sm">
                                {resource.label}
                              </p>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <Checkbox
                                checked={canView}
                                onCheckedChange={(checked) =>
                                  setResourceView(resource, Boolean(checked))
                                }
                                className="mx-auto"
                              />
                            </td>
                            <td className="px-2 py-3 text-center">
                              <Checkbox
                                checked={canCreate}
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
                                checked={canEdit}
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
                                checked={canDelete}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scope */}
          {area === "admin" && (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Scope
              </CardTitle>
              <CardDescription>
                Limit staff data access by vendor, location, or fulfillment
                region. Empty scope means full store access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {vendors.length > 0 && (
                <div className="space-y-3">
                  <Label>Vendors</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {vendors.map((vendor) => (
                      <label
                        key={vendor._id}
                        className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                      >
                        <Checkbox
                          checked={form.vendorIds.includes(vendor._id)}
                          onCheckedChange={(checked) =>
                            toggleStringListValue(
                              "vendorIds",
                              vendor._id,
                              Boolean(checked),
                            )
                          }
                        />
                        <span className="truncate">{vendor.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {locations.length > 0 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Locations
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {locations.map((location) => (
                      <label
                        key={location._id}
                        className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                      >
                        <Checkbox
                          checked={form.locationIds.includes(location._id)}
                          onCheckedChange={(checked) =>
                            toggleStringListValue(
                              "locationIds",
                              location._id,
                              Boolean(checked),
                            )
                          }
                        />
                        <span className="truncate">{location.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fulfillmentRegions">
                  Fulfillment regions
                </Label>
                <Textarea
                  id="fulfillmentRegions"
                  value={form.fulfillmentRegions}
                  onChange={(e) =>
                    setField("fulfillmentRegions", e.target.value)
                  }
                  placeholder={"US\nCalifornia\nBangladesh"}
                  rows={3}
                />
              </div>
            </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
              <CardDescription>
                Private notes visible only to admins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Add any notes about this staff member..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {!isEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Create Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={form.sendInvite}
                    onCheckedChange={(checked) =>
                      setField("sendInvite", Boolean(checked))
                    }
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-none flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Send invite email
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Staff will receive a link to set their password
                    </p>
                  </div>
                </label>
              </CardContent>
            </Card>
          )}

          {/* Send Invite (edit mode only) */}
          {isEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Invite
                </CardTitle>
                <CardDescription>
                  Send an email with a link to set their password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendInvite}
                  disabled={isSendingInvite || isSaving || isDeleting}
                >
                  {isSendingInvite ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send invite email
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Staff Access Toggle */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Access</CardTitle>
              <CardDescription>
                Toggle staff access without removing the profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">
                    {form.isActive
                      ? "Staff can access their dashboard"
                      : "Staff access is suspended"}
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setField("isActive", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Permission Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                {form.permissions.length} of{" "}
                {Object.keys(STAFF_PERMISSIONS).length} permissions selected
              </p>
              <div className="flex flex-wrap gap-1">
                {form.permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                  >
                    {PERMISSION_LABELS[p] || p}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          {isEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Remove this staff member permanently
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={isSaving || isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remove from staff
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
