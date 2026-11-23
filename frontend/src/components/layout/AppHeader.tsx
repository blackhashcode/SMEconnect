"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MessageCircle, Search } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useScrolled } from "./useScrolled";
import { UserMenu } from "./UserMenu";
import { appNavFor, isActivePath } from "@/data/nav";
import type { SessionUser } from "@/data/types";
import { cn } from "@/lib/cn";

export function AppHeader({ user, unreadMessages, unreadNotifications }: { user: SessionUser; unreadMessages: number; unreadNotifications: number }) {
  const pathname = usePathname();
  const scrolled = useScrolled();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b bg-surface/85 backdrop-blur-xl transition-[box-shadow,border-color,background-color] duration-300",
        scrolled ? "border-surface-container-high shadow-header" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-shell items-center gap-space-md px-margin md:px-gutter-desktop lg:h-20">
        <BrandLogo href="/feed" />

        <label className="relative ml-space-sm hidden w-56 xl:block 2xl:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-outline" aria-hidden />
          <input
            type="search"
            placeholder="Search shops and investors…"
            className="w-full rounded-full bg-surface-container-low py-2 pl-9 pr-4 text-body-sm text-on-surface transition-shadow placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Search SME Connect"
          />
        </label>

        <nav
          className="mx-auto hidden items-center gap-1 rounded-full bg-surface-container-low p-1 lg:flex"
          aria-label="App navigation"
        >
          {appNavFor(user.role).map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-full px-space-md py-2 text-label-md transition-all duration-200",
                  active
                    ? "bg-surface-container-lowest font-bold text-primary shadow-sm"
                    : "font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <HeaderIcon href="/messages" label="Messages" active={isActivePath(pathname, "/messages")} count={unreadMessages}>
            <MessageCircle className="h-5 w-5" aria-hidden />
          </HeaderIcon>
          <HeaderIcon
            href="/notifications"
            label="Notifications"
            active={isActivePath(pathname, "/notifications")}
            count={unreadNotifications}
          >
            <Bell className="h-5 w-5" aria-hidden />
          </HeaderIcon>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

function HeaderIcon({
  href,
  label,
  active,
  count,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}${count ? ` (${count} unread)` : ""}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
        active ? "bg-primary-fixed text-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary",
      )}
    >
      {children}
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold leading-none text-on-secondary ring-2 ring-surface">
          {count}
        </span>
      )}
    </Link>
  );
}
