import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  label,
  showValue = true,
  className,
  tone = "default",
}: {
  value: number;
  label?: string;
  showValue?: boolean;
  className?: string;
  tone?: "default" | "success";
}) {
  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-space-sm flex items-center justify-between gap-2">
          {label && <span className="text-body-sm font-medium text-on-surface-variant">{label}</span>}
          {showValue && <span className="text-label-sm font-bold text-primary">{value}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            tone === "success" ? "bg-success" : "bg-gradient-to-r from-primary-container via-secondary-container to-secondary",
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
