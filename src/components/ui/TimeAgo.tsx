"use client";

import { useEffect, useState } from "react";
import { clockTime, timeAgo } from "@/lib/format";

/**
 * Relative time ("5 min ago") that keeps itself current. The server and the
 * browser may disagree by a few seconds, so hydration warnings are suppressed.
 */
export function TimeAgo({ iso, mode = "relative", className }: { iso: string; mode?: "relative" | "clock"; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (mode !== "relative") return;
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const date = new Date(iso);
  return (
    <time dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()} title={Number.isNaN(date.getTime()) ? undefined : date.toLocaleString("en-GB")} className={className} suppressHydrationWarning>
      {mode === "clock" ? clockTime(iso) : timeAgo(iso)}
    </time>
  );
}
