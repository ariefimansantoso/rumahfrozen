import { Inbox } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { listCustomerSupportConversations } from "@/lib/support-messages";
import { CustomerInboxContent } from "@/components/account/customer-inbox-content";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CustomerInboxPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/${locale}/login?callbackUrl=/${locale}/account/inbox`);

  const conversations = await listCustomerSupportConversations(session.user.id);
  const selectedConversationId =
    typeof search.conversation === "string" ? search.conversation : undefined;

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-130 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2.5">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Continue your support conversations with the admin team.
          </p>
        </div>
      </div>

      <CustomerInboxContent
        locale={locale}
        initialConversations={conversations}
        initialSelectedConversationId={selectedConversationId}
      />
    </div>
  );
}
