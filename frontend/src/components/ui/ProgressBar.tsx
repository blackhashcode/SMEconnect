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
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-space-sm flex items-center justify-between gap-2">
          {label && <span className="text-body-sm font-medium text-on-surface-variant">{label}</span>}
          {showValue && <span className="ml-auto text-label-sm font-bold text-primary">{clamped}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {/* Width sets the value; the scale animation sweeps it in on first paint. */}
        <div className="h-full" style={{ width: `${clamped}%` }}>
          <div
            className={cn(
              "h-full origin-left animate-grow-x rounded-full",
              tone === "success" ? "bg-success" : "bg-gradient-to-r from-primary-container via-secondary-container to-secondary",
            )}
          />
        </div>
      </div>
    </div>
  );
}
