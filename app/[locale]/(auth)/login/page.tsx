"use client";

import posthog from "posthog-js";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Suspense, useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Loader2, Shield } from "lucide-react";
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
import {
  signIn,
  signInWithGoogle,
  signInWithFacebook,
  authClient,
  getSession,
} from "@/lib/auth-client";
import { Separator } from "@/components/ui/separator";
import { LoginSchema, type LoginInput } from "@/lib/validations";
import { useRouter, useParams, useSearchParams } from "next/navigation";

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

function LoginContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedSearchErrorKey, setDismissedSearchErrorKey] = useState<
    string | null
  >(null);
  const [oauthEnabled, setOauthEnabled] = useState<{
    google: boolean;
    facebook: boolean;
  }>({
    google: false,
    facebook: false,
  });

  // no copy state

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");


  const formatRoleLabel = (role: string) => {
    const value = role.trim();
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const searchErrorCode = searchParams.get("error");
  const searchErrorRole = searchParams.get("role") || "";
  const searchErrorEmail = searchParams.get("email") || "";
  const searchErrorKey = searchErrorCode
    ? `${searchErrorCode}:${searchErrorRole}:${searchErrorEmail}`
    : null;
  let searchErrorMessage: string | null = null;

  if (searchErrorCode === "oauth_account_role_conflict") {
    const role = formatRoleLabel(searchErrorRole);
    searchErrorMessage = t("auth.oauthRoleConflict", {
      email:
        searchErrorEmail ||
        t("auth.thisEmail"),
      role: role || t("auth.vendorRole"),
    });
  } else if (
    searchErrorCode === "oauth_customer_only" ||
    searchErrorCode === "OAUTH_SIGNIN_IS_ONLY_AVAILABLE_FOR_CUSTOMERS"
  ) {
    searchErrorMessage = t("auth.oauthCustomerOnly");
  }

  const visibleError =
    error ||
    (searchErrorKey !== dismissedSearchErrorKey ? searchErrorMessage : null);

  const dismissSearchError = () => {
    if (searchErrorKey) {
      setDismissedSearchErrorKey(searchErrorKey);
    }
  };

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
          }
        }
      } catch {
        // Silently fail - OAuth buttons just won't show
      }
    }
    fetchOAuthSettings();
  }, []);

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const resolveRoleAfterLogin = async (userRole?: string) => {
    if (userRole) return userRole;

    const sessionResult = await getSession();
    const sessionUser = sessionResult.data?.user as
      | { role?: string; roles?: string[] }
      | undefined;

    if (sessionUser?.role) return sessionUser.role;
    if (sessionUser?.roles?.includes("admin")) return "admin";
    if (sessionUser?.roles?.includes("vendor")) return "vendor";
    if (sessionUser?.roles?.includes("staff")) return "staff";
    if (sessionUser?.roles?.includes("seller")) return "seller";

    return undefined;
  };

  const redirectAfterLogin = async (userRole?: string) => {
    // Check for redirect query parameter first (e.g., from checkout page)
    const redirectParam = searchParams.get("redirect");
    if (redirectParam) {
      router.push(redirectParam);
      router.refresh();
      return;
    }

    const resolvedRole = await resolveRoleAfterLogin(userRole);

    // Default role-based redirects
    let redirectPath = `/${locale}/account`;
    if (resolvedRole === "admin") {
      redirectPath = `/${locale}/admin/dashboard`;
    } else if (resolvedRole === "vendor") {
      redirectPath = `/${locale}/vendor/dashboard`;
    } else if (resolvedRole === "staff" || resolvedRole === "seller") {
      redirectPath = `/${locale}/staff/dashboard`;
    }
    router.push(redirectPath);
    router.refresh();
  };

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError(null);
    dismissSearchError();

    try {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          router.push(
            `/${locale}/verify-email?email=${encodeURIComponent(data.email)}`,
          );
          return;
        }
        setError(result.error.message || t("errors.unauthorized"));
        return;
      }

      const signInData = result.data as unknown as {
        user?: { id?: string; email?: string; role?: string };
        twoFactorRedirect?: boolean;
      };
      if (signInData?.twoFactorRedirect) {
        setRequires2FA(true);
        return;
      }

      if (signInData?.user?.id) {
        posthog.identify(signInData.user.id, { email: data.email });
      }
      posthog.capture("user_signed_in", {
        method: "email",
        role: signInData?.user?.role,
      });

      await redirectAfterLogin(signInData?.user?.role);
    } catch {
      setError(t("common.error"));
    } finally {
      setIsLoading(false);
    }
  };


  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    dismissSearchError();
    try {
      const redirectParam = searchParams.get("redirect");
      const callbackURL = `/${locale}/role-redirect${
        redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""
      }`;
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
    dismissSearchError();
    try {
      const redirectParam = searchParams.get("redirect");
      const callbackURL = `/${locale}/role-redirect${
        redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""
      }`;
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

  const handle2FAVerify = async () => {
    if (twoFactorCode.length !== 6) return;

    setIs2FALoading(true);
    setError(null);

    try {
      const verifyResult = await authClient.twoFactor.verifyTotp({
        code: twoFactorCode,
        trustDevice: true,
      });
      if (verifyResult.error) {
        setError(verifyResult.error.message || "Invalid 2FA code");
        return;
      }

      const session = await getSession();
      const userRole = (
        session.data?.user as { role?: string } | undefined
      )?.role;
      await redirectAfterLogin(userRole);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIs2FALoading(false);
    }
  };

  // 2FA Verification Screen
  if (requires2FA) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {t("auth.twoFactorTitle")}
          </CardTitle>
          <CardDescription>
            {t("auth.twoFactorDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={twoFactorCode}
              onChange={(e) =>
                setTwoFactorCode(e.target.value.replace(/\D/g, ""))
              }
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
              disabled={is2FALoading}
            />
          </div>
          <Button
            className="w-full"
            onClick={handle2FAVerify}
            disabled={is2FALoading || twoFactorCode.length !== 6}
          >
            {is2FALoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              t("auth.verify")
            )}
          </Button>
        </CardContent>
        <CardFooter>
          <Button
            variant="link"
            className="w-full"
            onClick={() => {
              setRequires2FA(false);
              setTwoFactorCode("");
              setError(null);
            }}
          >
            {t("auth.backToLogin")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
      <Card className="shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {t("auth.welcomeBack")}
          </CardTitle>
          <CardDescription>{t("auth.signIn")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* OAuth Buttons */}
          {(oauthEnabled.google || oauthEnabled.facebook) && (
            <>
              <div className="space-y-2">
                {oauthEnabled.google && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading || isFacebookLoading || isLoading}
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
                    className="w-full gap-2"
                    onClick={handleFacebookSignIn}
                    disabled={isGoogleLoading || isFacebookLoading || isLoading}
                  >
                    {isFacebookLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FacebookIcon className="h-4 w-4" />
                    )}
                    {t("auth.continueWithFacebook")}
                  </Button>
                )}
              </div>
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
              {visibleError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {visibleError}
                </div>
              )}

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

              <div className="flex items-center justify-end">
                <Link
                  href={`/${locale}/forgot-password`}
                  className="text-sm text-primary hover:underline"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : (
                  t("auth.signIn")
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t("auth.noAccount")}
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/${locale}/register`}>{t("auth.createAccount")}</Link>
          </Button>
        </CardFooter>
      </Card>
  );
}

function LoginFallback() {
  return (
    <Card className="shadow-lg">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
