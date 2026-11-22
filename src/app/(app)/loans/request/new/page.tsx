import { Building2 } from "lucide-react";
import { LoanRequestForm } from "@/components/domain/LoanRequestForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { getPerson } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Create loan request" };

export default async function NewLoanRequestPage() {
  const user = await requireUser("/loans/request/new");
  const profile = user.role === "business" ? await getPerson(user.id) : null;

  if (!profile?.business) {
    return (
      <EmptyState
        icon={Building2}
        title="Loan requests are for business owners"
        description="Investor accounts make offers on requests instead. Browse open requests to find a business to back."
        action={<LinkButton href="/explore">Browse open requests</LinkButton>}
      />
    );
  }

  return <LoanRequestForm owner={user} business={profile.business} />;
}
