import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "secondary" | "success" | "warning";
  className?: string;
}) {
  const tones = {
    primary: "bg-primary-fixed text-primary",
    secondary: "bg-secondary-fixed text-secondary",
    success: "bg-success-container text-success",
    warning: "bg-tertiary-fixed text-tertiary",
  };

  return (
    <div className={cn("flex items-start gap-space-md rounded-2xl bg-surface-container-lowest p-space-lg card-shadow", className)}>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-label-sm font-semibold text-outline">{label}</p>
        <p className="mt-0.5 text-numeric-stat text-on-surface">{value}</p>
        {hint && <p className="mt-0.5 text-body-sm text-on-surface-variant">{hint}</p>}
      </div>
    </div>
  );
}
