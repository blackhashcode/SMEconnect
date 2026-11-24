"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client-api";
import type { AppNotification } from "@/data/types";

/** How often to check for new notifications while the tab is visible. */
const POLL_MS = 20_000;
const TRAY_SIZE = 10;

type Ctx = {
  unread: number;
  items: AppNotification[];
  loaded: boolean;
  /** Newly arrived notifications to show as pop-ups (cleared as they're dismissed). */
  toasts: AppNotification[];
  dismissToast: (id: string) => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<Ctx | null>(null);

const noop = async () => {};
/** Used if a component renders outside the provider: shows nothing rather than crashing the page. */
const FALLBACK: Ctx = { unread: 0, items: [], loaded: true, toasts: [], dismissToast: () => {}, refresh: noop, markRead: noop, markAllRead: noop };

export function useNotifications(): Ctx {
  return useContext(NotificationsContext) ?? FALLBACK;
}

/**
 * One place that keeps the bell count, the tray list and the pop-ups in sync.
 * It checks the unread count every 20 s (only while the tab is visible) and
 * when the tab regains focus; when new notifications arrive it shows them as
 * pop-ups and refreshes the page data so other counters update too.
 */
export function NotificationsProvider({ initialUnread, children }: { initialUnread: number; children: ReactNode }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  // id -> createdAt of every notification already shown, so a notification that
  // is updated in place (a second message in the same chat) pops up again.
  const seen = useRef<Map<string, string> | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [count, latest] = await Promise.all([
        api.get<{ unread: number }>("/notifications/unread-count"),
        api.get<AppNotification[]>(`/notifications?limit=${TRAY_SIZE}`),
      ]);
      if (count.ok) setUnread(count.data.unread);
      if (!latest.ok) return;
      const list = latest.data;
      setItems(list);
      setLoaded(true);
      // The first load only records what's already there; later loads announce new ones.
      if (!seen.current) {
        seen.current = new Map(list.map((n) => [n.id, n.createdAt]));
        return;
      }
      const fresh = list.filter((n) => n.readAt === null && seen.current!.get(n.id) !== n.createdAt);
      for (const n of list) seen.current.set(n.id, n.createdAt);
      if (fresh.length) {
        setToasts((current) => [...fresh, ...current.filter((t) => !fresh.some((f) => f.id === t.id))].slice(0, 3));
        router.refresh();
      }
    } finally {
      inFlight.current = false;
    }
  }, [router]);

  useEffect(() => {
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    const stamp = new Date().toISOString();
    let changed = false;
    setItems((list) => list.map((n) => {
      if (n.id !== id || n.readAt) return n;
      changed = true;
      return { ...n, readAt: stamp };
    }));
    setToasts((list) => list.filter((n) => n.id !== id));
    if (changed) setUnread((u) => Math.max(0, u - 1));
    await api.patch(`/notifications/${id}/read`, {});
  }, []);

  const markAllRead = useCallback(async () => {
    const stamp = new Date().toISOString();
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? stamp })));
    setUnread(0);
    setToasts([]);
    await api.patch("/notifications/read-all", {});
    router.refresh();
  }, [router]);

  const dismissToast = useCallback((id: string) => setToasts((list) => list.filter((n) => n.id !== id)), []);

  const value = useMemo<Ctx>(
    () => ({ unread, items, loaded, toasts, dismissToast, refresh, markRead, markAllRead }),
    [unread, items, loaded, toasts, dismissToast, refresh, markRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
