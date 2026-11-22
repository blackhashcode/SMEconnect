import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's default scale. Without registering the
 * custom tokens from tailwind.config.ts, a class like `text-label-md` is read
 * as a text *colour* and silently removes `text-on-primary` (and vice versa),
 * and `p-space-md` / `p-space-lg` never de-duplicate. Keep these lists in sync
 * with the theme.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "numeric-stat",
        "body-lg",
        "body-md",
        "body-sm",
        "headline-xl",
        "headline-lg",
        "headline-md",
        "headline-sm",
        "label-md",
        "label-sm",
      ],
      spacing: [
        "gutter",
        "gutter-desktop",
        "margin",
        "margin-tablet",
        "margin-desktop",
        "space-xs",
        "space-sm",
        "space-md",
        "space-lg",
        "space-xl",
      ],
      shadow: ["header", "card", "card-hover", "cta", "cta-hover"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
