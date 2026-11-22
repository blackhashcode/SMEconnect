"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MessageCircle, Search, Settings, UserRound } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { Avatar } from "@/components/ui/Avatar";
import { appNav } from "@/data/nav";
import { images } from "@/data/images";
import { cn } from "@/lib/cn";

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-surface-container-high/70 bg-surface/90 backdrop-blur-xl shadow-header">
      <div className="mx-auto flex h-20 w-full max-w-shell items-center justify-between gap-space-md px-gutter-desktop">
        <div className="flex min-w-0 items-center gap-space-lg">
          <BrandLogo />
          <label className="relative hidden xl:block w-64 2xl:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-outline" aria-hidden />
            <input
              type="search"
              placeholder="Search verified shops and investors…"
              className="w-full rounded-full bg-surface-container-low py-2 pl-9 pr-4 text-body-sm text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Search SME Connect"
            />
          </label>
        </div>

        <nav className="no-scrollbar hidden items-center gap-space-xs overflow-x-auto rounded-full bg-surface-container-low p-1.5 lg:flex" aria-label="App navigation">
          {appNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-space-md py-2 text-label-md transition-colors",
                  active
                    ? "bg-surface-container-lowest font-bold text-primary shadow-sm"
                    : "font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                {item.label}
                {item.badge && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-on-secondary">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-space-sm">
          <Link
            href="/messages"
            aria-label="Messages"
            className="relative rounded-full p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-secondary ring-2 ring-surface" />
          </Link>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative rounded-full p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-on-secondary">
              3
            </span>
          </Link>
          <Link href="/investors/rafiq" aria-label="Your profile" className="hidden sm:block">
            <Avatar src={images["rafiq-portrait"]} alt="Rafiq Ahmed" size="sm" />
          </Link>
          <Link href="/signup" aria-label="Account settings" className="hidden text-on-surface-variant hover:text-primary md:block">
            <Settings className="h-5 w-5" />
          </Link>
          <Link href="/signup" aria-label="Account" className="text-on-surface-variant hover:text-primary sm:hidden">
            <UserRound className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
