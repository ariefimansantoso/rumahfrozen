"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { TwoFactorEnrollment } from "@/components/account/two-factor-enrollment";

/**
 * Self-service 2FA setup screen. Reached from the dashboard reminder banner when
 * the security policy requires 2FA for the user's role, or voluntarily by any
 * user who wants to protect their account. On completion the user is sent to
 * `redirectTo`; they can also return to their dashboard at any time.
 */
export function TwoFactorSetupClient(props: {
  redirectTo: string;
  locale: string;
  /** True when the store policy mandates 2FA for this user's role. */
  required?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();

  const goToDestination = () => {
    router.push(props.redirectTo);
    router.refresh();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-2">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">
          {t("twoFactorSetup.title")}
        </CardTitle>
        <CardDescription>
          {props.required
            ? t("twoFactorSetup.description")
            : t("twoFactorSetup.descriptionOptional")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TwoFactorEnrollment
          description={t("twoFactorSetup.passwordHint")}
          onDone={goToDestination}
          doneLabel={t("twoFactorSetup.continue")}
        />
        <Button variant="link" className="w-full" onClick={goToDestination}>
          {t("twoFactorSetup.backToDashboard")}
        </Button>
      </CardContent>
    </Card>
  );
}
