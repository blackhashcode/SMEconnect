import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { PublicHeader } from "./PublicHeader";
import { Footer } from "./Footer";
import { cn } from "@/lib/cn";

export function AppShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className={cn("mx-auto w-full max-w-shell px-gutter-desktop pb-space-xl pt-28", className)}>{children}</main>
      <Footer />
    </div>
  );
}

export function PublicShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className={cn("w-full pt-20", className)}>{children}</main>
      <Footer publicPage />
    </div>
  );
}
