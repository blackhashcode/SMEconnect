"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, LoaderCircle } from "lucide-react";
import { ICONS, TONES, notificationGroup, notificationHref } from "@/components/domain/NotificationItem";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/data/types";
import { useNotifications } from "@/components/notifications/NotificationsProvider";

/** Bell with a live count; opens a dropdown tray of the latest notifications. */
export function NotificationBell() {
  const { unread, items, loaded, refresh, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);

  // Close on navigation, outside click and Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void refresh();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
          open || pathname.startsWith("/notifications") ? "bg-primary-fixed text-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary",
        )}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold leading-none text-on-secondary ring-2 ring-surface">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-2 top-[68px] z-[60] animate-tray-in overflow-hidden rounded-2xl border border-surface-container-high bg-surface-container-lowest shadow-card-hover sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-surface-container-high px-space-md py-space-sm">
            <p className="text-label-md font-bold text-on-surface">Notifications</p>
            <button type="button" onClick={() => void markAllRead()} disabled={unread === 0} className="flex items-center gap-1 rounded-lg px-2 py-1 text-label-sm font-semibold text-primary hover:bg-primary-fixed disabled:text-outline disabled:hover:bg-transparent">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!loaded ? (
              <div className="flex justify-center py-space-lg"><LoaderCircle className="h-5 w-5 animate-spin text-outline" aria-hidden /></div>
            ) : items.length === 0 ? (
              <p className="px-space-md py-space-lg text-center text-body-sm text-on-surface-variant">You&apos;re all caught up.</p>
            ) : (
              <ul className="divide-y divide-surface-container-high">
                {items.map((n) => <TrayItem key={n.id} n={n} onOpen={markRead} />)}
              </ul>
            )}
          </div>
          <Link href="/notifications" className="block border-t border-surface-container-high px-space-md py-space-sm text-center text-label-md font-semibold text-primary hover:bg-surface-container-low">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

function TrayItem({ n, onOpen }: { n: AppNotification; onOpen: (id: string) => Promise<void> }) {
  const router = useRouter();
  const group = notificationGroup(n.type);
  const Icon = ICONS[group] ?? Bell;
  const href = notificationHref(n);
  const unread = n.readAt === null;
  const connectionId = (n.data as { connectionId?: string } | null)?.connectionId;
  const [state, setState] = useState<"idle" | "busy" | "accepted" | "declined">("idle");

  async function respond(action: "accept" | "decline") {
    if (!connectionId) return;
    setState("busy");
    const result = await api.post(`/connections/${connectionId}/${action}`);
    setState(result.ok ? (action === "accept" ? "accepted" : "declined") : "idle");
    void onOpen(n.id);
    router.refresh();
  }

  return (
    <li className={cn("flex gap-space-sm px-space-md py-space-sm transition-colors hover:bg-surface-container-low", unread && "bg-primary-fixed/30")}>
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONES[group])}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => {
            void onOpen(n.id);
            if (href) router.push(href);
          }}
        >
          <span className="flex items-start gap-2">
            <span className="flex-1 text-label-md font-bold text-on-surface">{n.title}</span>
            {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" aria-label="Unread" />}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-body-sm text-on-surface-variant">{n.body}</span>
          <TimeAgo iso={n.createdAt} className="mt-0.5 block text-label-sm text-outline" />
        </button>
        {n.type === "CONNECTION_REQUEST" && connectionId && (
          <div className="mt-space-sm flex gap-space-sm">
            {state === "accepted" ? (
              <span className="text-label-sm font-semibold text-success">Connected</span>
            ) : state === "declined" ? (
              <span className="text-label-sm text-outline">Declined</span>
            ) : (
              <>
                <button type="button" disabled={state === "busy"} onClick={() => void respond("accept")} className="rounded-full bg-primary px-3 py-1 text-label-sm font-semibold text-on-primary disabled:opacity-60">Accept</button>
                <button type="button" disabled={state === "busy"} onClick={() => void respond("decline")} className="rounded-full px-3 py-1 text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60">Decline</button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
