import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

/** Scrollable table shell used across the admin panel. */
export function AdminTable({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface-container-lowest card-shadow">
      <table className="w-full min-w-[640px] text-left text-body-sm">
        <thead className="border-b border-surface-container-high text-label-sm uppercase tracking-wide text-outline">
          <tr>{head.map((label) => <th key={label} scope="col" className="px-space-md py-3 font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-surface-container-high">
          {empty ? (
            <tr><td colSpan={head.length} className="px-space-md py-space-xl text-center text-on-surface-variant">Nothing to show.</td></tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export const Cell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cn("px-space-md py-3 align-top text-on-surface", className)}>{children}</td>
);

const TONES: Record<string, "success" | "warning" | "error" | "neutral" | "primary" | "secondary"> = {
  ACTIVE: "success", APPROVED: "success", OPEN: "primary", CONFIRMED: "success", COMPLETED: "success", RESOLVED: "success",
  SUSPENDED: "error", REJECTED: "error", CANCELLED: "neutral", DEFAULTED: "error", DISMISSED: "neutral",
  PENDING: "warning", PAUSED: "warning", IN_DISCUSSION: "secondary", PENDING_AGREEMENT: "warning", DRAFT: "neutral", FUNDED: "secondary", REPAYING: "secondary",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge tone="neutral">None</Badge>;
  return <Badge tone={TONES[status] ?? "neutral"}>{status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")}</Badge>;
}

/** Filter chips that keep the other query params. */
export function FilterChips({ base, param, options, current, extra = {}, allLabel = "All" }: { base: string; param: string; options: { value: string; label: string }[]; current?: string; extra?: Record<string, string | undefined>; allLabel?: string }) {
  const href = (value: string) => {
    const search = new URLSearchParams();
    for (const [key, val] of Object.entries(extra)) if (val) search.set(key, val);
    if (value) search.set(param, value);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  return (
    <div className="flex flex-wrap gap-space-sm">
      {[{ value: "", label: allLabel }, ...options].map((option) => {
        const active = (current ?? "") === option.value;
        return (
          <Link key={option.value || "all"} href={href(option.value)} aria-current={active ? "true" : undefined} className={cn("rounded-full border px-space-md py-1.5 text-label-md transition-colors", active ? "border-primary bg-primary-fixed font-bold text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary")}>
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/** "Next page" link for cursor pagination. */
export function NextPage({ base, cursor, params = {} }: { base: string; cursor: string | null; params?: Record<string, string | undefined> }) {
  if (!cursor) return null;
  const search = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) if (val) search.set(key, val);
  search.set("cursor", cursor);
  return (
    <div className="flex justify-end">
      <Link href={`${base}?${search}`} className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
        Next page <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

/** "12 Mar 2026, 14:05" in Bangladesh time. */
export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
}
