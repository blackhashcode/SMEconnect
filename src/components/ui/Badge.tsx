import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "primary" | "secondary" | "success" | "warning" | "error";
}) {
  const tones = {
    neutral: "bg-surface-container-high text-on-surface-variant",
    primary: "bg-primary-fixed text-on-primary-fixed-variant",
    secondary: "bg-secondary-fixed text-on-secondary-container",
    success: "bg-success-container text-success",
    warning: "bg-tertiary-fixed text-on-tertiary-fixed",
    error: "bg-error-container text-on-error-container",
  };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-sm font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function VerifiedBadge({ label = "Verified", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <Badge tone="success" className="gap-1">
      <BadgeCheck className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      {label}
    </Badge>
  );
}
