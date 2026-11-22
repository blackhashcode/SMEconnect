/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";

const sizes = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
  "2xl": "h-32 w-32",
};

export function Avatar({
  src,
  alt,
  size = "md",
  online = false,
  className,
}: {
  src: string;
  alt: string;
  size?: keyof typeof sizes;
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      <img
        src={src}
        alt={alt}
        className={cn("rounded-full object-cover ring-2 ring-surface", sizes[size])}
      />
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-surface" aria-label="Online" />
      )}
    </span>
  );
}
