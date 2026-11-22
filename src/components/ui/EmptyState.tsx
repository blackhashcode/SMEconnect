import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/50 px-space-lg py-space-xl text-center">
      <span className="mb-space-md flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-headline-sm text-on-surface">{title}</p>
      <p className="mt-space-sm max-w-sm text-body-md text-on-surface-variant">{description}</p>
      {action && <div className="mt-space-md">{action}</div>}
    </div>
  );
}
