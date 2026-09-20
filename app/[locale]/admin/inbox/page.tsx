import { Inbox } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { listSupportConversations } from "@/lib/support-messages";
import { AdminInboxContent } from "@/components/admin/admin-inbox-content";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminInboxPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);
  const conversations = await listSupportConversations();
  const selectedConversationId =
    typeof search.conversation === "string" ? search.conversation : undefined;

  return (
    <div className="flex h-[calc(100vh-var(--dashboard-header-height)-3rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Inbox className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Support messages
            </p>
          </div>
        </div>
      </div>

      <AdminInboxContent
        initialConversations={conversations}
        initialSelectedConversationId={selectedConversationId}
      />
    </div>
  );
}
