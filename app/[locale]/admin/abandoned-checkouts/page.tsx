import "server-only";
import {
  MailCheck,
  RotateCcw,
  ShoppingCart,
  TimerReset,
  WalletCards,
} from "lucide-react";
import { AbandonedCheckout, Cart } from "@/models";
import { connectDB } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import {
  AdminStatsStrip,
  type AdminStatsStripItem,
} from "@/components/admin/admin-stats-strip";
import { AbandonedCheckoutsDataTable } from "@/components/admin/abandoned-checkouts-data-table";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { getCheckoutSubtotal } from "@/lib/abandoned-checkouts";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface AbandonedCheckoutStats {
  total: number;
  open: number;
  recovered: number;
  emailsSent: number;
  potentialRevenue: number;
}

export default async function AdminAbandonedCheckoutsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);

  const page = typeof search.page === "string" ? parseInt(search.page, 10) : 1;
  const view = typeof search.view === "string" ? search.view : "all";
  const emailStatus =
    typeof search.emailStatus === "string" ? search.emailStatus : "all";
  const sortBy =
    typeof search.sortBy === "string" ? search.sortBy : "abandonedAt";
  const sortOrder = search.sortOrder === "asc" ? "asc" : "desc";
  const searchQuery =
    typeof search.search === "string" ? search.search : undefined;
  const stats = await getAbandonedCheckoutStats();

  const statItems: AdminStatsStripItem[] = [
    {
      title: "Abandoned",
      value: new Intl.NumberFormat(locale).format(stats.total),
      description: "Checkout drafts left before payment",
      icon: <ShoppingCart className="h-5 w-5" />,
      iconClassName: "text-amber-700 bg-amber-100",
    },
    {
      title: "Open",
      value: new Intl.NumberFormat(locale).format(stats.open),
      description: "Still eligible for recovery",
      icon: <TimerReset className="h-5 w-5" />,
      iconClassName: "text-orange-700 bg-orange-100",
    },
    {
      title: "Recovered",
      value: new Intl.NumberFormat(locale).format(stats.recovered),
      description: "Returned and completed checkout",
      icon: <RotateCcw className="h-5 w-5" />,
      iconClassName: "text-green-700 bg-green-100",
    },
    {
      title: "Emails sent",
      value: new Intl.NumberFormat(locale).format(stats.emailsSent),
      description: "Recovery emails delivered to SMTP",
      icon: <MailCheck className="h-5 w-5" />,
      iconClassName: "text-blue-700 bg-blue-100",
    },
    {
      title: "Potential revenue",
      value: formatCurrency(stats.potentialRevenue, locale),
      description: "Open abandoned checkout value",
      icon: <WalletCards className="h-5 w-5" />,
      iconClassName: "text-cyan-700 bg-cyan-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AdminStatsStrip items={statItems} />
      <AbandonedCheckoutsDataTable
        locale={locale}
        initialPage={page}
        initialSearch={searchQuery}
        initialView={view}
        initialEmailStatus={emailStatus}
        initialSortBy={sortBy}
        initialSortOrder={sortOrder}
      />
    </div>
  );
}

async function getAbandonedCheckoutStats(): Promise<AbandonedCheckoutStats> {
  await connectDB();

  const [snapshotDocs, cartDocs] = await Promise.all([
    AbandonedCheckout.find({
      status: { $in: ["open", "recovered"] },
      checkoutStartedAt: { $exists: true },
      abandonedAt: { $exists: true },
      "items.0": { $exists: true },
    })
      .select(
        "checkoutToken cartId recoveryStatus recoveryEmailStatus totalPrice subtotalPrice",
      )
      .lean(),
    Cart.find({
      status: { $in: ["abandoned", "recovered"] },
      "items.0": { $exists: true },
      $or: [
        { checkoutStartedAt: { $exists: true } },
        { abandonedAt: { $exists: true } },
      ],
    })
      .select(
        "checkoutToken recoveryStatus recoveryEmailStatus totalPrice subtotalPrice items",
      )
      .lean(),
  ]);

  const seen = new Set<string>();
  const rows = [
    ...snapshotDocs.map((checkout) => {
      const key = String(checkout.checkoutToken || checkout.cartId || checkout._id);
      seen.add(key);
      return {
        recoveryStatus: checkout.recoveryStatus,
        recoveryEmailStatus: checkout.recoveryEmailStatus,
        totalPrice: checkout.totalPrice ?? checkout.subtotalPrice ?? 0,
      };
    }),
    ...cartDocs
      .filter((cart) => !seen.has(String(cart.checkoutToken || cart._id)))
      .map((cart) => ({
        recoveryStatus: cart.recoveryStatus,
        recoveryEmailStatus: cart.recoveryEmailStatus,
        totalPrice:
          cart.totalPrice ?? cart.subtotalPrice ?? getCheckoutSubtotal(cart),
      })),
  ];

  const openRows = rows.filter((row) => row.recoveryStatus !== "recovered");

  return {
    total: rows.length,
    open: openRows.length,
    recovered: rows.filter((row) => row.recoveryStatus === "recovered").length,
    emailsSent: rows.filter((row) => row.recoveryEmailStatus === "sent").length,
    potentialRevenue: openRows.reduce(
      (sum, row) => sum + Number(row.totalPrice || 0),
      0,
    ),
  };
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
