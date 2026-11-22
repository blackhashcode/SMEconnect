"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, type FormEvent } from "react";
import { Landmark, Paperclip, Send, ShieldCheck, Smile } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { messagesForThread } from "@/data/messages";
import { personById } from "@/data/users";
import type { ChatThread, ChatMessage } from "@/data/types";
import { cn } from "@/lib/cn";

export function MessageThread({ thread, currentUserId = "rafiq" }: { thread: ChatThread; currentUserId?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(messagesForThread(thread.id));
  const [draft, setDraft] = useState("");
  const person = personById(thread.personId);

  function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, threadId: thread.id, senderId: currentUserId, text, time: "Now" },
    ]);
    setDraft("");
  }

  if (!person) return null;

  return (
    <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
      <header className="flex items-center justify-between gap-space-md border-b border-surface-container-high px-space-lg py-space-md">
        <div className="flex items-center gap-space-md">
          <Avatar src={person.avatar} alt={person.name} size="md" online={thread.online} />
          <div>
            <p className="text-headline-sm text-on-surface">{person.name}</p>
            <p className="text-body-sm text-outline">{thread.subject}</p>
          </div>
        </div>
        <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified</Badge>
      </header>

      <div className="no-scrollbar flex-1 space-y-space-md overflow-y-auto bg-surface-container-low/40 px-space-lg py-space-lg">
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-2xl px-space-md py-space-sm text-body-md", mine ? "rounded-br-sm bg-primary text-on-primary" : "rounded-bl-sm bg-surface-container-lowest text-on-surface card-shadow")}>
                {message.kind === "offer" && (
                  <div className={cn("mb-space-sm flex items-center gap-1.5 text-label-sm font-bold", mine ? "text-white/80" : "text-primary")}>
                    <Landmark className="h-4 w-4" aria-hidden /> Loan offer drafted · Ready to send
                  </div>
                )}
                <p>{message.text}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-outline")}>{message.time}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-surface-container-high bg-surface-container-lowest p-space-md">
        <div className="mb-space-sm flex items-center gap-2 rounded-full bg-success-container px-space-md py-2 text-body-sm text-success">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Keep all offers and repayments on SME Connect. Never transfer funds outside the platform.
        </div>
        <form onSubmit={send} className="flex items-center gap-space-sm">
          <button type="button" aria-label="Attach file" className="rounded-full p-2 text-outline hover:bg-surface-container-high">
            <Paperclip className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Add emoji" className="rounded-full p-2 text-outline hover:bg-surface-container-high">
            <Smile className="h-5 w-5" />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message…"
            aria-label="Message"
            className="min-w-0 flex-1 rounded-full bg-surface-container-low px-space-md py-2.5 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" aria-label="Send message" className="rounded-full bg-primary p-3 text-on-primary hover:bg-primary-container">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
