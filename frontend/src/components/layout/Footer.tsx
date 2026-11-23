import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const links = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "For businesses", href: "/#for-businesses" },
  { label: "For investors", href: "/#for-investors" },
  { label: "Trust & safety", href: "/#trust" },
  { label: "Explore", href: "/explore" },
];

export function Footer({ publicPage = false }: { publicPage?: boolean }) {
  return (
    <footer className="w-full border-t border-surface-container-high bg-surface-container-low">
      <div className="mx-auto w-full max-w-shell px-margin py-space-xl md:px-gutter-desktop">
        {publicPage && (
          <div className="mb-space-lg">
            <BrandLogo />
          </div>
        )}
        <div className="flex flex-col gap-space-lg border-b border-outline-variant/60 pb-space-lg md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-space-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-primary">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-label-md font-semibold text-on-surface">A verified network for Bangladeshi small businesses</p>
              <p className="mt-1 max-w-md text-body-sm text-on-surface-variant">
                Identity checks by our team, written two-sided agreements and repayments both parties confirm.
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-space-lg gap-y-space-sm" aria-label="Footer navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="link-underline text-label-md text-on-surface-variant transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-space-sm pt-space-md text-body-sm text-outline sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SME Connect Bangladesh. Built for verified business connections.</p>
          <p>SME Connect doesn&apos;t hold or move money. Loans are agreed directly between members.</p>
        </div>
      </div>
    </footer>
  );
}
