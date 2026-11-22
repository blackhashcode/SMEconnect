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
    <footer className="mt-space-xl w-full bg-surface-container-low shadow-[0_-1px_6px_rgba(0,0,0,0.02)]">
      <div className="mx-auto w-full max-w-shell px-gutter-desktop py-space-xl">
        <div className="flex flex-col gap-space-lg border-b border-outline-variant/60 pb-space-lg md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-space-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-primary">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-label-md font-semibold text-on-surface">Bangladesh SME Community Trust Network</p>
              <p className="mt-1 max-w-md text-body-sm text-on-surface-variant">
                NID and trade licence checks, transparent offer terms and repayment progress you can follow.
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-space-lg gap-y-space-sm" aria-label="Footer navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-label-md text-on-surface-variant hover:text-primary">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-space-sm pt-space-md text-body-sm text-outline sm:flex-row sm:items-center sm:justify-between">
          <p>© 2025 SME Connect Bangladesh. Built for verified business connections.</p>
          <div className="flex items-center gap-space-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            <span>Operational across 64 districts</span>
          </div>
        </div>
        {publicPage && <div className="mt-space-md"><BrandLogo /></div>}
      </div>
    </footer>
  );
}
