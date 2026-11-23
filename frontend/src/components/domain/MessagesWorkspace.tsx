"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { MessageThread } from "./MessageThread";
import { profileHref } from "@/lib/profile";
import { partyPerson } from "@/lib/backend/mappers";
import type { Conversation } from "@/data/types";
import { cn } from "@/lib/cn";

export function MessagesWorkspace({ conversations: initialThreads, initialId: initialThreadId }: { conversations: Conversation[]; initialId: string | null }) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreadId);
  const [query, setQuery] = useState("");
  // On phones the list and the conversation take turns filling the screen.
  const [showListOnMobile, setShowListOnMobile] = useState(!initialThreadId);

  useEffect(() => setThreads(initialThreads), [initialThreads]);

  const active = threads.find((thread) => thread.id === activeId) ?? null;
  const totalUnread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => `${thread.participant.name} ${thread.participant.shopName ?? ""} ${thread.lastMessage?.body ?? ""}`.toLowerCase().includes(q));
  }, [threads, query]);

  function select(id: string) {
    setActiveId(id);
    setShowListOnMobile(false);
    // Keep the URL shareable and the back button meaningful.
    router.replace(`/messages?conversation=${id}`, { scroll: false });
  }

  /** Called by the thread when it changes (sent, read), so the inbox preview stays current. */
  const onThreadChange = useCallback((update: Partial<Conversation> & { id: string }) => {
    setThreads((current) =>
      current
        .map((thread) => (thread.id === update.id ? { ...thread, ...update } : thread))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }, []);

  if (threads.length === 0) {
    return (
      <div>
        <Header totalUnread={0} />
        <EmptyState
          icon={MessageSquareText}
          title="No conversations yet"
          description="Message a business owner or investor from their profile, or make an offer to start a conversation."
          action={<LinkButton href="/explore">Find members to connect with</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <Header totalUnread={totalUnread} />

      <div className="grid gap-space-md lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow", !showListOnMobile && "hidden lg:block")}>
          <div className="border-b border-surface-container-high p-space-sm">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="w-full rounded-full bg-surface-container-low py-2 pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
          <div className="flex items-center justify-between border-b border-surface-container-high px-space-md py-space-sm">
            <p className="text-label-md font-bold text-on-surface">Inbox</p>
            {totalUnread > 0 && <span className="rounded-full bg-secondary-fixed px-2 py-0.5 text-label-sm font-bold text-secondary">{totalUnread} unread</span>}
          </div>
          <div className="no-scrollbar max-h-[600px] overflow-y-auto">
            {visible.length === 0 && <p className="p-space-md text-body-sm text-outline">No conversations match “{query}”.</p>}
            {visible.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => select(thread.id)}
                aria-current={activeId === thread.id ? "true" : undefined}
                className={cn(
                  "flex w-full items-start gap-space-sm border-b border-surface-container-high/70 p-space-md text-left transition-colors hover:bg-surface-container-low",
                  activeId === thread.id && "bg-surface-container-low shadow-[inset_3px_0_0] shadow-primary",
                )}
              >
                <Avatar src={thread.participant.image ?? ""} alt={thread.participant.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-label-md text-on-surface", thread.unreadCount > 0 ? "font-extrabold" : "font-bold")}>{thread.participant.name}</span>
                    <TimeAgo iso={thread.updatedAt} className="shrink-0 text-[10px] text-outline" />
                  </span>
                  <span className="block truncate text-body-sm text-outline">{thread.participant.shopName ?? (thread.participant.role === "INVESTOR" ? "Investor" : "Business owner")}</span>
                  <span className={cn("mt-0.5 block truncate text-body-sm", thread.unreadCount > 0 ? "font-semibold text-on-surface" : "text-on-surface-variant")}>{thread.lastMessage?.body || "No messages yet"}</span>
                </span>
                {thread.unreadCount > 0 && (
                  <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-on-secondary">{thread.unreadCount}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-space-sm border-t border-surface-container-high bg-surface-container-low p-space-md">
            <MessageSquareText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p className="text-body-sm text-on-surface-variant">Keep all loan discussions on SME Connect.</p>
          </div>
        </aside>

        <div className={cn("space-y-space-sm", showListOnMobile && "hidden lg:block")}>
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <button type="button" onClick={() => setShowListOnMobile(true)} className="inline-flex items-center gap-1 text-label-md font-semibold text-on-surface-variant hover:text-primary lg:invisible">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> All conversations
                </button>
                <div className="flex flex-wrap items-center gap-space-sm">
                  <Link href={profileHref(partyPerson(active.participant))} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
                    View profile <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>

                </div>
              </div>
              <MessageThread key={active.id} conversation={active} onChange={onThreadChange} />
            </>
          ) : (
            <EmptyState icon={MessageSquareText} title="Pick a conversation" description="Choose someone from your inbox to see your messages." />
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ totalUnread }: { totalUnread: number }) {
  return (
    <div className="mb-space-md flex flex-wrap items-end justify-between gap-space-md">
      <div>
        <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Messages</p>
        <h1 className="mt-1 text-headline-lg text-on-surface">Direct conversations with verified members</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Discuss terms, request records and move from offer to agreement in one thread.{totalUnread > 0 ? ` You have ${totalUnread} unread.` : ""}
        </p>
      </div>
      <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Identity verified</Badge>
    </div>
  );
}
