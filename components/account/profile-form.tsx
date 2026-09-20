"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { authClient } from "@/lib/auth-client";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import {
  DEFAULT_PROFILE_DEMO_MODE,
  normalizeDemoModeState,
} from "@/lib/demo-mode-shared";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  gender: z.string().optional(),
});

const passwordSchema = z
  .object({
    oldPassword: z.string().optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function ProfileForm() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [demoMode, setDemoMode] = useState(DEFAULT_PROFILE_DEMO_MODE);
  const isDemoMode = demoMode.enabled;

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      birthday: "",
      gender: "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/user/profile");
        const json = await res.json();
        const user = json?.data?.user;

        if (!res.ok || !json?.success || !user) {
          throw new Error(json?.error || json?.message || "Failed to load");
        }

        const loadedDemoMode = json?.data?.demoMode;
        setDemoMode(normalizeDemoModeState(loadedDemoMode));

        const nameParts = (user.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        profileForm.reset({
          firstName,
          lastName,
          email: user.email || "",
          phone: user.phone || "",
          birthday: user.birthday || "",
          gender: user.gender || "",
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load profile",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [profileForm]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (isDemoMode) {
      toast.error(demoMode.message);
      return;
    }

    setIsSaving(true);
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          phone: data.phone,
          birthday: data.birthday,
          gender: data.gender,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        const errors = json?.errors as Record<string, string[]> | undefined;
        if (errors?.name?.[0]) {
          profileForm.setError("firstName", {
            type: "server",
            message: errors.name[0],
          });
        }
        if (errors?.phone?.[0]) {
          profileForm.setError("phone", {
            type: "server",
            message: errors.phone[0],
          });
        }
        if (errors?.birthday?.[0]) {
          profileForm.setError("birthday", {
            type: "server",
            message: errors.birthday[0],
          });
        }
        if (errors?.gender?.[0]) {
          profileForm.setError("gender", {
            type: "server",
            message: errors.gender[0],
          });
        }
        throw new Error(json?.error || json?.message || t("common.error"));
      }

      await authClient.updateUser({ name: fullName }).catch(() => null);

      toast.success(json?.message || t("common.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (isDemoMode) {
      toast.error(demoMode.message);
      return;
    }

    setIsChangingPassword(true);
    try {
      const currentPassword = data.oldPassword?.trim();
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword:
            currentPassword && currentPassword.length > 0
              ? currentPassword
              : undefined,
          newPassword: data.newPassword,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const errors = json?.errors as Record<string, string[]> | undefined;
        if (errors?.currentPassword?.[0]) {
          passwordForm.setError("oldPassword", {
            type: "server",
            message: errors.currentPassword[0],
          });
        }
        if (errors?.newPassword?.[0]) {
          passwordForm.setError("newPassword", {
            type: "server",
            message: errors.newPassword[0],
          });
        }
        throw new Error(
          json?.error || json?.message || "Failed to change password",
        );
      }

      toast.success(json?.message || "Password changed successfully");
      passwordForm.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminFormStickyHeader
        title={t("profile.title")}
        description={t("profile.subtitle")}
        actions={
          <>
            <Button
              type="submit"
              form="customer-profile-form"
              size="sm"
              disabled={isDemoMode || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("profile.saveChanges")}
            </Button>
            <Button
              type="submit"
              form="customer-password-form"
              variant="outline"
              size="sm"
              disabled={isDemoMode || isChangingPassword}
            >
              {isChangingPassword && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("profile.updatePassword")}
            </Button>
          </>
        }
      />

      {isDemoMode && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5">Demo mode</p>
            <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
              {demoMode.message}
            </p>
          </div>
        </div>
      )}

      {/* Personal Information */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>
            {t("profile.personal")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form
              id="customer-profile-form"
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
              className="space-y-6"
            >
              <fieldset disabled={isDemoMode} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.firstName")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="h-11 bg-background/50 focus:bg-background transition-colors"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.lastName")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="h-11 bg-background/50 focus:bg-background transition-colors"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.email")}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} disabled className="h-11 bg-muted" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.phone")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          className="h-11 bg-background/50 focus:bg-background transition-colors"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="birthday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.birthday")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type="date"
                            className="h-11 bg-background/50 focus:bg-background transition-colors block w-full"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.gender")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isDemoMode}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 bg-background/50 focus:bg-background transition-colors">
                            <SelectValue
                              placeholder={t("profile.selectGender")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">
                            {t("profile.male")}
                          </SelectItem>
                          <SelectItem value="female">
                            {t("profile.female")}
                          </SelectItem>
                          <SelectItem value="other">
                            {t("profile.other")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </fieldset>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>
            {t("profile.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              id="customer-password-form"
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="space-y-6"
            >
              <fieldset disabled={isDemoMode} className="space-y-6">
              <FormField
                control={passwordForm.control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      {t("profile.oldPassword")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showOldPassword ? "text" : "password"}
                          className="h-11 bg-background/50 focus:bg-background transition-colors pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full hover:bg-transparent"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                        >
                          {showOldPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      {t("profile.newPassword")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showNewPassword ? "text" : "password"}
                          className="h-11 bg-background/50 focus:bg-background transition-colors pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      {t("profile.confirmPassword")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showConfirmPassword ? "text" : "password"}
                          className="h-11 bg-background/50 focus:bg-background transition-colors pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full hover:bg-transparent"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </fieldset>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
