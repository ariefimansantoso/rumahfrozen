"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { USER_ACCOUNT_STATUS } from "@/config/app.config";

interface CustomerFormProps {
  locale: string;
  customerId?: string;
  readOnly?: boolean;
  area?: "admin" | "staff";
}

interface CustomerDetailsResponse {
  _id: string;
  loyaltyPoints?: number;
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
  tags?: string[];
  notes?: string;
  acquisitionSource?: string;
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    street?: string;
    apartment?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  userId:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
        phone?: string;
        image?: string;
        status?: "active" | "inactive" | "banned";
      };
}

interface CustomerFormValues {
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "banned";
  loyaltyPoints: number;
  loyaltyTier: "bronze" | "silver" | "gold" | "platinum";
  acquisitionSource: string;
  tagsInput: string;
  notes: string;
  shippingFirstName: string;
  shippingLastName: string;
  shippingStreet: string;
  shippingApartment: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone: string;
}

const defaultValues: CustomerFormValues = {
  name: "",
  email: "",
  phone: "",
  status: USER_ACCOUNT_STATUS.ACTIVE,
  loyaltyPoints: 0,
  loyaltyTier: "bronze",
  acquisitionSource: "",
  tagsInput: "",
  notes: "",
  shippingFirstName: "",
  shippingLastName: "",
  shippingStreet: "",
  shippingApartment: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "",
  shippingPhone: "",
};

function parseTags(input: string): string[] {
  if (!input.trim()) return [];
  return Array.from(
    new Set(
      input
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function getUser(profile: CustomerDetailsResponse) {
  if (profile.userId && typeof profile.userId === "object") {
    return profile.userId;
  }

  return null;
}

function buildShippingAddressPayload(form: CustomerFormValues) {
  const address = {
    firstName: form.shippingFirstName.trim(),
    lastName: form.shippingLastName.trim(),
    street: form.shippingStreet.trim(),
    apartment: form.shippingApartment.trim(),
    city: form.shippingCity.trim(),
    state: form.shippingState.trim(),
    postalCode: form.shippingPostalCode.trim(),
    country: form.shippingCountry.trim(),
    phone: form.shippingPhone.trim(),
  };

  const hasAnyAddressValue = Object.values(address).some(Boolean);
  if (!hasAnyAddressValue) return { value: undefined as undefined, error: null as string | null };

  if (!address.street || !address.city || !address.postalCode || !address.country) {
    return {
      value: undefined,
      error: "Shipping address requires street, city, postal code, and country",
    };
  }

  return {
    value: {
      ...address,
      firstName: address.firstName || undefined,
      lastName: address.lastName || undefined,
      apartment: address.apartment || undefined,
      state: address.state || undefined,
      phone: address.phone || undefined,
      isDefault: true as const,
      label: "home" as const,
    },
    error: null,
  };
}

export function CustomerForm({
  locale,
  customerId,
  readOnly,
  area = "admin",
}: CustomerFormProps) {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const basePath = `/${locale}/${area}`;

  const [isFetching, setIsFetching] = useState(!!customerId);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<CustomerFormValues>(defaultValues);

  const pageTitle = useMemo(
    () => (customerId ? "Customer Details" : "Add Customer"),
    [customerId],
  );

  const pageDescription = useMemo(
    () =>
      customerId
        ? "View and update customer profile, loyalty data, and internal notes"
        : "Create a new customer profile",
    [customerId],
  );

  useEffect(() => {
    if (!customerId) return;
    let active = true;

    const loadCustomer = async () => {
      try {
        const res = await fetch(`/api/admin/customers/${customerId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load customer");
        }

        if (!active) return;
        const profile: CustomerDetailsResponse = data.data?.profile;
        const user = getUser(profile);

        setForm({
          name: user?.name || "",
          email: user?.email || "",
          phone: user?.phone || "",
          status: user?.status || USER_ACCOUNT_STATUS.ACTIVE,
          loyaltyPoints: profile.loyaltyPoints || 0,
          loyaltyTier: profile.loyaltyTier || "bronze",
          acquisitionSource: profile.acquisitionSource || "",
          tagsInput: (profile.tags || []).join(", "),
          notes: profile.notes || "",
          shippingFirstName: profile.shippingAddress?.firstName || "",
          shippingLastName: profile.shippingAddress?.lastName || "",
          shippingStreet: profile.shippingAddress?.street || "",
          shippingApartment: profile.shippingAddress?.apartment || "",
          shippingCity: profile.shippingAddress?.city || "",
          shippingState: profile.shippingAddress?.state || "",
          shippingPostalCode: profile.shippingAddress?.postalCode || "",
          shippingCountry: profile.shippingAddress?.country || "",
          shippingPhone: profile.shippingAddress?.phone || "",
        });
      } catch (error) {
        if (!active) return;
        console.error("Failed to fetch customer:", error);
        toast.error("Failed to load customer");
      } finally {
        if (active) setIsFetching(false);
      }
    };

    void loadCustomer();
    return () => {
      active = false;
    };
  }, [customerId]);

  const setField = <K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (readOnly) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    const shippingAddressPayload = buildShippingAddressPayload(form);
    if (shippingAddressPayload.error) {
      toast.error(shippingAddressPayload.error);
      return;
    }
    if (!customerId && !shippingAddressPayload.value) {
      toast.error("Shipping address is required to create a customer");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        status: form.status,
        loyaltyPoints: Number.isFinite(form.loyaltyPoints)
          ? Math.max(0, Math.floor(form.loyaltyPoints))
          : 0,
        loyaltyTier: form.loyaltyTier,
        acquisitionSource: form.acquisitionSource.trim() || undefined,
        tags: parseTags(form.tagsInput),
        notes: form.notes.trim() || undefined,
        shippingAddress: shippingAddressPayload.value,
      };

      const isEdit = Boolean(customerId);
      const res = await fetch(
        isEdit ? `/api/admin/customers/${customerId}` : "/api/admin/customers",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save customer");
      }

      toast.success(
        isEdit
          ? "Customer updated successfully"
          : "Customer created successfully",
      );

      if (isEdit) {
        router.refresh();
      } else {
        router.push(`${basePath}/customers`);
      }
    } catch (error) {
      console.error("Save customer failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save customer",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customerId) return;
    if (readOnly) return;

    const shouldDelete = await confirm({
      title: "Delete customer",
      description:
        "This permanently removes the customer profile and user account.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!shouldDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete customer");
      }

      toast.success("Customer deleted successfully");
      router.push(`${basePath}/customers`);
      router.refresh();
    } catch (error) {
      console.error("Delete customer failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete customer",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
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
            {!readOnly && (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSaving || isDeleting}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {customerId ? "Save changes" : "Create customer"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(`${basePath}/customers`)}
              disabled={isSaving || isDeleting}
            >
              Back to customers
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Customer account identity and contact fields
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Full name *</Label>
                <Input
                  id="customer-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Jane Doe"
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-email">Email *</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="e.g. jane@example.com"
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="e.g. +1 555 0123"
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label>Account status</Label>
                <Select
                  value={form.status}
                  disabled={readOnly}
                  onValueChange={(value) =>
                    setField("status", value as CustomerFormValues["status"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loyalty & Segmentation</CardTitle>
              <CardDescription>
                Profile settings used by support and marketing teams
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loyalty tier</Label>
                  <Select
                    value={form.loyaltyTier}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      setField(
                        "loyaltyTier",
                        value as CustomerFormValues["loyaltyTier"],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-loyalty-points">
                    Loyalty points
                  </Label>
                  <Input
                    id="customer-loyalty-points"
                    type="number"
                    min={0}
                    value={form.loyaltyPoints}
                    onChange={(e) =>
                      setField(
                        "loyaltyPoints",
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-acquisition-source">
                  Acquisition source
                </Label>
                <Input
                  id="customer-acquisition-source"
                  value={form.acquisitionSource}
                  onChange={(e) =>
                    setField("acquisitionSource", e.target.value)
                  }
                  placeholder="e.g. instagram, organic, referral"
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-tags">Tags</Label>
                <Input
                  id="customer-tags"
                  value={form.tagsInput}
                  onChange={(e) => setField("tagsInput", e.target.value)}
                  placeholder="vip, repeat, b2b"
                  disabled={readOnly}
                />
                <p className="text-xs text-muted-foreground">
                  Separate tags with commas
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
              <CardDescription>
                Default shipping address for quick order creation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-first-name">First name</Label>
                  <Input
                    id="customer-shipping-first-name"
                    value={form.shippingFirstName}
                    onChange={(e) => setField("shippingFirstName", e.target.value)}
                    placeholder="e.g. Jane"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-last-name">Last name</Label>
                  <Input
                    id="customer-shipping-last-name"
                    value={form.shippingLastName}
                    onChange={(e) => setField("shippingLastName", e.target.value)}
                    placeholder="e.g. Doe"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-shipping-street">Street</Label>
                <Input
                  id="customer-shipping-street"
                  value={form.shippingStreet}
                  onChange={(e) => setField("shippingStreet", e.target.value)}
                  placeholder="House, road, area"
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-shipping-apartment">Apartment, suite, etc.</Label>
                <Input
                  id="customer-shipping-apartment"
                  value={form.shippingApartment}
                  onChange={(e) => setField("shippingApartment", e.target.value)}
                  placeholder="Optional"
                  disabled={readOnly}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-city">City</Label>
                  <Input
                    id="customer-shipping-city"
                    value={form.shippingCity}
                    onChange={(e) => setField("shippingCity", e.target.value)}
                    placeholder="City"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-state">State</Label>
                  <Input
                    id="customer-shipping-state"
                    value={form.shippingState}
                    onChange={(e) => setField("shippingState", e.target.value)}
                    placeholder="State"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-postal">Postal code</Label>
                  <Input
                    id="customer-shipping-postal"
                    value={form.shippingPostalCode}
                    onChange={(e) => setField("shippingPostalCode", e.target.value)}
                    placeholder="Postal code"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-country">Country</Label>
                  <Input
                    id="customer-shipping-country"
                    value={form.shippingCountry}
                    onChange={(e) => setField("shippingCountry", e.target.value)}
                    placeholder="Country"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-shipping-phone">Phone</Label>
                <Input
                  id="customer-shipping-phone"
                  value={form.shippingPhone}
                  onChange={(e) => setField("shippingPhone", e.target.value)}
                  placeholder="e.g. +1 555 0123"
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
              <CardDescription>
                Private notes that are only visible to admins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Support context, buying behavior, escalation notes..."
                rows={6}
                disabled={readOnly}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {readOnly && (
            <Card>
              <CardHeader>
                <CardTitle>Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  You have view-only access for this customer.
                </p>
              </CardContent>
            </Card>
          )}

          {customerId && !readOnly && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Delete this customer permanently
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
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
                  Delete customer
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
