"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FilterBar } from "./FilterBar";
import { MessageThread } from "./MessageThread";
import { chatThreads } from "@/data/messages";
import { personById } from "@/data/users";
import { businessById } from "@/data/businesses";
import { cn } from "@/lib/cn";

export function MessagesWorkspace() {
  const [activeId, setActiveId] = useState(chatThreads[0].id);
  const active = chatThreads.find((thread) => thread.id === activeId) ?? chatThreads[0];

  return (
    <div>
      <div className="mb-space-md flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Messages</p>
          <h1 className="mt-1 text-headline-lg text-on-surface">Direct conversations with verified members</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Discuss terms, request records and move from offer to agreement in one thread.</p>
        </div>
        <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Identity verified</Badge>
      </div>

      <FilterBar placeholder="Search conversations…" />

      <div className="mt-space-md grid gap-space-md lg:grid-cols-[320px_1fr]">
        <aside className="order-2 overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow lg:order-1">
          <div className="flex items-center justify-between border-b border-surface-container-high px-space-md py-space-sm">
            <p className="text-label-md font-bold text-on-surface">Inbox</p>
            <span className="rounded-full bg-secondary-fixed px-2 py-0.5 text-label-sm font-bold text-secondary">2 unread</span>
          </div>
          <div className="no-scrollbar max-h-[640px] overflow-y-auto">
            {chatThreads.map((thread) => {
              const person = personById(thread.personId);
              const business = thread.businessId ? businessById(thread.businessId) : undefined;
              if (!person) return null;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveId(thread.id)}
                  className={cn(
                    "flex w-full items-start gap-space-sm border-b border-surface-container-high/70 p-space-md text-left transition-colors hover:bg-surface-container-low",
                    activeId === thread.id && "bg-surface-container-low ring-1 ring-inset ring-primary/20",
                  )}
                >
                  <Avatar src={person.avatar} alt={person.name} size="sm" online={thread.online} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-label-md font-bold text-on-surface">{person.name}</span>
                      <span className="shrink-0 text-[10px] text-outline">{thread.time}</span>
                    </span>
                    <span className="block truncate text-body-sm text-outline">{business?.name ?? thread.subject}</span>
                    <span className="mt-0.5 block truncate text-body-sm text-on-surface-variant">{thread.lastMessage}</span>
                  </span>
                  {thread.unread > 0 && <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-on-secondary">{thread.unread}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-space-sm border-t border-surface-container-high bg-surface-container-low p-space-md">
            <MessageSquareText className="h-5 w-5 text-primary" aria-hidden />
            <p className="text-body-sm text-on-surface-variant">Keep all loan discussions on SME Connect.</p>
          </div>
        </aside>

        <div className="order-1 space-y-space-sm lg:order-2">
          <div className="flex flex-wrap items-center justify-end gap-space-sm">
            {active.personId && (
              <Link href={active.personId.startsWith("nusrat") || active.personId === "tanvir" || active.personId === "farzana" ? `/businesses/${businessById(active.businessId ?? "")?.id ?? "crave-co"}` : `/investors/${active.personId}`} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
                View profile <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            <Link href="/loans/offers/new?request=lr-1" className="rounded-full bg-gradient-to-r from-secondary-container to-secondary px-space-md py-2 text-label-md font-semibold text-on-primary shadow-cta hover:shadow-cta-hover">
              Make an offer
            </Link>
          </div>
          <MessageThread thread={active} />
        </div>
      </div>
    </div>
  );
}
