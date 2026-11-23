export type NavItem = { label: string; href: string; badge?: number };

export const publicNav: NavItem[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "For businesses", href: "/#for-businesses" },
  { label: "For investors", href: "/#for-investors" },
  { label: "Trust & safety", href: "/#trust" },
];

/** Each member's own dashboard. */
export const hubFor = (role: string) =>
  role === "business"
    ? { label: "Business Hub", href: "/business-dashboard" }
    : role === "admin"
      ? { label: "Verification", href: "/admin/verification" }
      : { label: "Investor Hub", href: "/investor-dashboard" };

/** Primary sections in the desktop header pill. Messages and notifications live in the icon cluster. */
export const appNavFor = (role: string): NavItem[] => [{ label: "Feed", href: "/feed" }, { label: "Explore", href: "/explore" }, hubFor(role)];


export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
