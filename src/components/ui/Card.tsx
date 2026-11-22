import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn("rounded-2xl border border-surface-container-high/70 bg-surface-container-lowest card-shadow", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-space-md", className)}>
      <div>
        {eyebrow && <p className="mb-space-xs text-label-sm font-bold uppercase tracking-wider text-primary">{eyebrow}</p>}
        <h2 className="text-headline-lg text-on-surface">{title}</h2>
        {description && <p className="mt-space-sm max-w-2xl text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  );
}
