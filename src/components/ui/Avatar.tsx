import Image from "next/image";
import { cn } from "@/lib/cn";

const sizes = {
  xs: { box: "h-7 w-7 text-[10px]", px: 28 },
  sm: { box: "h-9 w-9 text-label-sm", px: 36 },
  md: { box: "h-11 w-11 text-label-md", px: 44 },
  lg: { box: "h-16 w-16 text-headline-sm", px: 64 },
  xl: { box: "h-24 w-24 text-headline-md", px: 96 },
  "2xl": { box: "h-32 w-32 text-headline-lg", px: 128 },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  online = false,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  /** Used for the initials fallback when there's no photo (defaults to `alt`). */
  name?: string;
  size?: keyof typeof sizes;
  online?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const { box, px } = sizes[size];
  return (
    <span className={cn("relative inline-block shrink-0 rounded-full ring-2 ring-surface", box, className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={px}
          height={px}
          priority={priority}
          className="h-full w-full rounded-full bg-surface-container object-cover"
        />
      ) : (
        <span
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
          className="flex h-full w-full select-none items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed font-bold text-primary"
        >
          {initials(name ?? alt)}
        </span>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-surface" aria-label="Online" />
      )}
    </span>
  );
}
