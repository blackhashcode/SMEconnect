"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Landmark, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useSessionUser } from "@/components/auth/SessionProvider";
import { getJson, postJson } from "@/lib/client-api";
import type { MessageView, ThreadView } from "@/data/types";
import { cn } from "@/lib/cn";

const POLL_MS = 4000;

export function MessageThread({ thread, onChange }: { thread: ThreadView; onChange?: (update: Partial<ThreadView> & { id: string }) => void }) {
  const router = useRouter();
  const viewer = useSessionUser();
  const [messages, setMessages] = useState<MessageView[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const latest = useRef<string | null>(null);
  const hadUnread = useRef(thread.unread > 0);

  const scrollToEnd = (smooth: boolean) =>
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? "smooth" : "auto" }));

  const markRead = useCallback(async () => {
    await postJson(`/api/threads/${thread.id}/read`);
    onChange?.({ id: thread.id, unread: 0 });
    // Refresh server components so the header's unread badge updates.
    if (hadUnread.current) {
      hadUnread.current = false;
      router.refresh();
    }
  }, [thread.id, onChange, router]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getJson<{ messages: MessageView[] }>(`/api/threads/${thread.id}/messages`);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setMessages([]);
        return;
      }
      setMessages(result.data.messages);
      latest.current = result.data.messages.at(-1)?.createdAt ?? null;
      scrollToEnd(false);
      markRead();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  // Poll for new messages while the tab is visible.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible" || messages === null) return;
      const after = latest.current ? `?after=${encodeURIComponent(latest.current)}` : "";
      const result = await getJson<{ messages: MessageView[] }>(`/api/threads/${thread.id}/messages${after}`);
      if (!result.ok || result.data.messages.length === 0) return;
      const fresh = result.data.messages;
      setMessages((current) => {
        const known = new Set((current ?? []).map((m) => m.id));
        return [...(current ?? []), ...fresh.filter((m) => !known.has(m.id))];
      });
      const last = fresh[fresh.length - 1];
      latest.current = last.createdAt;
      onChange?.({ id: thread.id, lastMessage: last.text, lastMessageAt: last.createdAt });
      scrollToEnd(true);
      markRead();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [thread.id, messages, onChange, markRead]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const result = await postJson<{ message: MessageView }>(`/api/threads/${thread.id}/messages`, { text });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const message = result.data.message;
    setMessages((current) => [...(current ?? []), message]);
    latest.current = message.createdAt;
    setDraft("");
    onChange?.({ id: thread.id, lastMessage: message.text, lastMessageAt: message.createdAt, unread: 0 });
    scrollToEnd(true);
  }

  const { other } = thread;

  return (
    <section className="flex h-[min(640px,calc(100dvh-14rem))] min-h-[420px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
      <header className="flex items-center justify-between gap-space-md border-b border-surface-container-high px-space-md py-space-md sm:px-space-lg">
        <div className="flex min-w-0 items-center gap-space-md">
          <Avatar src={other.avatar} alt={other.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-headline-sm text-on-surface">{other.name}</p>
            <p className="truncate text-body-sm text-outline">{thread.subject}</p>
          </div>
        </div>
        {other.verified && <Badge tone="success" className="shrink-0"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified</Badge>}
      </header>

      <div ref={scroller} className="no-scrollbar flex-1 space-y-space-md overflow-y-auto bg-surface-container-low/40 px-space-md py-space-lg sm:px-space-lg" aria-live="polite">
        {messages === null && (
          <div className="flex h-full items-center justify-center text-outline">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Loading messages" />
          </div>
        )}
        {messages?.length === 0 && !error && <p className="py-space-xl text-center text-body-sm text-outline">Say hello to {other.name.split(" ")[0]} to start the conversation.</p>}
        {messages?.map((message) => {
          if (message.kind === "system") {
            return (
              <div key={message.id} className="flex animate-fade-in justify-center">
                <p className="flex max-w-[90%] items-center gap-1.5 rounded-full bg-surface-container-high px-space-md py-1.5 text-center text-body-sm text-on-surface-variant">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{message.senderId === viewer?.id ? "You" : other.name.split(" ")[0]}: {message.text}</span>
                </p>
              </div>
            );
          }
          const mine = message.senderId === viewer?.id;
          return (
            <div key={message.id} className={cn("flex animate-fade-in", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-space-md py-space-sm text-body-md sm:max-w-[78%]", mine ? "rounded-br-sm bg-primary text-on-primary" : "rounded-bl-sm bg-surface-container-lowest text-on-surface card-shadow")}>
                {message.kind === "offer" && (
                  <div className={cn("mb-space-sm flex items-center gap-1.5 text-label-sm font-bold", mine ? "text-white/80" : "text-primary")}>
                    <Landmark className="h-4 w-4" aria-hidden /> Loan offer
                    {message.offerId && (
                      <Link href={`/loans/offers/${message.offerId}/review`} className={cn("underline underline-offset-2", mine ? "text-white" : "text-primary")}>
                        Open
                      </Link>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-line break-words">{message.text}</p>
                <TimeAgo iso={message.createdAt} mode="clock" className={cn("mt-1 block text-[10px]", mine ? "text-white/70" : "text-outline")} />
              </div>
            </div>
          );
        })}
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
            placeholder={`Message ${other.name.split(" ")[0]}…`}
            aria-label="Message"
            maxLength={4000}
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
