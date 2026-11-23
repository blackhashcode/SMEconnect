"use client";

import { useState } from "react";
import { Bell, CheckCheck, Handshake, LoaderCircle, MessageCircle, Settings2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { NotificationItem } from "./NotificationItem";
import { postJson } from "@/lib/client-api";
import type { AppNotification, NotificationKind } from "@/data/types";

type TabId = "all" | "offer" | "message" | "connection" | "system";

export function NotificationCenter({ initialNotifications }: { initialNotifications: AppNotification[] }) {
  const [active, setActive] = useState<TabId>("all");
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [markingAll, setMarkingAll] = useState(false);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "all", label: "All activity", count: notifications.length },
    { id: "offer", label: "Loan offers" },
    { id: "message", label: "Messages" },
    { id: "connection", label: "Connections" },
    { id: "system", label: "System" },
  ];

  const filtered = active === "all" ? notifications : notifications.filter((item) => item.kind === active);
  const unread = notifications.filter((item) => item.unread).length;

  async function markAllRead() {
    if (markingAll || unread === 0) return;
    setMarkingAll(true);
    const result = await postJson("/api/v1/notifications/read-all");
    setMarkingAll(false);
    if (result.ok) {
      setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
    }
  }

  return (
    <div className="grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <Tabs items={tabs} active={active} onChange={setActive} className="max-w-full flex-1" />
          <Button variant="soft" size="sm" onClick={markAllRead} disabled={markingAll || unread === 0}>
            {markingAll ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCheck className="h-4 w-4" aria-hidden />}
            Mark all read
          </Button>
        </div>

        <div className="mt-space-md space-y-space-sm">
          {filtered.length ? (
            filtered.map((notification) => <NotificationItem key={notification.id} notification={notification} />)
          ) : (
            <div className="rounded-2xl bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant card-shadow">
              Nothing here yet.
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-space-md">
        <div className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
          <p className="text-label-sm font-bold uppercase tracking-wider text-outline">Your activity</p>
          <p className="mt-space-sm text-numeric-stat text-on-surface">{unread} unread</p>
          <div className="mt-space-md space-y-space-sm">
            {[
              { icon: Handshake, label: "Loan offers", value: notifications.filter((n) => n.kind === "offer").length, tone: "bg-primary-fixed text-primary" },
              { icon: MessageCircle, label: "Messages", value: notifications.filter((n) => n.kind === "message").length, tone: "bg-success-container text-success" },
              { icon: UserPlus, label: "Connections", value: notifications.filter((n) => n.kind === "connection").length, tone: "bg-secondary-fixed text-secondary" },
              { icon: Bell, label: "System", value: notifications.filter((n) => n.kind === "system").length, tone: "bg-tertiary-fixed text-tertiary" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-space-sm">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${row.tone}`}><row.icon className="h-4 w-4" aria-hidden /></span>
                <span className="flex-1 text-body-sm text-on-surface-variant">{row.label}</span>
                <span className="text-label-md font-bold text-on-surface">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
          <Settings2 className="h-6 w-6" aria-hidden />
          <p className="mt-space-sm text-label-md font-bold">Live notifications</p>
          <p className="mt-1 text-body-sm text-on-primary-fixed/80">Offers, negotiations, repayments, connections and verification updates appear here automatically.</p>
        </div>
      </aside>
    </div>
  );
}

export function notificationKindLabel(kind: NotificationKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
