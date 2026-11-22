import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * A responsive image that fills a sized box. The wrapper reserves the space
 * (no layout shift) and shows a soft placeholder while the optimised image
 * loads lazily. Size the box with `className` (e.g. "h-40 rounded-xl").
 */
export function Photo({
  src,
  alt,
  className,
  imgClassName,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
  zoomOnHover = false,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  /** Scales the image when an ancestor with the `group` class is hovered. */
  zoomOnHover?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-container", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn(
            "object-cover",
            zoomOnHover && "transition-transform duration-700 ease-out-expo group-hover:scale-105",
            imgClassName,
          )}
        />
      ) : (
        // No photo uploaded yet: a neutral brand gradient rather than a stock face.
        <div
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          className="absolute inset-0 bg-gradient-to-br from-primary-fixed via-surface-container-high to-secondary-fixed"
        />
      )}
      {children}
    </div>
  );
}
