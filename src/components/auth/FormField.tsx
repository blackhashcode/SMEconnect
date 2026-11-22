"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled input with inline error text, wired up for screen readers. */
export function FormField({ label, error, hint, className, type = "text", ...props }: FieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-label-md font-semibold text-on-surface">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full rounded-xl border bg-surface-container-lowest px-space-md text-body-md text-on-surface transition-[border-color,box-shadow] duration-200 placeholder:text-outline focus:outline-none focus:ring-4",
            error
              ? "border-error focus:border-error focus:ring-error/15"
              : "border-outline-variant hover:border-outline focus:border-primary focus:ring-primary/15",
            isPassword && "pr-12",
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((value) => !value)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            {reveal ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 animate-fade-in text-body-sm font-medium text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-body-sm text-outline">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: React.ReactNode }) {
  const tones = {
    error: "bg-error-container text-on-error-container",
    success: "bg-success-container text-success",
    info: "bg-primary-fixed text-on-primary-fixed-variant",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("animate-fade-in rounded-xl px-space-md py-3 text-body-sm font-medium", tones[tone])}>
      {children}
    </div>
  );
}

export { postJson, type FieldErrors } from "@/lib/client-api";
