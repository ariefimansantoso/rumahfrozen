import { Bell } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { CustomerNotifications } from "@/components/account/customer-notifications";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NotificationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-3">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Follow every update for your orders.
          </p>
        </div>
      </div>

      <CustomerNotifications locale={locale} />
    </div>
  );
}
