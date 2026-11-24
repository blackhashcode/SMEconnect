"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { NotificationItem, notificationGroup, type NotificationGroup } from "./NotificationItem";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import type { AppNotification } from "@/data/types";

type TabId = "all" | NotificationGroup;

export function NotificationCenter({ notifications: initial }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const shared = useNotifications();
  const [active, setActive] = useState<TabId>("all");
  const [notifications, setNotifications] = useState(initial);

  const unread = notifications.filter((item) => item.readAt === null).length;
  const filtered = active === "all" ? notifications : notifications.filter((item) => notificationGroup(item.type) === active);
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "all", label: "All activity", count: unread || undefined },
    { id: "offer", label: "Offers" },
    { id: "repayment", label: "Repayments" },
    { id: "message", label: "Messages" },
    { id: "network", label: "Network" },
    { id: "account", label: "Account" },
  ];

  const stamp = new Date().toISOString();
  async function markAllRead() {
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? stamp })));
    await shared.markAllRead();
    router.refresh();
  }

  async function markRead(id: string) {
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? stamp } : item)));
    await shared.markRead(id);
  }

  return (
    <div>
      <div className="mb-space-md">
        <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Notifications</p>
        <h1 className="mt-1 text-headline-lg text-on-surface">Your activity</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">{unread ? `${unread} unread updates on offers, repayments and messages.` : "You're all caught up."}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Tabs items={tabs} active={active} onChange={setActive} className="max-w-full flex-1" />
        <Button variant="soft" size="sm" onClick={markAllRead} disabled={unread === 0}>
          <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
        </Button>
      </div>
      <div className="stagger mt-space-md space-y-space-sm">
        {filtered.length ? (
          filtered.map((notification) => <NotificationItem key={notification.id} notification={notification} onOpen={markRead} />)
        ) : (
          <EmptyState icon={Bell} title="Nothing here yet" description="Updates about your offers, repayments and messages will show up here." />
        )}
      </div>
    </div>
  );
}
