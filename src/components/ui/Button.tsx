import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "soft" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-container hover:shadow-card-hover",
  secondary:
    "bg-gradient-to-r from-secondary-container to-secondary text-on-secondary shadow-cta hover:shadow-cta-hover hover:brightness-105",
  outline:
    "border border-outline-variant bg-surface-container-lowest text-primary hover:border-primary/40 hover:bg-surface-container-low",
  ghost: "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  soft: "bg-surface-container-high text-primary hover:bg-surface-container-highest",
  success: "bg-success-container text-success hover:bg-success hover:text-white",
};

// Fixed heights keep buttons aligned when placed side by side, whatever their contents.
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-label-md",
  md: "h-11 px-5 text-label-md",
  lg: "h-12 px-7 text-body-md font-bold",
};

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold leading-none transition-all duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&>svg]:shrink-0";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
type LinkButtonProps = CommonProps & { href: string; onClick?: () => void; prefetch?: boolean };

export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant = "primary", size = "md", className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", className, href, children, onClick, prefetch }: LinkButtonProps) {
  return (
    <Link href={href} onClick={onClick} prefetch={prefetch} className={buttonClasses({ variant, size, className })}>
      {children}
    </Link>
  );
}
