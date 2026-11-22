/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, Bell, Handshake, MessageCircle, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { personById } from "@/data/users";
import type { AppNotification } from "@/data/types";
import { cn } from "@/lib/cn";

const icons = {
  offer: Handshake,
  connection: Bell,
  message: MessageCircle,
  system: ShieldCheck,
};

const tones = {
  offer: "bg-primary-fixed text-primary",
  connection: "bg-secondary-fixed text-secondary",
  message: "bg-success-container text-success",
  system: "bg-tertiary-fixed text-tertiary",
};

export function NotificationItem({ notification }: { notification: AppNotification }) {
  const person = notification.personId ? personById(notification.personId) : undefined;
  const Icon = icons[notification.kind];

  return (
    <article className={cn("flex gap-space-md rounded-2xl p-space-lg card-shadow transition-colors", notification.unread ? "bg-surface-container-lowest ring-1 ring-primary/20" : "bg-surface-container-lowest")}>
      {person ? (
        <Avatar src={person.avatar} alt={person.name} size="md" />
      ) : (
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tones[notification.kind])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-label-md font-bold text-on-surface">{notification.title}</p>
          {notification.unread && <span className="h-2 w-2 rounded-full bg-secondary" aria-label="Unread" />}
        </div>
        <p className="mt-1 text-body-md text-on-surface-variant">{notification.body}</p>
        <div className="mt-space-sm flex flex-wrap items-center gap-space-md">
          <span className="text-body-sm text-outline">{notification.time}</span>
          {notification.href && notification.actionLabel && (
            <Link href={notification.href} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
              {notification.actionLabel} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
