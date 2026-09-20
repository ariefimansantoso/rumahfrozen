"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  TestTube,
  Banknote,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import {
  StripeLogo,
  PayPalLogo,
  RazorpayLogo,
  PaystackLogo,
  CashOnDeliveryLogo,
} from "./payment-brand-logos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecretInput } from "@/components/admin/settings/fields/secret-input";
import { EnvSourceHint } from "@/components/admin/settings/fields/env-source-hint";
import type { Settings } from "@/components/admin/settings/types";
import { StickySaveFooter } from "./sticky-save-footer";
import { SettingsTabHeader } from "./settings-tab-header";
import { cn } from "@/lib/utils";

type ProviderId = "stripe" | "paypal" | "razorpay" | "paystack";

function ProviderCard(props: {
  logo: ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  badges?: ReactNode;
  testButton?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground transition-colors",
        props.enabled ? "border-border" : "border-dashed",
      )}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        {props.logo}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{props.title}</h3>
            {props.badges}
          </div>
          <p className="text-xs text-muted-foreground">{props.description}</p>
        </div>
        <Switch
          checked={props.enabled}
          onCheckedChange={props.onToggle}
          aria-label={`Enable ${props.title}`}
        />
      </div>
      {props.enabled && (props.children || props.testButton) && (
        <div className="border-t px-5 py-5 space-y-4">
          {props.children}
          {props.testButton && (
            <div className="flex justify-end pt-1">{props.testButton}</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge(props: { configured: boolean }) {
  if (props.configured) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-3 w-3" />
        Configured
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CircleDashed className="h-3 w-3" />
      Not configured
    </Badge>
  );
}

function ModeBadge(props: { mode: "test" | "live" | "sandbox" }) {
  if (props.mode === "live") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">
        Live
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
    >
      {props.mode === "sandbox" ? "Sandbox" : "Test"}
    </Badge>
  );
}

function detectMode(key: string | undefined | null): "test" | "live" | null {
  if (!key) return null;
  const k = key.toLowerCase();
  if (k.includes("test") || k.startsWith("pk_test") || k.startsWith("sk_test"))
    return "test";
  if (k.includes("live") || k.startsWith("pk_live") || k.startsWith("sk_live"))
    return "live";
  return null;
}

export function PaymentSettingsTab(props: {
  settings: Settings;
  isSaving: boolean;
  isDirty: boolean;
  isTestingPayment: boolean;
  updateNestedField: (path: string, value: unknown) => void;
  onSave: () => void | Promise<unknown>;
  onTestConnection: (provider: ProviderId) => void | Promise<unknown>;
}) {
  const t = useTranslations();
  const {
    settings,
    isSaving,
    isDirty,
    isTestingPayment,
    updateNestedField,
    onSave,
    onTestConnection,
  } = props;

  const stripe = settings.payment?.stripe;
  const razorpay = settings.payment?.razorpay;
  const paystack = settings.payment?.paystack;
  const paypal = settings.payment?.paypal;
  const cod = settings.payment?.cod;

  const stripeMode = detectMode(stripe?.publishableKey);
  const razorpayMode = detectMode(razorpay?.keyId);
  const paystackMode = detectMode(paystack?.publicKey);
  const paypalMode = paypal?.mode === "live" ? "live" : "sandbox";

  // Per-field .env fallback presence (DB still wins when a value is saved).
  const env = settings._meta?.envSources?.payment;

  const stripeConfigured = Boolean(
    (stripe?.publishableKey || env?.stripe.publishableKey) &&
      (settings._meta?.payment?.stripe?.secretKeySet || env?.stripe.secretKey),
  );
  const razorpayConfigured = Boolean(
    (razorpay?.keyId || env?.razorpay.keyId) &&
      (settings._meta?.payment?.razorpay?.keySecretSet ||
        env?.razorpay.keySecret),
  );
  const paystackConfigured = Boolean(
    (paystack?.publicKey || env?.paystack.publicKey) &&
      (settings._meta?.payment?.paystack?.secretKeySet ||
        env?.paystack.secretKey),
  );
  const paypalConfigured = Boolean(
    (paypal?.clientId || env?.paypal.clientId) &&
      (settings._meta?.payment?.paypal?.clientSecretSet ||
        env?.paypal.clientSecret),
  );

  const renderTestButton = (provider: ProviderId, enabled: boolean) => {
    if (!enabled) return null;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onTestConnection(provider)}
        disabled={isSaving || isTestingPayment}
      >
        {isTestingPayment ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <TestTube className="h-4 w-4 mr-2" />
        )}
        Test connection
      </Button>
    );
  };

  const enabledCount = [
    stripe?.enabled,
    razorpay?.enabled,
    paystack?.enabled,
    paypal?.enabled,
    cod?.enabled,
  ].filter(Boolean).length;

  return (
    <div className="relative">
      <div className="space-y-6">
        <SettingsTabHeader
          title={t("admin.settings.payment.title")}
          description={t("admin.settings.payment.description")}
          meta={<Badge variant="secondary">{enabledCount} active</Badge>}
        />

        {/* Stripe */}
        <ProviderCard
          logo={<StripeLogo />}
          title={t("admin.settings.payment.stripe.title")}
          description="Accept credit & debit cards globally"
          enabled={stripe?.enabled ?? false}
          onToggle={(c) => updateNestedField("payment.stripe.enabled", c)}
          badges={
            <>
              <StatusBadge configured={stripeConfigured} />
              {stripeMode && <ModeBadge mode={stripeMode} />}
            </>
          }
          testButton={renderTestButton("stripe", stripe?.enabled ?? false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stripePublishableKey">
                {t("admin.settings.payment.stripePublishableKey")}
              </Label>
              <Input
                id="stripePublishableKey"
                value={stripe?.publishableKey || ""}
                onChange={(e) =>
                  updateNestedField(
                    "payment.stripe.publishableKey",
                    e.target.value,
                  )
                }
                placeholder="pk_live_... or pk_test_..."
              />
              <EnvSourceHint show={Boolean(env?.stripe.publishableKey)} />
            </div>
            <div className="space-y-2">
              <SecretInput
                id="stripeSecretKey"
                label={t("admin.settings.payment.stripe.secretKey")}
                value={stripe?.secretKey || ""}
                onChange={(v) => updateNestedField("payment.stripe.secretKey", v)}
                secretSet={Boolean(settings._meta?.payment?.stripe?.secretKeySet)}
                placeholderWhenSet="Saved (leave blank to keep)"
                placeholderWhenUnset="sk_live_... or sk_test_..."
                helperText="Saved keys are not shown again for security."
              />
              <EnvSourceHint show={Boolean(env?.stripe.secretKey)} />
            </div>
          </div>
          <SecretInput
            id="stripeWebhookSecret"
            label={t("admin.settings.payment.stripeWebhookSecret")}
            value={stripe?.webhookSecret || ""}
            onChange={(v) =>
              updateNestedField("payment.stripe.webhookSecret", v)
            }
            secretSet={Boolean(
              settings._meta?.payment?.stripe?.webhookSecretSet,
            )}
            placeholderWhenSet="Saved (leave blank to keep)"
            placeholderWhenUnset="whsec_..."
            helperText="Required for handling payment events. Get this from Stripe Dashboard → Developers → Webhooks."
          />
          <EnvSourceHint show={Boolean(env?.stripe.webhookSecret)} />
        </ProviderCard>

        {/* PayPal */}
        <ProviderCard
          logo={<PayPalLogo />}
          title={t("admin.settings.payment.paypal.title")}
          description="Trusted global checkout & wallet"
          enabled={paypal?.enabled ?? false}
          onToggle={(c) => updateNestedField("payment.paypal.enabled", c)}
          badges={
            <>
              <StatusBadge configured={paypalConfigured} />
              <ModeBadge mode={paypalMode} />
            </>
          }
          testButton={renderTestButton("paypal", paypal?.enabled ?? false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paypalClientId">
                {t("admin.settings.payment.paypalClientId")}
              </Label>
              <Input
                id="paypalClientId"
                value={paypal?.clientId || ""}
                onChange={(e) =>
                  updateNestedField("payment.paypal.clientId", e.target.value)
                }
              />
              <EnvSourceHint show={Boolean(env?.paypal.clientId)} />
            </div>
            <div className="space-y-2">
              <SecretInput
                id="paypalClientSecret"
                label={t("admin.settings.payment.paypal.clientSecret")}
                value={paypal?.clientSecret || ""}
                onChange={(v) =>
                  updateNestedField("payment.paypal.clientSecret", v)
                }
                secretSet={Boolean(
                  settings._meta?.payment?.paypal?.clientSecretSet,
                )}
                placeholderWhenSet="Saved (leave blank to keep)"
                helperText="Saved secrets are not shown again for security."
              />
              <EnvSourceHint show={Boolean(env?.paypal.clientSecret)} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paypalMode">
                {t("admin.settings.payment.paypalMode")}
              </Label>
              <Select
                value={paypal?.mode}
                onValueChange={(v) => updateNestedField("payment.paypal.mode", v)}
              >
                <SelectTrigger id="paypalMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">
                    {t("admin.settings.payment.paypalSandbox")}
                  </SelectItem>
                  <SelectItem value="live">
                    {t("admin.settings.payment.paypalLive")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paypalWebhookId">
                {t("admin.settings.payment.paypalWebhookId")}
              </Label>
              <Input
                id="paypalWebhookId"
                value={paypal?.webhookId || ""}
                onChange={(e) =>
                  updateNestedField(
                    "payment.paypal.webhookId",
                    e.target.value,
                  )
                }
              />
            </div>
          </div>
        </ProviderCard>

        {/* Razorpay */}
        <ProviderCard
          logo={<RazorpayLogo />}
          title="Razorpay"
          description="Popular payment gateway for India"
          enabled={razorpay?.enabled ?? false}
          onToggle={(c) => updateNestedField("payment.razorpay.enabled", c)}
          badges={
            <>
              <StatusBadge configured={razorpayConfigured} />
              {razorpayMode && <ModeBadge mode={razorpayMode} />}
            </>
          }
          testButton={renderTestButton(
            "razorpay",
            razorpay?.enabled ?? false,
          )}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="razorpayKeyId">Key ID</Label>
              <Input
                id="razorpayKeyId"
                value={razorpay?.keyId || ""}
                onChange={(e) =>
                  updateNestedField("payment.razorpay.keyId", e.target.value)
                }
                placeholder="rzp_test_... or rzp_live_..."
              />
              <EnvSourceHint show={Boolean(env?.razorpay.keyId)} />
            </div>
            <div className="space-y-2">
              <SecretInput
                id="razorpayKeySecret"
                label="Key Secret"
                value={razorpay?.keySecret || ""}
                onChange={(v) =>
                  updateNestedField("payment.razorpay.keySecret", v)
                }
                secretSet={Boolean(
                  settings._meta?.payment?.razorpay?.keySecretSet,
                )}
                placeholderWhenSet="Saved (leave blank to keep)"
                placeholderWhenUnset="Key secret"
                helperText="Saved keys are not shown again for security."
              />
              <EnvSourceHint show={Boolean(env?.razorpay.keySecret)} />
            </div>
          </div>
          <SecretInput
            id="razorpayWebhookSecret"
            label="Webhook Secret"
            value={razorpay?.webhookSecret || ""}
            onChange={(v) =>
              updateNestedField("payment.razorpay.webhookSecret", v)
            }
            secretSet={Boolean(
              settings._meta?.payment?.razorpay?.webhookSecretSet,
            )}
            placeholderWhenSet="Saved (leave blank to keep)"
            placeholderWhenUnset="Webhook secret"
            helperText="Saved secrets are not shown again for security."
          />
          <EnvSourceHint show={Boolean(env?.razorpay.webhookSecret)} />
        </ProviderCard>

        {/* Paystack */}
        <ProviderCard
          logo={<PaystackLogo />}
          title="Paystack"
          description="Modern payments for Africa"
          enabled={paystack?.enabled ?? false}
          onToggle={(c) => updateNestedField("payment.paystack.enabled", c)}
          badges={
            <>
              <StatusBadge configured={paystackConfigured} />
              {paystackMode && <ModeBadge mode={paystackMode} />}
            </>
          }
          testButton={renderTestButton(
            "paystack",
            paystack?.enabled ?? false,
          )}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paystackPublicKey">Public Key</Label>
              <Input
                id="paystackPublicKey"
                value={paystack?.publicKey || ""}
                onChange={(e) =>
                  updateNestedField(
                    "payment.paystack.publicKey",
                    e.target.value,
                  )
                }
                placeholder="pk_test_... or pk_live_..."
              />
              <EnvSourceHint show={Boolean(env?.paystack.publicKey)} />
            </div>
            <div className="space-y-2">
              <SecretInput
                id="paystackSecretKey"
                label="Secret Key"
                value={paystack?.secretKey || ""}
                onChange={(v) =>
                  updateNestedField("payment.paystack.secretKey", v)
                }
                secretSet={Boolean(
                  settings._meta?.payment?.paystack?.secretKeySet,
                )}
                placeholderWhenSet="Saved (leave blank to keep)"
                placeholderWhenUnset="sk_test_... or sk_live_..."
                helperText="Saved keys are not shown again for security."
              />
              <EnvSourceHint show={Boolean(env?.paystack.secretKey)} />
            </div>
          </div>
        </ProviderCard>

        {/* Cash on Delivery */}
        <ProviderCard
          logo={<CashOnDeliveryLogo />}
          title={t("admin.settings.payment.cod.title")}
          description="Let customers pay when their order arrives"
          enabled={cod?.enabled ?? false}
          onToggle={(c) => updateNestedField("payment.cod.enabled", c)}
          badges={
            <Badge variant="outline" className="gap-1">
              <Banknote className="h-3 w-3" />
              Offline
            </Badge>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="codInstructions">
              {t("admin.settings.payment.codInstructions")}
            </Label>
            <Textarea
              id="codInstructions"
              value={cod?.instructions || ""}
              onChange={(e) =>
                updateNestedField("payment.cod.instructions", e.target.value)
              }
              rows={3}
              placeholder="e.g. Please keep exact change ready when the courier arrives."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="codMinOrder">
                {t("admin.settings.payment.codMinOrder")}
              </Label>
              <Input
                id="codMinOrder"
                type="number"
                value={cod?.minOrderAmount || 0}
                onChange={(e) =>
                  updateNestedField(
                    "payment.cod.minOrderAmount",
                    parseFloat(e.target.value),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codMaxOrder">
                {t("admin.settings.payment.codMaxOrder")}
              </Label>
              <Input
                id="codMaxOrder"
                type="number"
                value={cod?.maxOrderAmount || 0}
                onChange={(e) =>
                  updateNestedField(
                    "payment.cod.maxOrderAmount",
                    parseFloat(e.target.value),
                  )
                }
              />
            </div>
          </div>
        </ProviderCard>
      </div>

      <StickySaveFooter
        label={t("admin.settings.general.save")}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={onSave}
      />
    </div>
  );
}
