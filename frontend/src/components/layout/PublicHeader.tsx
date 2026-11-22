"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useScrolled } from "./useScrolled";
import { LinkButton } from "@/components/ui/Button";
import { publicNav } from "@/data/nav";
import { cn } from "@/lib/cn";

export function PublicHeader() {
  const pathname = usePathname();
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  // Public pages stay static; ask the API in the browser whether someone is signed in.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => active && setSignedIn(res.ok))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Close the mobile menu after navigating or pressing Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b bg-surface/85 backdrop-blur-xl transition-[box-shadow,border-color] duration-300",
        scrolled || open ? "border-surface-container-high shadow-header" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-20 w-full max-w-shell items-center justify-between gap-space-md px-margin md:px-gutter-desktop">
        <BrandLogo />
        <nav className="hidden items-center gap-space-lg lg:flex" aria-label="Public navigation">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="link-underline whitespace-nowrap text-label-md font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-space-sm">
          {signedIn ? (
            <LinkButton href="/feed" variant="primary" size="sm" className="animate-fade-in">
              Open app
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Log in
              </LinkButton>
              <LinkButton href="/signup" variant="secondary" size="sm">
                Sign up
              </LinkButton>
            </>
          )}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="public-mobile-menu"
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high lg:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id="public-mobile-menu"
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out lg:hidden",
          open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <nav className="min-h-0" aria-label="Public navigation (mobile)">
          <ul className="mx-auto max-w-shell space-y-1 px-margin pb-space-md md:px-gutter-desktop">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  tabIndex={open ? undefined : -1}
                  className="block rounded-xl px-space-md py-3 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className={signedIn ? "hidden" : "sm:hidden"}>
              <Link
                href="/login"
                tabIndex={open ? undefined : -1}
                className="block rounded-xl px-space-md py-3 text-body-md font-semibold text-primary hover:bg-surface-container-low"
              >
                Log in
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
