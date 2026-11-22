export type NavItem = { label: string; href: string; badge?: number };

export const publicNav: NavItem[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "For businesses", href: "/#for-businesses" },
  { label: "For investors", href: "/#for-investors" },
  { label: "Trust & safety", href: "/#trust" },
];

export const appNav: NavItem[] = [
  { label: "Feed", href: "/feed", badge: 3 },
  { label: "Explore", href: "/explore" },
  { label: "Investor Hub", href: "/investor-dashboard" },
  { label: "Business Hub", href: "/business-dashboard" },
  { label: "Messages", href: "/messages" },
  { label: "Notifications", href: "/notifications", badge: 3 },
];

export const adminNav: NavItem[] = [
  { label: "Verification", href: "/admin/verification", badge: 4 },
  { label: "Feed", href: "/feed" },
  { label: "Explore", href: "/explore" },
];
