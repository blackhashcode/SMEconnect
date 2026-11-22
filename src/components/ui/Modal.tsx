"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-space-md">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-surface-container-lowest shadow-card-hover animate-fade-in",
          size === "lg" ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-space-md border-b border-surface-container-high bg-surface-container-lowest/95 px-space-lg py-space-md backdrop-blur">
          <div>
            <h2 className="text-headline-md text-on-surface">{title}</h2>
            {description && <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-space-lg py-space-lg">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-surface-container-high bg-surface-container-lowest/95 px-space-lg py-space-md backdrop-blur">{footer}</div>}
      </div>
    </div>
  );
}
