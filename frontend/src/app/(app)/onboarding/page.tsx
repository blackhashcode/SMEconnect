import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/domain/OnboardingFlow";
import { backendGet } from "@/lib/backend/server";
import { myVerification } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { MeResponse } from "@/data/types";

export const metadata = { title: "Profile & verification" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (user.role === "admin") redirect("/admin");
  const [me, verification] = await Promise.all([backendGet<MeResponse>("/me"), myVerification()]);
  return <OnboardingFlow user={user} initialProfile={(me.data?.profile as Record<string, unknown> | null) ?? null} verification={verification} />;
}
