import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";
import { images } from "@/data/images";
import { safeNextPath } from "@/lib/profile";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const { email, next } = await searchParams;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/signup");

  return (
    <AuthShell title="Check your email" subtitle="Enter the code we sent to confirm it's you. It expires after a few minutes." image={images["nusrat-bakery"]}>
      <VerifyEmailForm email={email} nextPath={safeNextPath(next, "/onboarding")} />
    </AuthShell>
  );
}
