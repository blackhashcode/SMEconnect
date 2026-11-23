// Photos of real Bangladeshi small businesses in public/images, used for the
// site's own imagery. Member photos and covers always come from their uploads.
export const images = {
  "bakery-workers": "/images/bakery-workers.jpg",
  "courier-workers": "/images/courier-workers.jpg",
  "farmers-field": "/images/farmers-field.jpg",
  "fruit-vendor": "/images/fruit-vendor.jpg",
  "handicraft-shop": "/images/handicraft-shop.jpg",
  "machinery-stall": "/images/machinery-stall.jpg",
  "papad-maker": "/images/papad-maker.jpg",
  "shoe-stall": "/images/shoe-stall.jpg",
  "signup-business": "/images/signup-business.jpg",
  "signup-investor": "/images/signup-investor.jpg",
  "textile-fair": "/images/textile-fair.jpg",
  logo: "/images/logo.svg",
} as const;

export type ImageKey = keyof typeof images;

/** Cover shown for a business that hasn't uploaded its own, matched to its category. */
export function fallbackCover(category?: string | null): string {
  const value = (category ?? "").toLowerCase();
  if (/food|bakery|kitchen|grocer/.test(value)) return images["bakery-workers"];
  if (/fashion|cloth|textile|garment/.test(value)) return images["textile-fair"];
  if (/handicraft|craft|home|d[eé]cor/.test(value)) return images["handicraft-shop"];
  if (/gadget|electronic|machine|hardware/.test(value)) return images["machinery-stall"];
  if (/agri|farm/.test(value)) return images["farmers-field"];
  if (/shoe|footwear|leather/.test(value)) return images["shoe-stall"];
  return images["fruit-vendor"];
}
