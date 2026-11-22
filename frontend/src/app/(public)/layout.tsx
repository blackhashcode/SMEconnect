import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="w-full flex-1 pt-20">{children}</main>
      <Footer publicPage />
    </div>
  );
}
