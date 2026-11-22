"use client";

import { cn } from "@/lib/cn";

export type TabItem<T extends string = string> = { id: T; label: string; count?: number };

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-space-xs overflow-x-auto rounded-full bg-surface-container-low p-1.5", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-space-md py-2 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            active === item.id
              ? "bg-surface-container-lowest font-bold text-primary shadow-sm"
              : "font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-on-secondary">
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
