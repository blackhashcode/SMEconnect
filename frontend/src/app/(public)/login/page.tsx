import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormAlert } from "@/components/auth/FormField";
import { LoginForm } from "@/components/auth/LoginForm";
import { images } from "@/data/images";
import { BackendUnavailableError } from "@/lib/backend/server";
import { safeNextPath } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Log in" };

// Demo sign-in buttons: always in development; in production only when
// SHOW_DEMO_LOGIN=true (for a public showcase running on seeded demo data).
const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; loggedOut?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  let apiDown = false;
  try {
    if (await getCurrentUser()) redirect(nextPath);
  } catch (error) {
    if (!(error instanceof BackendUnavailableError)) throw error;
    apiDown = true;
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your connections, offers and conversations." image={images["nusrat-bakery"]}>
      {apiDown && (
        <div className="mb-space-md">
          <FormAlert>The backend isn&apos;t reachable, so logging in won&apos;t work yet. Start it with pnpm dev in the backend folder.</FormAlert>
        </div>
      )}
      <LoginForm
        nextPath={nextPath}
        notice={params.loggedOut ? "You've been logged out." : undefined}
        demo={
          showDemo
            ? {
                password: process.env.SEED_DEMO_PASSWORD || "Password123!",
                accounts: [
                  { label: "Investor · Rafiq", email: "investor01@smeconnect.local" },
                  { label: "Business · Nusrat", email: "owner02@smeconnect.local" },
                  { label: "Admin", email: "admin@smeconnect.local" },
                ],
              }
            : undefined
        }
      />
    </AuthShell>
  );
}
