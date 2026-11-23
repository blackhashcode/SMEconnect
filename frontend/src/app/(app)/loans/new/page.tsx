import { Building2 } from "lucide-react";
import { LoanRequestForm } from "@/components/domain/LoanRequestForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { getProfile } from "@/lib/api";
import { requireUser } from "@/lib/session";

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
  const profile = await getProfile(user.id);
  return <LoanRequestForm owner={user} businessName={profile?.business?.name ?? user.name} />;
}
