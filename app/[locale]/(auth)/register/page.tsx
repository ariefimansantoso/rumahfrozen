"use client";

import posthog from "posthog-js";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, User, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { signUp, signInWithGoogle, signInWithFacebook } from "@/lib/auth-client";
import { RegisterSchema, type RegisterInput } from "@/lib/validations";
import { useMultiVendorMode } from "@/providers/app-settings-provider";

// Google icon SVG component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Facebook icon SVG component
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="#1877F2"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { isMultiVendor } = useMultiVendorMode();

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthEnabled, setOauthEnabled] = useState<{
    google: boolean;
    facebook: boolean;
  }>({
    google: false,
    facebook: false,
  });
  const [customerEmailVerificationRequired, setCustomerEmailVerificationRequired] =
    useState<boolean | null>(null);

  // Fetch OAuth settings
  useEffect(() => {
    async function fetchOAuthSettings() {
      try {
        const res = await fetch("/api/settings/public");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setOauthEnabled({
              google: data.data.security?.googleOAuthEnabled || false,
              facebook: data.data.security?.facebookOAuthEnabled || false,
            });
            setCustomerEmailVerificationRequired(
              Boolean(data.data.security?.emailVerificationRequired),
            );
          }
        }
      } catch {
        // Silently fail - OAuth buttons just won't show
      }
    }
    fetchOAuthSettings();
  }, []);

  const form = useForm<Omit<RegisterInput, "role">>({
    resolver: zodResolver(RegisterSchema.omit({ role: true })),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: Omit<RegisterInput, "role">) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        callbackURL: `/${locale}/email-verified`,
      });

      if (result.error) {
        setError(result.error.message || t("common.error"));
        return;
      }

      const signUpData = result.data as unknown as {
        token?: string | null;
        user?: { id?: string };
      };
      const verificationRequired =
        customerEmailVerificationRequired ?? signUpData?.token === null;

      if (signUpData?.user?.id) {
        posthog.identify(signUpData.user.id, {
          name: data.name,
          email: data.email,
        });
      }
      posthog.capture("user_registered", {
        verification_required: verificationRequired,
      });

      router.push(
        verificationRequired
          ? `/${locale}/verify-email?email=${encodeURIComponent(data.email)}`
          : `/${locale}/role-redirect`,
      );
    } catch {
      setError(t("common.error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const callbackURL = `/${locale}/role-redirect`;
      await signInWithGoogle({
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: `/${locale}/login`,
      });
      // OAuth redirects automatically
    } catch {
      setError("Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setIsFacebookLoading(true);
    setError(null);
    try {
      const callbackURL = `/${locale}/role-redirect`;
      await signInWithFacebook({
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: `/${locale}/login`,
      });
      // OAuth redirects automatically
    } catch {
      setError("Failed to sign in with Facebook");
      setIsFacebookLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">
          {t("auth.createAccount")}
        </CardTitle>
        <CardDescription>
          {t("auth.createAccountDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* OAuth Buttons */}
        {(oauthEnabled.google || oauthEnabled.facebook) && (
          <>
            {oauthEnabled.google && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading || isFacebookLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                {t("auth.continueWithGoogle")}
              </Button>
            )}
            {oauthEnabled.facebook && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 mt-2"
                onClick={handleFacebookSignIn}
                disabled={isFacebookLoading || isLoading || isGoogleLoading}
              >
                {isFacebookLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FacebookIcon className="h-4 w-4" />
                )}
                {t("auth.continueWithFacebook")}
              </Button>
            )}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t("auth.orContinueWith")}
                </span>
              </div>
            </div>
          </>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.fullName")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="John Doe"
                        className="pl-10"
                        disabled={isLoading}
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
                  <FormLabel>{t("auth.email")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type="email"
                        placeholder="name@example.com"
                        className="pl-10"
                        disabled={isLoading}
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
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                t("auth.signUp")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.termsAgreement")}{" "}
          <Link
            href={`/${locale}/terms`}
            className="text-primary hover:underline"
          >
            {t("auth.termsOfService")}
          </Link>{" "}
          {t("auth.and")}{" "}
          <Link
            href={`/${locale}/privacy`}
            className="text-primary hover:underline"
          >
            {t("auth.privacyPolicy")}
          </Link>
        </p>

        {/* Want to sell? Link - now uses dynamic setting */}
        {isMultiVendor && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/5 border border-primary/10">
            <Store className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              {t("auth.wantToSell")}{" "}
              <Link
                href={`/${locale}/become-vendor`}
                className="text-primary font-medium hover:underline"
              >
                {t("auth.becomeVendor")}
              </Link>
            </span>
          </div>
        )}

        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {t("auth.hasAccount")}
            </span>
          </div>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/${locale}/login`}>{t("auth.signIn")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
