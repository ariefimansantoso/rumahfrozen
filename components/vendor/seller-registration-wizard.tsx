"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Store,
  MapPin,
  Share2,
  Building2,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  Users,
  Star,
  Package,
  Zap,
  DollarSign,
  Headphones,
  User,
  Mail,
  Lock,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { authClient, signUp } from "@/lib/auth-client";
import { VENDOR_STATUS } from "@/config/app.config";
import { cn } from "@/lib/utils";

// Validation schema for vendor registration (includes account creation)
const vendorRegistrationSchema = z.object({
  // Account creation fields (for non-logged-in users)
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Please enter a valid email")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("")),

  // Business Information
  storeName: z
    .string()
    .min(3, "Store name must be at least 3 characters")
    .max(100, "Store name cannot exceed 100 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  logo: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  banner: z.string().url("Must be a valid URL").optional().or(z.literal("")),

  // Business Address
  street: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  postalCode: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),

  // Social & Contact
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  facebook: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagram: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  twitter: z.string().url("Must be a valid URL").optional().or(z.literal("")),

  // Bank Details (Optional)
  accountName: z.string().optional().or(z.literal("")),
  accountNumber: z.string().optional().or(z.literal("")),
  bankName: z.string().optional().or(z.literal("")),
  routingNumber: z.string().optional().or(z.literal("")),
  swiftCode: z.string().optional().or(z.literal("")),
});

type VendorRegistrationFormData = z.infer<typeof vendorRegistrationSchema>;

interface SellerRegistrationWizardProps {
  locale: string;
}

// Steps for non-authenticated users (includes account creation)
const STEPS_WITH_ACCOUNT = [
  { id: 0, icon: User, key: "stepAccount" },
  { id: 1, icon: Store, key: "step1" },
  { id: 2, icon: MapPin, key: "step2" },
  { id: 3, icon: Share2, key: "step3" },
  { id: 4, icon: Building2, key: "step4" },
  { id: 5, icon: FileCheck, key: "step5" },
];

// Steps for authenticated users (no account creation needed)
const STEPS_AUTHENTICATED = [
  { id: 1, icon: Store, key: "step1" },
  { id: 2, icon: MapPin, key: "step2" },
  { id: 3, icon: Share2, key: "step3" },
  { id: 4, icon: Building2, key: "step4" },
  { id: 5, icon: FileCheck, key: "step5" },
];

const BENEFITS = [
  { icon: Users, key: "benefit1" },
  { icon: DollarSign, key: "benefit2" },
  { icon: Zap, key: "benefit3" },
  { icon: Package, key: "benefit4" },
  { icon: Star, key: "benefit5" },
  { icon: Headphones, key: "benefit6" },
];

export function SellerRegistrationWizard({
  locale,
}: SellerRegistrationWizardProps) {
  const t = useTranslations("vendor.registration");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tVendor = useTranslations("vendor");
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [existingApplication, setExistingApplication] = useState<{
    hasApplication: boolean;
    status: string | null;
    vendor?: any;
  } | null>(null);

  // Get the appropriate steps based on auth status
  const STEPS = isLoggedIn ? STEPS_AUTHENTICATED : STEPS_WITH_ACCOUNT;
  const minStep = isLoggedIn ? 1 : 0;
  const maxStep = 5;

  const form = useForm<VendorRegistrationFormData>({
    resolver: zodResolver(vendorRegistrationSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      storeName: "",
      description: "",
      logo: "",
      banner: "",
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      phone: "",
      website: "",
      facebook: "",
      instagram: "",
      twitter: "",
      accountName: "",
      accountNumber: "",
      bankName: "",
      routingNumber: "",
      swiftCode: "",
    },
  });

  // Load draft from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem("vendorApplicationDraft");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        form.reset(draft);
      } catch (e) {
        console.error("Failed to load draft:", e);
      }
    }
  }, [form]);

  // Check authentication and existing application status
  useEffect(() => {
    async function checkStatus() {
      try {
        const { data: session } = await authClient.getSession();
        const loggedIn = !!session?.user;
        setIsLoggedIn(loggedIn);

        // Set initial step based on auth status
        setCurrentStep(loggedIn ? 1 : 0);

        if (loggedIn) {
          const res = await fetch("/api/vendor/apply");
          const data = await res.json();

          if (data.success) {
            setExistingApplication(data.data);
          }
        }
      } catch (error) {
        console.error("Failed to check status:", error);
      } finally {
        setIsLoading(false);
      }
    }

    checkStatus();
  }, []);

  // Save draft to localStorage
  const saveDraft = () => {
    const values = form.getValues();
    // Don't save password in draft
    const { password, ...draftValues } = values;
    localStorage.setItem("vendorApplicationDraft", JSON.stringify(draftValues));
    toast.success(t("draftSaved"));
  };

  // Validate current step before proceeding
  const validateStep = async (step: number): Promise<boolean> => {
    const fieldsToValidate: (keyof VendorRegistrationFormData)[] = [];

    switch (step) {
      case 0:
        if (!isLoggedIn) {
          fieldsToValidate.push("name", "email", "password");
        }
        break;
      case 1:
        fieldsToValidate.push("storeName", "description");
        break;
      // Address, social, bank fields are optional
    }

    if (fieldsToValidate.length > 0) {
      const result = await form.trigger(fieldsToValidate);
      return result;
    }
    return true;
  };

  // Handle account creation on step 0
  const handleAccountCreation = async (): Promise<boolean> => {
    const { name, email, password } = form.getValues();

    if (!name || !email || !password) {
      return false;
    }

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        emailVerificationAudience: "vendor",
      } as Parameters<typeof signUp.email>[0] & {
        emailVerificationAudience: "vendor";
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to create account");
        return false;
      }

      // Account created, now log them in automatically
      setIsLoggedIn(true);
      toast.success("Account created successfully!");
      return true;
    } catch (error) {
      toast.error("Failed to create account");
      return false;
    }
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) return;

    // If on step 0 (account creation), create the account first
    if (currentStep === 0 && !isLoggedIn) {
      setIsSubmitting(true);
      const accountCreated = await handleAccountCreation();
      setIsSubmitting(false);
      if (!accountCreated) return;
    }

    if (currentStep < maxStep) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > minStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: VendorRegistrationFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        storeName: data.storeName,
        description: data.description,
        logo: data.logo || null,
        banner: data.banner || null,
        address: data.street
          ? {
              street: data.street,
              city: data.city,
              state: data.state,
              postalCode: data.postalCode,
              country: data.country,
              phone: data.phone,
            }
          : null,
        socialLinks: {
          website: data.website || null,
          facebook: data.facebook || null,
          instagram: data.instagram || null,
          twitter: data.twitter || null,
        },
        bankDetails: data.accountName
          ? {
              accountName: data.accountName,
              accountNumber: data.accountNumber,
              bankName: data.bankName,
              routingNumber: data.routingNumber,
              swiftCode: data.swiftCode,
            }
          : null,
      };

      console.log("Submitting vendor application:", payload);

      const res = await fetch("/api/vendor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      console.log("API response:", result);

      if (res.ok && result.success) {
        localStorage.removeItem("vendorApplicationDraft");
        toast.success(t("applicationSubmitted"));
        setExistingApplication({
          hasApplication: true,
          status: VENDOR_STATUS.PENDING,
          vendor: result.data?.vendor,
        });
      } else {
        // Handle validation errors with detailed messages
        if (result.errors && typeof result.errors === "object") {
          const errorMessages = Object.entries(result.errors)
            .map(
              ([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`,
            )
            .join("; ");
          toast.error(errorMessages || "Validation failed");
        } else {
          toast.error(result.message || "Failed to submit application");
        }
        console.error("Application error:", result);
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("An error occurred while submitting your application");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-12 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-64 mx-auto" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Already has application - show status
  if (existingApplication?.hasApplication) {
    const status = existingApplication.status;

    return (
      <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/30">
        <CardContent className="pt-12 pb-10 text-center">
          {status === VENDOR_STATUS.PENDING && (
            <>
              <div className="inline-flex p-4 rounded-full bg-yellow-500/10 mb-6">
                <Clock className="h-10 w-10 text-yellow-500" />
              </div>
              <h3 className="font-semibold text-2xl mb-3">
                {t("applicationPending")}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t("applicationPendingDesc")}
              </p>
            </>
          )}

          {status === VENDOR_STATUS.APPROVED && (
            <>
              <div className="inline-flex p-4 rounded-full bg-green-500/10 mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="font-semibold text-2xl mb-3">
                {t("applicationApproved")}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                {t("applicationApprovedDesc")}
              </p>
              <Button size="lg" asChild className="px-8">
                <a href={`/${locale}/vendor/dashboard`}>
                  {tVendor("goToDashboard")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </>
          )}

          {status === VENDOR_STATUS.REJECTED && (
            <>
              <div className="inline-flex p-4 rounded-full bg-destructive/10 mb-6">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="font-semibold text-2xl mb-3">
                {t("applicationRejected")}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t("applicationRejectedDesc")}
              </p>
            </>
          )}

          {status === VENDOR_STATUS.SUSPENDED && (
            <>
              <div className="inline-flex p-4 rounded-full bg-destructive/10 mb-6">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="font-semibold text-2xl mb-3">
                {t("applicationSuspended")}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t("applicationSuspendedDesc")}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Render the multi-step form
  return (
    <div className="space-y-8">
      {/* Step Progress Indicator */}
      <div className="relative">
        <div className="flex justify-between items-center">
          {STEPS.map((step) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div
                key={step.id}
                className="flex flex-col items-center relative z-10"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted) setCurrentStep(step.id);
                  }}
                  disabled={!isCompleted && !isActive}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive &&
                      "bg-primary text-primary-foreground shadow-lg scale-110",
                    isCompleted &&
                      "bg-primary text-primary-foreground cursor-pointer hover:scale-105",
                    !isActive &&
                      !isCompleted &&
                      "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </button>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium hidden sm:block",
                    isActive && "text-primary",
                    isCompleted && "text-primary",
                    !isActive && !isCompleted && "text-muted-foreground",
                  )}
                >
                  {step.key === "stepAccount"
                    ? t("stepAccountTitle")
                    : t(`${step.key}Title`)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-muted -z-0">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width: `${((currentStep - minStep) / (maxStep - minStep)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Form Card */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {/* Step 0: Account Creation (only for non-logged-in users) */}
              {!isLoggedIn && (
                <div className={cn("space-y-6", currentStep !== 0 && "hidden")}>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2">
                      {t("stepAccountTitle")}
                    </h2>
                    <p className="text-muted-foreground">
                      {t("stepAccountDesc")}
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">
                          {tAuth("fullName")} *
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="John Doe"
                              className="h-12 pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">
                          {tAuth("email")} *
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="name@example.com"
                              className="h-12 pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">
                          {tAuth("password")} *
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="••••••••"
                              className="h-12 pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>{t("passwordHelper")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="text-center pt-4 text-sm text-muted-foreground">
                    {tAuth("hasAccount")}{" "}
                    <Link
                      href={`/${locale}/login?callbackUrl=/${locale}/become-vendor`}
                      className="text-primary font-medium hover:underline"
                    >
                      {tAuth("signIn")}
                    </Link>
                  </div>
                </div>
              )}

              {/* Step 1: Business Information */}
              <div className={cn("space-y-6", currentStep !== 1 && "hidden")}>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">{t("step1Title")}</h2>
                  <p className="text-muted-foreground">{t("step1Desc")}</p>
                </div>

                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        {t("storeNameLabel")} *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("storeNamePlaceholder")}
                          className="h-12"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t("storeNameHelper")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        {t("storeDescLabel")} *
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("storeDescPlaceholder")}
                          className="min-h-[140px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t("storeDescHelper")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="logo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("storeLogoLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("storeLogoPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t("storeLogoHelper")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="banner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("storeBannerLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("storeBannerPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t("storeBannerHelper")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Step 2: Business Address */}
              <div className={cn("space-y-6", currentStep !== 2 && "hidden")}>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">{t("step2Title")}</h2>
                  <p className="text-muted-foreground">{t("step2Desc")}</p>
                </div>

                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("streetLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("streetPlaceholder")}
                          className="h-12"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("cityLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("cityPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("stateLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("statePlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("postalCodeLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("postalCodePlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("countryLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("countryPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("businessPhoneLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("businessPhonePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Step 3: Social & Contact */}
              <div className={cn("space-y-6", currentStep !== 3 && "hidden")}>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">{t("step3Title")}</h2>
                  <p className="text-muted-foreground">{t("step3Desc")}</p>
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("websiteLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("websitePlaceholder")}
                          className="h-12"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t("websiteHelper")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="facebook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("facebookLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("facebookPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("instagramLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("instagramPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("twitterLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("twitterPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <p className="text-sm text-muted-foreground text-center mt-4">
                  {t("socialLinksHelper")}
                </p>
              </div>

              {/* Step 4: Bank Details */}
              <div className={cn("space-y-6", currentStep !== 4 && "hidden")}>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">
                    {t("step4Title")}{" "}
                    <span className="text-muted-foreground font-normal text-lg">
                      ({t("optional")})
                    </span>
                  </h2>
                  <p className="text-muted-foreground">{t("step4Desc")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="accountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("accountNameLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("accountNamePlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("accountNumberLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("accountNumberPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("bankNameLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("bankNamePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="routingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("routingNumberLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("routingNumberPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="swiftCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("swiftCodeLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("swiftCodePlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <p className="text-sm text-muted-foreground text-center mt-4">
                  {t("bankDetailsHelper")}
                </p>
              </div>

              {/* Step 5: Review & Submit */}
              <div className={cn("space-y-6", currentStep !== 5 && "hidden")}>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">{t("step5Title")}</h2>
                  <p className="text-muted-foreground">{t("step5Desc")}</p>
                </div>

                {/* Review Summary */}
                <div className="space-y-6">
                  {/* Business Info */}
                  <div className="rounded-lg border p-6 bg-muted/30">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      {t("businessInfo")}
                    </h3>
                    <div className="grid gap-4">
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          {t("storeNameLabel")}
                        </dt>
                        <dd className="font-medium">
                          {form.watch("storeName") || "-"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          {t("storeDescLabel")}
                        </dt>
                        <dd className="font-medium text-sm">
                          {form.watch("description") || "-"}
                        </dd>
                      </div>
                    </div>
                  </div>

                  {/* Address Info */}
                  {(form.watch("street") || form.watch("city")) && (
                    <div className="rounded-lg border p-6 bg-muted/30">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        {t("addressInfo")}
                      </h3>
                      <div className="grid gap-2">
                        <dd className="font-medium">
                          {[
                            form.watch("street"),
                            form.watch("city"),
                            form.watch("state"),
                            form.watch("postalCode"),
                            form.watch("country"),
                          ]
                            .filter(Boolean)
                            .join(", ") || "-"}
                        </dd>
                        {form.watch("phone") && (
                          <dd className="text-sm text-muted-foreground">
                            {form.watch("phone")}
                          </dd>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Social Info */}
                  {(form.watch("website") ||
                    form.watch("facebook") ||
                    form.watch("instagram") ||
                    form.watch("twitter")) && (
                    <div className="rounded-lg border p-6 bg-muted/30">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" />
                        {t("socialInfo")}
                      </h3>
                      <div className="grid gap-2">
                        {form.watch("website") && (
                          <dd className="text-sm">{form.watch("website")}</dd>
                        )}
                        {form.watch("facebook") && (
                          <dd className="text-sm">{form.watch("facebook")}</dd>
                        )}
                        {form.watch("instagram") && (
                          <dd className="text-sm">{form.watch("instagram")}</dd>
                        )}
                        {form.watch("twitter") && (
                          <dd className="text-sm">{form.watch("twitter")}</dd>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bank Info */}
                  {form.watch("accountName") && (
                    <div className="rounded-lg border p-6 bg-muted/30">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {t("bankInfo")}
                      </h3>
                      <div className="grid gap-2">
                        <div>
                          <dt className="text-sm text-muted-foreground">
                            {t("bankNameLabel")}
                          </dt>
                          <dd className="font-medium">
                            {form.watch("bankName") || "-"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-muted-foreground">
                            {t("accountNameLabel")}
                          </dt>
                          <dd className="font-medium">
                            {form.watch("accountName") || "-"}
                          </dd>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center mt-10 pt-6 border-t">
                <div className="flex gap-3">
                  {currentStep > minStep && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="px-6"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t("previousStep")}
                    </Button>
                  )}
                  {currentStep > 0 && (
                    <Button type="button" variant="ghost" onClick={saveDraft}>
                      {t("saveDraft")}
                    </Button>
                  )}
                </div>

                <div>
                  {currentStep < maxStep ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={isSubmitting}
                      className="px-8"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {tCommon("loading")}
                        </>
                      ) : (
                        <>
                          {t("nextStep")}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("submitting")}
                        </>
                      ) : (
                        <>
                          {t("submitApplication")}
                          <CheckCircle2 className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Benefits Section - Show on first step */}
      {(currentStep === 0 || currentStep === 1) && (
        <div className="mt-12">
          <h3 className="text-xl font-semibold text-center mb-6">
            {t("whyJoin")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {BENEFITS.map((benefit) => {
              const BenefitIcon = benefit.icon;
              return (
                <div
                  key={benefit.key}
                  className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="p-3 rounded-full bg-primary/10 mb-3">
                    <BenefitIcon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-medium text-sm mb-1">
                    {t(`${benefit.key}Title`)}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t(`${benefit.key}Desc`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
