"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, RefreshCcw, Wallet, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";
import { useMultiVendorMode } from "@/providers/app-settings-provider";
import {
  DashboardStatsGrid,
  DashboardStatsGridSkeleton,
  type DashboardStatCardItem,
} from "@/components/admin/dashboard-stat-card";
import {
  DataTable,
  TextCell,
  type DataTableColumn,
} from "@/components/ui/data-table";

type OverviewPayload = {
  totals: {
    paidRevenue: number;
    refundedAmount: number;
    pendingPayments: number;
    refundedOrders: number;
    pendingPayoutAmount: number;
    paidPayoutAmount: number;
  };
  gatewayHealth: {
    stripe: { enabled: boolean; configured: boolean };
    paypal: { enabled: boolean; configured: boolean };
    razorpay?: { enabled: boolean; configured: boolean };
    paystack?: { enabled: boolean; configured: boolean };
    cod: { enabled: boolean };
  };
  recentTransactions: Array<{
    _id: string;
    orderNumber: string;
    type: string;
    status: string;
    provider: string;
    paymentMethod?: string;
    grossAmount: number;
    currency?: string;
    createdAt: string;
  }>;
};

type RecentTransaction = OverviewPayload["recentTransactions"][number];

function toReadableLabel(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toKeyToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function PaymentsOverviewContent({ locale }: { locale: string }) {
  const t = useTranslations();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isMultiVendor } = useMultiVendorMode();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/payments/overview");
      const json = await res.json();
      if (res.ok && json?.success) {
        setData(json.data as OverviewPayload);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const currency = useMemo(() => "USD", []);
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "medium",
      }),
    [locale],
  );

  const translateWithFallback = useCallback(
    (key: string, fallback: string) => {
      try {
        return t(key);
      } catch {
        return fallback;
      }
    },
    [t],
  );

  const translateTransactionType = useCallback(
    (type: string) =>
      translateWithFallback(
        `admin.paymentsOverviewPage.transactionTypes.${toKeyToken(type)}`,
        toReadableLabel(type),
      ),
    [translateWithFallback],
  );

  const translateTransactionStatus = useCallback(
    (status: string) =>
      translateWithFallback(
        `admin.paymentsOverviewPage.transactionStatuses.${toKeyToken(status)}`,
        toReadableLabel(status),
      ),
    [translateWithFallback],
  );

  const translateProvider = useCallback(
    (provider: string) =>
      translateWithFallback(
        `admin.paymentsOverviewPage.providers.${toKeyToken(provider)}`,
        toReadableLabel(provider),
      ),
    [translateWithFallback],
  );

  const formatDateTime = useCallback(
    (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      return dateTimeFormatter.format(date);
    },
    [dateTimeFormatter],
  );

  const totals = data?.totals;
  const statsGridClassName =
    "grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6";
  const paymentStats: DashboardStatCardItem[] = [
    {
      id: "paid-revenue",
      label: t("admin.paymentsOverviewPage.metrics.paidRevenue"),
      value: formatCurrency(totals?.paidRevenue || 0, currency),
      icon: <CreditCard />,
    },
    {
      id: "refunded-amount",
      label: t("admin.paymentsOverviewPage.metrics.refundedAmount"),
      value: formatCurrency(totals?.refundedAmount || 0, currency),
      icon: <RefreshCcw />,
    },
    {
      id: "pending-payments",
      label: t("admin.paymentsOverviewPage.metrics.pendingPayments"),
      value: String(totals?.pendingPayments || 0),
      icon: <Wallet />,
    },
    {
      id: "refunded-orders",
      label: t("admin.paymentsOverviewPage.metrics.refundedOrders"),
      value: String(totals?.refundedOrders || 0),
      icon: <RefreshCcw />,
    },
  ];

  if (isMultiVendor) {
    paymentStats.push(
      {
        id: "pending-payout-amount",
        label: t("admin.paymentsOverviewPage.metrics.pendingPayoutAmount"),
        value: formatCurrency(totals?.pendingPayoutAmount || 0, currency),
        icon: <Wallet />,
      },
      {
        id: "paid-payout-amount",
        label: t("admin.paymentsOverviewPage.metrics.paidPayoutAmount"),
        value: formatCurrency(totals?.paidPayoutAmount || 0, currency),
        icon: <Wallet />,
      },
    );
  }

  const recentTransactionsColumns = useMemo<DataTableColumn<RecentTransaction>[]>(
    () => [
      {
        id: "order",
        header: t("admin.paymentsOverviewPage.recentTransactions.columns.order"),
        cell: (txn) => (
          <TextCell
            value={txn.orderNumber}
            className="font-medium"
            truncate
            maxWidth="260px"
          />
        ),
        className: "w-[280px]",
      },
      {
        id: "type",
        header: t("admin.paymentsOverviewPage.recentTransactions.columns.type"),
        cell: (txn) => <TextCell value={translateTransactionType(txn.type)} />,
        className: "w-[140px] hidden md:table-cell",
        headerClassName: "hidden md:table-cell",
      },
      {
        id: "provider",
        header: t("admin.paymentsOverviewPage.recentTransactions.columns.provider"),
        cell: (txn) => (
          <TextCell
            value={translateProvider(txn.provider)}
            className="uppercase"
          />
        ),
        className: "w-[160px] hidden lg:table-cell",
        headerClassName: "hidden lg:table-cell",
      },
      {
        id: "status",
        header: t("admin.paymentsOverviewPage.recentTransactions.columns.status"),
        cell: (txn) => (
          <Badge variant="outline" className="capitalize">
            {translateTransactionStatus(txn.status)}
          </Badge>
        ),
        className: "w-[160px]",
      },
      {
        id: "amount",
        header: t("admin.paymentsOverviewPage.recentTransactions.columns.amount"),
        cell: (txn) => (
          <TextCell
            value={formatCurrency(txn.grossAmount, txn.currency || currency)}
            className="block w-full text-right font-medium"
          />
        ),
        className: "w-[160px] text-right",
        headerClassName: "text-right [&>div]:justify-end",
      },
      {
        id: "date",
        header: t("admin.paymentsOverviewPage.recentTransactions.columns.date"),
        cell: (txn) => (
          <TextCell
            value={formatDateTime(txn.createdAt)}
            className="text-muted-foreground"
          />
        ),
        className: "w-[240px] hidden lg:table-cell",
        headerClassName: "hidden lg:table-cell",
      },
    ],
    [
      currency,
      formatDateTime,
      t,
      translateProvider,
      translateTransactionStatus,
      translateTransactionType,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {t("admin.paymentsOverviewPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {isMultiVendor
              ? t("admin.paymentsOverviewPage.subtitleMultiVendor")
              : t("admin.paymentsOverviewPage.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${locale}/admin/payments/transactions`}>
              {t("admin.paymentsOverviewPage.actions.transactions")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {t("admin.paymentsOverviewPage.actions.refresh")}
          </Button>
        </div>
      </div>

      {isLoading && !data ? (
        <DashboardStatsGridSkeleton
          items={isMultiVendor ? 6 : 4}
          className={statsGridClassName}
        />
      ) : (
        <DashboardStatsGrid
          stats={paymentStats}
          className={statsGridClassName}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {t("admin.paymentsOverviewPage.gatewayHealth.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <GatewayBadge
            label={t("admin.paymentsOverviewPage.gateways.stripe")}
            enabled={Boolean(data?.gatewayHealth.stripe.enabled)}
            configured={Boolean(data?.gatewayHealth.stripe.configured)}
            t={t}
          />
          <GatewayBadge
            label={t("admin.paymentsOverviewPage.gateways.paypal")}
            enabled={Boolean(data?.gatewayHealth.paypal.enabled)}
            configured={Boolean(data?.gatewayHealth.paypal.configured)}
            t={t}
          />
          <GatewayBadge
            label="Razorpay"
            enabled={Boolean(data?.gatewayHealth.razorpay?.enabled)}
            configured={Boolean(data?.gatewayHealth.razorpay?.configured)}
            t={t}
          />
          <GatewayBadge
            label="Paystack"
            enabled={Boolean(data?.gatewayHealth.paystack?.enabled)}
            configured={Boolean(data?.gatewayHealth.paystack?.configured)}
            t={t}
          />
          <GatewayBadge
            label={t("admin.paymentsOverviewPage.gateways.cashOnDelivery")}
            enabled={Boolean(data?.gatewayHealth.cod.enabled)}
            configured={true}
            t={t}
          />
        </CardContent>
      </Card>

      <DataTable
        data={data?.recentTransactions || []}
        columns={recentTransactionsColumns}
        keyField="_id"
        isLoading={isLoading && !data}
        loadingMode="rows"
        loadingRows={5}
        title={t("admin.paymentsOverviewPage.recentTransactions.title")}
        appearance="commerce"
        className="overflow-hidden [&_thead_th]:text-xs [&_tbody_td]:text-sm"
        emptyMessage={t("admin.paymentsOverviewPage.recentTransactions.empty")}
      />
    </div>
  );
}

function GatewayBadge(props: {
  label: string;
  enabled: boolean;
  configured: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!props.enabled) {
    return (
      <Badge variant="outline">
        {props.label}:{" "}
        {props.t("admin.paymentsOverviewPage.gatewayHealth.disabled", {
          defaultMessage: "disabled",
        })}
      </Badge>
    );
  }
  return (
    <Badge variant={props.configured ? "default" : "destructive"}>
      {props.label}:{" "}
      {props.configured
        ? props.t("admin.paymentsOverviewPage.gatewayHealth.connected", {
            defaultMessage: "connected",
          })
        : props.t("admin.paymentsOverviewPage.gatewayHealth.needsSetup", {
            defaultMessage: "needs setup",
          })}
    </Badge>
  );
}
