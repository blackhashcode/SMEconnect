"use client";

import { useState } from "react";
import { Bell, CheckCheck, Handshake, MessageCircle, Settings2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { NotificationItem } from "./NotificationItem";
import { notifications as allNotifications } from "@/data/notifications";
import type { AppNotification, NotificationKind } from "@/data/types";

const tabs = [
  { id: "all", label: "All activity", count: allNotifications.length },
  { id: "offer", label: "Loan offers" },
  { id: "message", label: "Messages" },
  { id: "connection", label: "Connections" },
  { id: "system", label: "System" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function NotificationCenter() {
  const [active, setActive] = useState<TabId>("all");
  const [notifications, setNotifications] = useState<AppNotification[]>(allNotifications);

  const filtered = active === "all" ? notifications : notifications.filter((item) => item.kind === active);
  const unread = notifications.filter((item) => item.unread).length;

  return (
    <div className="grid gap-space-lg lg:grid-cols-[1fr_300px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <Tabs items={[...tabs]} active={active} onChange={setActive} className="max-w-full flex-1" />
          <Button variant="soft" size="sm" onClick={() => setNotifications((items) => items.map((item) => ({ ...item, unread: false })))}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
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
          <p className="mt-space-sm text-label-md font-bold">Notification settings</p>
          <p className="mt-1 text-body-sm text-on-primary-fixed/80">Choose which updates reach you by email, SMS or in-app.</p>
          <Button variant="outline" size="sm" className="mt-space-md w-full border-primary/20 bg-white/60">Manage channels</Button>
        </div>
      </aside>
    </div>
  );
}

export function notificationKindLabel(kind: NotificationKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
