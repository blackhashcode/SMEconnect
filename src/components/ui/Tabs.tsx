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
    <div
      role="tablist"
      className={cn("no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface-container-low p-1", className)}
    >
      {items.map((item) => {
        const selected = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-space-md py-2 text-label-md transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "bg-surface-container-lowest font-bold text-primary shadow-sm"
                : "font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-secondary">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
