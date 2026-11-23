"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BadgeCheck, Flag, Gauge, Landmark, MessagesSquare, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/users", label: "Members", icon: Users },
  { href: "/admin/verification", label: "Verification", icon: BadgeCheck },
  { href: "/admin/loans", label: "Loans", icon: Landmark },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/content", label: "Content", icon: MessagesSquare },
  { href: "/admin/activity", label: "Activity log", icon: Activity },
];

/** Section tabs for the admin panel; scrolls sideways on small screens. */
export function AdminNav({ openReports, pendingVerifications }: { openReports: number; pendingVerifications: number }) {
  const pathname = usePathname();
  const badges: Record<string, number> = { "/admin/reports": openReports, "/admin/verification": pendingVerifications };

  return (
    <nav aria-label="Admin sections" className="-mx-margin overflow-x-auto px-margin md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 rounded-2xl bg-surface-container-low p-1">
        {SECTIONS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          const badge = badges[href] ?? 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-space-md py-2 text-label-md font-semibold transition-colors",
                  active ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
                {badge > 0 && <span className="rounded-full bg-error px-1.5 text-[11px] font-bold leading-5 text-on-error">{badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
