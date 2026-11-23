import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormAlert } from "@/components/auth/FormField";
import { LoginForm } from "@/components/auth/LoginForm";
import { images } from "@/data/images";
import { BackendUnavailableError } from "@/lib/backend/server";
import { safeNextPath } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";
import { authOptions } from "@/lib/api";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; loggedOut?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  let apiDown = false;
  let googleEnabled = false;
  try {
    if (await getCurrentUser()) redirect(nextPath);
    googleEnabled = (await authOptions()).google;
  } catch (error) {
    if (!(error instanceof BackendUnavailableError)) throw error;
    apiDown = true;
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your connections, offers and conversations." image={images["bakery-workers"]}>
      {apiDown && (
        <div className="mb-space-md">
          <FormAlert>The backend isn&apos;t reachable, so logging in won&apos;t work yet. Start it with pnpm dev in the backend folder.</FormAlert>
        </div>
      )}
      {params.error === "google" && (
        <div className="mb-space-md">
          <FormAlert>Google sign-in didn&apos;t complete. Please try again, or log in with your email.</FormAlert>
        </div>
      )}
      <LoginForm
        nextPath={nextPath}
        notice={params.loggedOut ? "You've been logged out." : undefined}
        googleEnabled={googleEnabled}
      />
    </AuthShell>
  );
}
