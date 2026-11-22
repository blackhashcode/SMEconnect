import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormAlert } from "@/components/auth/FormField";
import { LoginForm } from "@/components/auth/LoginForm";
import { images } from "@/data/images";
import { ApiUnavailableError } from "@/lib/api";
import { safeNextPath } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Log in" };

const isDev = process.env.NODE_ENV !== "production";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; loggedOut?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  let apiDown = false;
  try {
    if (await getCurrentUser()) redirect(nextPath);
  } catch (error) {
    if (!(error instanceof ApiUnavailableError)) throw error;
    apiDown = true;
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your connections, offers and conversations." image={images["nusrat-bakery"]}>
      {apiDown && (
        <div className="mb-space-md">
          <FormAlert>The API isn&apos;t running, so logging in won&apos;t work yet. Start it with npm run dev:api.</FormAlert>
        </div>
      )}
      <LoginForm
        nextPath={nextPath}
        notice={params.loggedOut ? "You've been logged out." : undefined}
        demo={
          isDev
            ? {
                password: process.env.SEED_PASSWORD ?? "Demo@12345",
                accounts: [
                  { label: "Investor · Rafiq", email: "rafiq@demo.smeconnect.bd" },
                  { label: "Business · Nusrat", email: "nusrat@demo.smeconnect.bd" },
                  { label: "Admin", email: "admin@demo.smeconnect.bd" },
                ],
              }
            : undefined
        }
      />
    </AuthShell>
  );
}
