"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BadgeCheck, ChevronDown, Compass, LayoutDashboard, LoaderCircle, LogOut, UserRound, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useLogout } from "@/components/auth/useLogout";
import { profileHref } from "@/lib/profile";
import { hubFor } from "@/data/nav";
import type { SessionUser } from "@/data/types";
import { cn } from "@/lib/cn";

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { logout, pending } = useLogout();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hub = hubFor(user.role);
  const items = [
    ...(user.role === "admin"
      ? []
      : [
          { label: "View my profile", href: profileHref(user), icon: UserRound },
          { label: "Profile & verification", href: "/onboarding", icon: BadgeCheck },
          { label: "My network", href: "/connections", icon: UsersRound },
        ]),
    { label: hub.label, href: hub.href, icon: LayoutDashboard },
    // Admins manage members from the admin members list; everyone else browses Explore.
    user.role === "admin" ? { label: "Members", href: "/admin/users", icon: UsersRound } : { label: "Explore members", href: "/explore", icon: Compass },
  ];

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar src={user.avatar} alt="" name={user.name} size="sm" priority />
        <ChevronDown className={cn("hidden h-4 w-4 text-outline transition-transform duration-200 sm:block", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-surface-container-high bg-surface-container-lowest shadow-card-hover"
        >
          <div className="flex items-center gap-space-sm border-b border-surface-container-high p-space-md">
            <Avatar src={user.avatar} alt="" name={user.name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-label-md font-bold text-on-surface">{user.name}</p>
              <p className="truncate text-body-sm text-outline">{user.email}</p>
              <p className="mt-0.5 text-label-sm font-semibold capitalize text-primary">{user.role === "business" ? "Business owner" : user.role}</p>
            </div>
          </div>
          <div className="p-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="flex items-center gap-space-sm rounded-xl px-space-sm py-2.5 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
              >
                <item.icon className="h-4 w-4" aria-hidden /> {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-surface-container-high p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={pending}
              className="flex w-full items-center gap-space-sm rounded-xl px-space-sm py-2.5 text-body-sm font-semibold text-error transition-colors hover:bg-error-container disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
              {pending ? "Logging out…" : "Log out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
