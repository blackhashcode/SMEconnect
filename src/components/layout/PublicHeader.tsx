import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { LinkButton } from "@/components/ui/Button";
import { publicNav } from "@/data/nav";

export function PublicHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-surface-container-high/70 bg-surface/90 backdrop-blur-xl shadow-header">
      <div className="mx-auto flex h-20 w-full max-w-shell items-center justify-between gap-space-md px-gutter-desktop">
        <BrandLogo />
        <nav className="hidden items-center gap-space-lg lg:flex" aria-label="Public navigation">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-label-md font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-space-sm">
          <LinkButton href="/feed" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Log in
          </LinkButton>
          <LinkButton href="/signup" variant="secondary" size="sm">
            Sign up
          </LinkButton>
          <button type="button" aria-label="Open menu" className="rounded-full p-2 text-on-surface-variant lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
