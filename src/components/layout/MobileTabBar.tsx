"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, House, LayoutDashboard, MessageCircle } from "lucide-react";
import { hubFor, isActivePath, unreadCounts } from "@/data/nav";
import { useSessionUser } from "@/components/auth/SessionProvider";
import { cn } from "@/lib/cn";

function tabsFor(unreadMessages: number, role: string) {
  return [
  { label: "Feed", href: "/feed", icon: House },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Hub", href: hubFor(role).href, icon: LayoutDashboard },
  { label: "Messages", href: "/messages", icon: MessageCircle, count: unreadMessages },
  { label: "Alerts", href: "/notifications", icon: Bell, count: unreadCounts.notifications },
  ];
}

/** Bottom navigation for phones and tablets, where the header pill is hidden. */
export function MobileTabBar({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  const role = useSessionUser()?.role ?? "investor";
  const tabs = tabsFor(unreadMessages, role);

  return (
    <nav
      aria-label="App navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-container-high bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors duration-200",
                  active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300",
                    active ? "bg-primary-fixed" : "bg-transparent",
                  )}
                >
                  <tab.icon className="h-5 w-5" aria-hidden />
                  {tab.count ? (
                    <span className="absolute right-2.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold leading-none text-on-secondary">
                      {tab.count}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
