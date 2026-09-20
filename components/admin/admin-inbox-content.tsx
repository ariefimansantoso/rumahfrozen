"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
} from "date-fns";
import {
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  Phone,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { cn } from "@/lib/utils";
import type { SupportConversationDTO } from "@/lib/support-messages";

interface AdminInboxContentProps {
  initialConversations: SupportConversationDTO[];
  initialSelectedConversationId?: string;
}

type ConversationFilter = "all" | "open" | "replied";

const CONVERSATION_BATCH_SIZE = 4;
const INITIAL_CONVERSATION_RENDER_COUNT = CONVERSATION_BATCH_SIZE * 2;
const MESSAGE_BATCH_SIZE = 15;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getTimeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}

function getMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "h:mm a");
}

function getDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function isGuestSender(sender: SupportConversationDTO["sender"]) {
  return (
    sender.type === "guest" ||
    sender.status?.toLowerCase() === "guest" ||
    !sender.userId
  );
}

function getSenderVisual(sender: SupportConversationDTO["sender"]) {
  if (isGuestSender(sender)) {
    return {
      icon: Mail,
      label: "Guest",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    icon: UserRound,
    label: "Customer",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function getSenderStatus(sender: SupportConversationDTO["sender"]) {
  if (isGuestSender(sender)) return null;
  return sender.status?.trim() || null;
}

function sortConversations(conversations: SupportConversationDTO[]) {
  return [...conversations].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

function isNearBottom(element: HTMLElement, offset = 48) {
  return (
    element.scrollTop + element.clientHeight >= element.scrollHeight - offset
  );
}

function isNearTop(element: HTMLElement, offset = 48) {
  return element.scrollTop <= offset;
}

export function AdminInboxContent({
  initialConversations,
  initialSelectedConversationId,
}: AdminInboxContentProps) {
  const [conversations, setConversations] = useState(
    sortConversations(initialConversations),
  );
  const [selectedId, setSelectedId] = useState(
    initialSelectedConversationId || initialConversations[0]?._id,
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [visibleConversationCount, setVisibleConversationCount] = useState(
    INITIAL_CONVERSATION_RENDER_COUNT,
  );
  const [visibleMessageCount, setVisibleMessageCount] =
    useState(MESSAGE_BATCH_SIZE);
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation._id === selectedId) ||
      conversations[0],
    [conversations, selectedId],
  );
  const openCount = conversations.filter(
    (conversation) => conversation.status === "open",
  ).length;
  const repliedCount = conversations.filter(
    (conversation) => conversation.status === "replied",
  ).length;

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === "open" && conversation.status !== "open") return false;
      if (filter === "replied" && conversation.status !== "replied")
        return false;
      if (!query) return true;
      return [
        conversation.sender.name,
        conversation.sender.email,
        conversation.subject,
        conversation.lastMessagePreview,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query));
    });
  }, [conversations, filter, search]);

  const visibleConversations = filteredConversations.slice(
    0,
    visibleConversationCount,
  );
  const visibleMessages =
    selectedConversation?.messages.slice(-visibleMessageCount) ?? [];

  const filterTabs: Array<{ key: ConversationFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: conversations.length },
    { key: "open", label: "Open", count: openCount },
    { key: "replied", label: "Replied", count: repliedCount },
  ];

  useEffect(() => {
    setVisibleMessageCount(MESSAGE_BATCH_SIZE);
  }, [selectedConversation?._id]);

  useEffect(() => {
    setVisibleConversationCount(INITIAL_CONVERSATION_RENDER_COUNT);
  }, [search, filter]);

  const loadMoreConversations = () => {
    setVisibleConversationCount((current) =>
      Math.min(current + CONVERSATION_BATCH_SIZE, filteredConversations.length),
    );
  };

  const loadOlderMessages = () => {
    const totalMessages = selectedConversation?.messages.length || 0;
    setVisibleMessageCount((current) =>
      Math.min(current + MESSAGE_BATCH_SIZE, totalMessages),
    );
  };

  const submitReply = async () => {
    if (!selectedConversation || !reply.trim()) return;

    setIsSending(true);
    try {
      const response = await fetch(
        `/api/admin/inbox/${selectedConversation._id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: reply }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to send reply");
      }

      const nextConversation = payload.data
        ?.conversation as SupportConversationDTO;
      setConversations((current) =>
        sortConversations(
          current.map((conversation) =>
            conversation._id === nextConversation._id
              ? nextConversation
              : conversation,
          ),
        ),
      );
      setSelectedId(nextConversation._id);
      setVisibleMessageCount((current) => current + 1);
      setReply("");
      toast.success("Reply sent");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send reply",
      );
    } finally {
      setIsSending(false);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 rounded-xl border bg-card px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <p className="font-semibold">No messages yet</p>
          <p className="text-sm text-muted-foreground">
            New contact messages will appear here.
          </p>
        </div>
      </div>
    );
  }

  let lastDayLabel = "";

  return (
    <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="shrink-0 space-y-3 border-b bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Messages</p>
              <p className="text-xs text-muted-foreground">
                {conversations.length} total · {openCount} open
              </p>
            </div>
            <Badge variant="outline" className="rounded-md">
              Inbox
            </Badge>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages"
              className="h-9 pl-8"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  filter === tab.key
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] tabular-nums",
                    filter === tab.key
                      ? "bg-primary/10 text-primary"
                      : "bg-muted-foreground/10 text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={(event) => {
            if (isNearBottom(event.currentTarget)) loadMoreConversations();
          }}
        >
          {visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-4 w-4" />
              </div>
              <p className="text-sm text-muted-foreground">
                No conversations found
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {visibleConversations.map((conversation) => {
                const visual = getSenderVisual(conversation.sender);
                const SenderIcon = visual.icon;
                const senderStatus = getSenderStatus(conversation.sender);
                const isSelected =
                  selectedConversation?._id === conversation._id;
                return (
                  <button
                    key={conversation._id}
                    type="button"
                    onClick={() => setSelectedId(conversation._id)}
                    className={cn(
                      "relative block w-full px-4 py-3.5 text-left transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/[0.06] hover:bg-primary/[0.08]",
                    )}
                  >
                    {isSelected && (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
                    )}
                    <div className="flex gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={conversation.sender.image}
                            alt={conversation.sender.name}
                          />
                          <AvatarFallback className="text-xs font-semibold">
                            {getInitials(conversation.sender.name)}
                          </AvatarFallback>
                        </Avatar>
                        {conversation.status === "open" && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary"
                            title="Awaiting reply"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <p
                            className={cn(
                              "truncate text-sm",
                              isSelected ? "font-semibold" : "font-medium",
                            )}
                          >
                            {conversation.sender.name}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {getTimeAgo(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-foreground/90">
                          {conversation.subject}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {conversation.lastMessagePreview}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md capitalize",
                              visual.className,
                            )}
                          >
                            <SenderIcon className="h-3 w-3" />
                            {visual.label}
                          </Badge>
                          {conversation.status === "replied" ? (
                            <Badge
                              variant="outline"
                              className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Replied
                            </Badge>
                          ) : (
                            senderStatus && (
                              <Badge
                                variant="outline"
                                className="rounded-md capitalize text-muted-foreground"
                              >
                                {senderStatus}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {selectedConversation && (
        <section className="flex min-h-0 min-w-0 flex-col">
          <header className="shrink-0 border-b bg-card px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={selectedConversation.sender.image}
                    alt={selectedConversation.sender.name}
                  />
                  <AvatarFallback className="text-sm font-semibold">
                    {getInitials(selectedConversation.sender.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    {selectedConversation.subject}
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {selectedConversation.sender.name}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(() => {
                      const visual = getSenderVisual(
                        selectedConversation.sender,
                      );
                      const SenderIcon = visual.icon;
                      return (
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md capitalize",
                            visual.className,
                          )}
                        >
                          <SenderIcon className="h-3 w-3" />
                          {visual.label}
                        </Badge>
                      );
                    })()}
                    {selectedConversation.status === "replied" && (
                      <Badge
                        variant="outline"
                        className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Replied
                      </Badge>
                    )}
                    {getSenderStatus(selectedConversation.sender) && (
                      <Badge
                        variant="outline"
                        className="rounded-md capitalize"
                      >
                        {getSenderStatus(selectedConversation.sender)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-1.5 text-sm text-muted-foreground sm:items-end">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {selectedConversation.sender.email}
                </span>
                {selectedConversation.sender.phone && (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    {selectedConversation.sender.phone}
                  </span>
                )}
              </div>
            </div>
          </header>

          <div
            className="min-h-0 flex-1 overflow-y-auto bg-muted/20"
            onScroll={(event) => {
              if (isNearTop(event.currentTarget)) loadOlderMessages();
            }}
          >
            <div className="space-y-3 p-5">
              {visibleMessageCount < selectedConversation.messages.length && (
                <div className="text-center text-xs text-muted-foreground">
                  Scroll up to load older messages
                </div>
              )}
              {visibleMessages.map((message, index) => {
                const fromAdmin = message.senderType === "admin";
                const dayLabel = getDayLabel(message.createdAt);
                const showSeparator = dayLabel !== lastDayLabel;
                lastDayLabel = dayLabel;
                const previous = visibleMessages[index - 1];
                const showMeta =
                  showSeparator ||
                  !previous ||
                  previous.senderType !== message.senderType;
                return (
                  <Fragment
                    key={
                      message._id ||
                      `${message.senderName}-${message.createdAt}`
                    }
                  >
                    {showSeparator && (
                      <div className="flex items-center justify-center py-2">
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                          {dayLabel}
                        </span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex gap-3",
                        fromAdmin && "flex-row-reverse",
                        !showMeta && "mt-1",
                      )}
                    >
                      {showMeta ? (
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage
                            src={message.senderImage}
                            alt={message.senderName}
                          />
                          <AvatarFallback className="text-xs font-semibold">
                            {getInitials(message.senderName)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-9 shrink-0" aria-hidden="true" />
                      )}
                      <div
                        className={cn(
                          "flex max-w-[min(680px,85%)] flex-col gap-1",
                          fromAdmin && "items-end",
                        )}
                      >
                        {showMeta && (
                          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {message.senderName}
                            </span>
                            <span>{getMessageTime(message.createdAt)}</span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                            fromAdmin
                              ? "rounded-2xl rounded-tr-md bg-primary text-primary-foreground"
                              : "rounded-2xl rounded-tl-md border border-border/70 bg-card text-foreground",
                          )}
                        >
                          <p className="whitespace-pre-wrap">{message.body}</p>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 border-t bg-card p-4">
            <div className="flex flex-col gap-2 rounded-2xl border bg-background p-2 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
              <Textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Write a reply..."
                maxLength={4000}
                rows={1}
                className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                    void submitReply();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-[11px] text-muted-foreground">
                  Press{" "}
                  <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[10px]">
                    ⌘
                  </kbd>{" "}
                  +{" "}
                  <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[10px]">
                    Enter
                  </kbd>{" "}
                  to send
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-2 rounded-full px-4"
                  title="Send reply"
                  onClick={() => void submitReply()}
                  disabled={isSending || !reply.trim()}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
