"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { ICONS, TONES, notificationGroup, notificationHref } from "@/components/domain/NotificationItem";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/data/types";
import { useNotifications } from "@/components/notifications/NotificationsProvider";

const VISIBLE_MS = 6500;

/** Pop-ups for newly arrived notifications, bottom-left like other social apps. */
export function NotificationToaster() {
  const { toasts, dismissToast, markRead } = useNotifications();
  if (!toasts.length) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-20 left-3 right-3 z-[70] flex flex-col gap-space-sm sm:right-auto sm:w-[360px] lg:bottom-6 lg:left-6">
      {toasts.map((n) => <Toast key={n.id} n={n} onClose={() => dismissToast(n.id)} onOpen={() => void markRead(n.id)} />)}
    </div>
  );
}

function Toast({ n, onClose, onOpen }: { n: AppNotification; onClose: () => void; onOpen: () => void }) {
  const router = useRouter();
  const group = notificationGroup(n.type);
  const Icon = ICONS[group] ?? Bell;
  const href = notificationHref(n);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(VISIBLE_MS);
  const started = useRef(Date.now());

  // Auto-dismiss, pausing while hovered so it can be read.
  useEffect(() => {
    if (paused) return;
    started.current = Date.now();
    const timer = window.setTimeout(onClose, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started.current));
    };
  }, [paused, onClose]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex animate-toast-in items-start gap-space-sm rounded-2xl border border-surface-container-high bg-surface-container-lowest p-space-sm pr-2 shadow-card-hover"
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-space-sm text-left"
        onClick={() => {
          onOpen();
          if (href) router.push(href);
        }}
      >
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TONES[group])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-label-md font-bold text-on-surface">{n.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-body-sm text-on-surface-variant">{n.body}</span>
        </span>
      </button>
      <button type="button" aria-label="Dismiss" onClick={onClose} className="rounded-full p-1 text-outline hover:bg-surface-container-high hover:text-on-surface">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
