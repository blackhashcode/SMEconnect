"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { api } from "@/lib/client-api";
import type { Conversation, Message } from "@/data/types";
import { cn } from "@/lib/cn";

const POLL_MS = 4000;

export function MessageThread({
  conversation,
  onChange,
}: {
  conversation: Conversation;
  onChange?: (update: Partial<Conversation> & { id: string }) => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const latestId = useRef<string | null>(null);
  const hadUnread = useRef(conversation.unreadCount > 0);
  const { participant } = conversation;
  const firstName = participant.name.split(" ")[0];

  const scrollToEnd = (smooth: boolean) =>
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? "smooth" : "auto" }));

  const markRead = useCallback(async () => {
    await api.post(`/conversations/${conversation.id}/read`);
    onChange?.({ id: conversation.id, unreadCount: 0 });
    // Refresh server components so the header's unread badge updates.
    if (hadUnread.current) {
      hadUnread.current = false;
      router.refresh();
    }
  }, [conversation.id, onChange, router]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await api.get<Message[]>(`/conversations/${conversation.id}/messages?limit=50`);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setMessages([]);
        return;
      }
      setMessages(result.data);
      latestId.current = result.data.at(-1)?.id ?? null;
      scrollToEnd(false);
      markRead();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Poll for new messages while the tab is visible.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible" || messages === null) return;
      const after = latestId.current ? `&after=${encodeURIComponent(latestId.current)}` : "";
      const result = await api.get<Message[]>(`/conversations/${conversation.id}/messages?limit=50${after}`);
      if (!result.ok || result.data.length === 0) return;
      const fresh = result.data;
      setMessages((current) => {
        const known = new Set((current ?? []).map((m) => m.id));
        return [...(current ?? []), ...fresh.filter((m) => !known.has(m.id))];
      });
      latestId.current = fresh[fresh.length - 1].id;
      onChange?.({ id: conversation.id, lastMessage: fresh[fresh.length - 1], updatedAt: fresh[fresh.length - 1].createdAt });
      scrollToEnd(true);
      if (fresh.some((m) => !m.mine)) markRead();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [conversation.id, messages, onChange, markRead]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const result = await api.post<Message>(`/conversations/${conversation.id}/messages`, { body });
    setSending(false);
    if (!result.ok) {
      setError(result.status === 429 ? "You're sending messages too quickly. Wait a moment and try again." : result.error);
      return;
    }
    const message = result.data;
    setMessages((current) => [...(current ?? []), message]);
    latestId.current = message.id;
    setDraft("");
    onChange?.({ id: conversation.id, lastMessage: message, updatedAt: message.createdAt, unreadCount: 0 });
    scrollToEnd(true);
  }

  return (
    <section className="flex h-[min(640px,calc(100dvh-14rem))] min-h-[420px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
      <header className="flex items-center justify-between gap-space-md border-b border-surface-container-high px-space-md py-space-md sm:px-space-lg">
        <div className="flex min-w-0 items-center gap-space-md">
          <Avatar src={participant.image ?? ""} alt={participant.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-headline-sm text-on-surface">{participant.name}</p>
            <p className="truncate text-body-sm text-outline">{participant.shopName ?? (participant.role === "INVESTOR" ? "Investor" : "Business owner")}</p>
          </div>
        </div>
        {participant.verified && <Badge tone="success" className="shrink-0"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified</Badge>}
      </header>

      <div ref={scroller} className="no-scrollbar flex-1 space-y-space-md overflow-y-auto bg-surface-container-low/40 px-space-md py-space-lg sm:px-space-lg" aria-live="polite">
        {messages === null && (
          <div className="flex h-full items-center justify-center text-outline">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Loading messages" />
          </div>
        )}
        {messages?.length === 0 && !error && <p className="py-space-xl text-center text-body-sm text-outline">Say hello to {firstName} to start the conversation.</p>}
        {messages?.map((message) => (
          <div key={message.id} className={cn("flex animate-fade-in", message.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-space-md py-space-sm text-body-md sm:max-w-[78%]", message.mine ? "rounded-br-sm bg-primary text-on-primary" : "rounded-bl-sm bg-surface-container-lowest text-on-surface card-shadow")}>
              <p className="whitespace-pre-line break-words">{message.body}</p>
              <TimeAgo iso={message.createdAt} mode="clock" className={cn("mt-1 block text-[10px]", message.mine ? "text-white/70" : "text-outline")} />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-surface-container-high bg-surface-container-lowest p-space-md">
        {error ? (
          <p role="alert" className="mb-space-sm rounded-full bg-error-container px-space-md py-2 text-body-sm text-on-error-container">{error}</p>
        ) : (
          <div className="mb-space-sm hidden items-center gap-2 rounded-full bg-success-container px-space-md py-2 text-body-sm text-success sm:flex">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Keep all offers and repayments on SME Connect. Never transfer funds outside the platform.
          </div>
        )}
        <form onSubmit={send} className="flex items-center gap-space-sm">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Message ${firstName}…`}
            aria-label="Message"
            maxLength={5000}
            className="min-w-0 flex-1 rounded-full bg-surface-container-low px-space-md py-2.5 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-all hover:bg-primary-container active:scale-95 disabled:opacity-50"
          >
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          </button>
        </form>
      </div>
    </section>
  );
}
