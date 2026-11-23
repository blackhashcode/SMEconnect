import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { requireUser } from "@/lib/session";

/**
 * Shared shell for every logged-in screen. Because it lives in a layout, the
 * header, footer and tab bar stay mounted while only the page content swaps.
 * It also verifies the session with the API; visitors without one go to /login.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const { messages: unreadMessages, notifications: unreadNotifications } = user.unread;

  return (
    <SessionProvider user={user}>
      <div className="flex min-h-screen flex-col">
        <AppHeader user={user} unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
        <main className="mx-auto w-full max-w-shell flex-1 px-margin pb-space-xl pt-24 md:px-gutter-desktop lg:pt-28">
          {children}
        </main>
        <div className="pb-16 lg:pb-0">
          <Footer />
        </div>
        <MobileTabBar unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
      </div>
    </SessionProvider>
  );
}
