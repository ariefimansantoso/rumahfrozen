"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { authClient } from "@/lib/auth-client";
import { VENDOR_STATUS } from "@/config/app.config";

const applicationSchema = z.object({
  storeName: z
    .string()
    .min(3, "Store name must be at least 3 characters")
    .max(100),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(1000),
  logo: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface VendorApplicationFormProps {
  locale: string;
}

export function VendorApplicationForm({ locale }: VendorApplicationFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [existingApplication, setExistingApplication] = useState<{
    hasApplication: boolean;
    status: string | null;
    vendor?: any;
  } | null>(null);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      storeName: "",
      description: "",
      logo: "",
      phone: "",
      website: "",
    },
  });

  useEffect(() => {
    async function checkStatus() {
      try {
        // Check if user is logged in
        const { data: session } = await authClient.getSession();
        setIsLoggedIn(!!session?.user);

        if (session?.user) {
          // Check for existing application
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

  const onSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vendor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: data.storeName,
          description: data.description,
          logo: data.logo || null,
          socialLinks: data.website ? { website: data.website } : null,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success("Application submitted successfully!");
        setExistingApplication({
          hasApplication: true,
          status: VENDOR_STATUS.PENDING,
          vendor: result.data.vendor,
        });
      } else {
        toast.error(result.message || "Failed to submit application");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-2">Login Required</h3>
        <p className="text-muted-foreground mb-4">
          Please log in or create an account to apply as a vendor.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild>
            <a href={`/${locale}/login?callbackUrl=/${locale}/become-vendor`}>
              Login
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`/${locale}/register?callbackUrl=/${locale}/become-vendor`}
            >
              Register
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // Already has application
  if (existingApplication?.hasApplication) {
    const status = existingApplication.status;

    return (
      <div className="text-center py-8">
        {status === VENDOR_STATUS.PENDING && (
          <>
            <Clock className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="font-medium text-lg mb-2">
              Application Under Review
            </h3>
            <p className="text-muted-foreground mb-4">
              Your vendor application is being reviewed. We'll notify you once
              it's approved.
            </p>
          </>
        )}

        {status === VENDOR_STATUS.APPROVED && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="font-medium text-lg mb-2">Application Approved!</h3>
            <p className="text-muted-foreground mb-4">
              Congratulations! Your vendor account is active. Start adding
              products now.
            </p>
            <Button asChild>
              <a href={`/${locale}/vendor/dashboard`}>
                {t("vendor.goToDashboard")}
              </a>
            </Button>
          </>
        )}

        {status === VENDOR_STATUS.REJECTED && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="font-medium text-lg mb-2">Application Rejected</h3>
            <p className="text-muted-foreground mb-4">
              Unfortunately, your application was not approved. Please contact
              support for more information.
            </p>
          </>
        )}

        {status === VENDOR_STATUS.SUSPENDED && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="font-medium text-lg mb-2">Account Suspended</h3>
            <p className="text-muted-foreground mb-4">
              Your vendor account has been suspended. Please contact support.
            </p>
          </>
        )}
      </div>
    );
  }

  // Show application form
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="storeName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store Name *</FormLabel>
              <FormControl>
                <Input placeholder="Your store name" {...field} />
              </FormControl>
              <FormDescription>
                This will be your public store name
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store Description *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about your store and what products you plan to sell..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Describe your store and product offerings
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/logo.png" {...field} />
              </FormControl>
              <FormDescription>
                Optional: URL to your store logo
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input placeholder="https://yourwebsite.com" {...field} />
              </FormControl>
              <FormDescription>
                Optional: Your existing website or social media
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Application
        </Button>
      </form>
    </Form>
  );
}
