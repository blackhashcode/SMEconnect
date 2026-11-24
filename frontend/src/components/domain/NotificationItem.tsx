"use client";

import Link from "next/link";
import { ArrowUpRight, Bell, Handshake, MessageCircle, ReceiptText, ShieldCheck, UserPlus } from "lucide-react";
import { TimeAgo } from "@/components/ui/TimeAgo";
import type { AppNotification } from "@/data/types";
import { cn } from "@/lib/cn";

export type NotificationGroup = "offer" | "repayment" | "message" | "network" | "account";

export function notificationGroup(type: AppNotification["type"]): NotificationGroup {
  if (type.startsWith("OFFER_") || type === "AGREEMENT_CONFIRMED") return "offer";
  if (type.startsWith("REPAYMENT_")) return "repayment";
  if (type === "MESSAGE_RECEIVED") return "message";
  if (type === "VERIFICATION_RESULT" || (type as string) === "ADMIN_NOTICE") return "account";
  if (type === "CONNECTION_REQUEST" || type === "CONNECTION_ACCEPTED") return "network";
  return "network";
}

export const ICONS = { offer: Handshake, repayment: ReceiptText, message: MessageCircle, network: UserPlus, account: ShieldCheck };
export const TONES = {
  offer: "bg-primary-fixed text-primary",
  repayment: "bg-success-container text-success",
  message: "bg-secondary-fixed text-secondary",
  network: "bg-tertiary-fixed text-tertiary",
  account: "bg-surface-container-high text-on-surface-variant",
};

/**
 * The backend writes links in its own vocabulary (e.g. /repayments/:id); map
 * them to the page that shows that thing in this app.
 */
export function notificationHref(n: AppNotification): string | null {
  const data = (n.data ?? {}) as { loanId?: string; offerId?: string; conversationId?: string };
  const link = n.link ?? "";
  const id = link.split("/")[2];
  if (link.startsWith("/offers/") && id && !["received", "submitted"].includes(id)) return `/offers/${id}`;
  if (link.startsWith("/offers")) return "/investor-dashboard";
  if (link.startsWith("/loans/") && id) return `/loans/${id}`;
  if ((link.startsWith("/repayments") || link.startsWith("/agreements")) && data.loanId) return `/loans/${data.loanId}`;
  if (link.startsWith("/conversations/") && id) return `/messages?conversation=${id}`;
  if (link.startsWith("/verification")) return "/onboarding";
  if (link.startsWith("/connections")) return "/connections";
  if (link.startsWith("/posts")) return "/feed";
  if (link.startsWith("/business-dashboard")) return "/business-dashboard";
  return null;
}

export function NotificationItem({ notification, onOpen }: { notification: AppNotification; onOpen?: (id: string) => void }) {
  const group = notificationGroup(notification.type);
  const Icon = ICONS[group] ?? Bell;
  const href = notificationHref(notification);
  const unread = notification.readAt === null;

  return (
    <article className={cn("flex gap-space-md rounded-2xl bg-surface-container-lowest p-space-lg card-shadow transition-colors", unread && "ring-1 ring-primary/20")}>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", TONES[group])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-label-md font-bold text-on-surface">{notification.title}</p>
          {unread && <span className="h-2 w-2 rounded-full bg-secondary" aria-label="Unread" />}
        </div>
        <p className="mt-1 text-body-md text-on-surface-variant">{notification.body}</p>
        <div className="mt-space-sm flex flex-wrap items-center gap-space-md">
          <TimeAgo iso={notification.createdAt} className="text-body-sm text-outline" />
          {href && (
            <Link href={href} onClick={() => onOpen?.(notification.id)} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
              Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
