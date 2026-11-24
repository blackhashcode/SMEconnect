import { Building2, FileClock } from "lucide-react";
import { LoanRequestForm } from "@/components/domain/LoanRequestForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { getProfile, myLoanRequests } from "@/lib/api";
import { requireUser } from "@/lib/session";

const ACTIVE_STATUSES: string[] = ["DRAFT", "OPEN", "IN_DISCUSSION", "PAUSED", "FUNDED", "REPAYING"];

export const metadata = { title: "New loan request" };

export default async function NewLoanRequestPage() {
  const user = await requireUser("/loans/new");
  if (user.role !== "business") {
    return (
      <EmptyState
        icon={Building2}
        title="Loan requests are for business owners"
        description="Investor accounts make offers on requests instead. Browse open requests to find a business to back."
        action={<LinkButton href="/explore">Browse open requests</LinkButton>}
      />
    );
  }
  if (!user.hasProfile) {
    return (
      <EmptyState
        icon={Building2}
        title="Set up your business profile first"
        description="Investors need to know who they're lending to. It takes a couple of minutes."
        action={<LinkButton href="/onboarding">Complete your profile</LinkButton>}
      />
    );
  }
  // One request at a time: send the owner to the one they already have.
  const existing = (await myLoanRequests()).find((request) => ACTIVE_STATUSES.includes(request.status));
  if (existing) {
    const reason = existing.status === "DRAFT"
      ? "You have an unpublished draft. Publish it or cancel it from your dashboard before starting a new one."
      : existing.status === "FUNDED" || existing.status === "REPAYING"
        ? "Your current loan is still being repaid. You can request a new one once it's fully repaid."
        : "You already have an active loan request. Close or cancel it from your dashboard before starting a new one.";
    return (
      <EmptyState
        icon={FileClock}
        title="You already have a loan request"
        description={`"${existing.purpose}" (${existing.status.toLowerCase().replace("_", " ")}). ${reason}`}
        action={<LinkButton href="/business-dashboard">Go to dashboard</LinkButton>}
      />
    );
  }
  const profile = await getProfile(user.id);
  return <LoanRequestForm owner={user} businessName={profile?.business?.name ?? user.name} />;
}
