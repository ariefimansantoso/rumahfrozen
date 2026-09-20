import { auth } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { mongoose } from "@/lib/db";
import { connectDB } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { ensureCustomerProfile } from "@/lib/customer";
import { Notification } from "@/models";
import { USER_ROLES } from "@/config/app.config";
import { EmailVerificationNotice } from "@/components/auth/email-verification-notice";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

async function getAccountStats(userId: string) {
  await connectDB();

  const [profile, user, notificationsCount] = await Promise.all([
    ensureCustomerProfile(userId),
    mongoose.connection.db
      ?.collection("user")
      .findOne({ _id: new ObjectId(userId) }),
    Notification.countDocuments({
      userId,
      isRead: false,
      isArchived: { $ne: true },
    }),
  ]);

  return {
    ordersCount: profile?.stats?.totalOrders ?? 0,
    wishlistCount: profile?.stats?.totalWishlistItems ?? 0,
    addressesCount: user?.addresses?.length || 0,
    notificationsCount,
    loyaltyTier: profile?.loyaltyTier ?? "bronze",
    loyaltyPoints: profile?.loyaltyPoints ?? 0,
  };
}

export default async function AccountLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  // Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/account`);
  }

  if (session.user.role === USER_ROLES.VENDOR) {
    redirect(`/${locale}/vendor/dashboard`);
  }

  // Fetch stats for sidebar
  const stats = await getAccountStats(session.user.id);

  return (
    <div className="container mx-auto px-4 py-8 [--dashboard-header-height:var(--storefront-header-height,4rem)]">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <AccountSidebar locale={locale} stats={stats} />

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          <EmailVerificationNotice
            email={session.user.email}
            status={session.user.emailVerificationStatus}
            locale={locale}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
