import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "soft" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-container shadow-sm",
  secondary:
    "bg-gradient-to-r from-secondary-container to-secondary text-on-primary shadow-cta hover:shadow-cta-hover",
  outline: "border border-outline-variant bg-surface-container-lowest text-primary hover:bg-surface-container-low",
  ghost: "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  soft: "bg-surface-container-high text-primary hover:bg-surface-container-highest",
  success: "bg-success-container text-success hover:bg-success/10",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-label-sm",
  md: "px-space-md py-2.5 text-label-md",
  lg: "px-space-xl py-3.5 text-label-md",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
type LinkButtonProps = CommonProps & { href: string; onClick?: () => void };

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", className, href, children, onClick }: LinkButtonProps) {
  return (
    <Link href={href} onClick={onClick} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
