import { FileQuestion, ShieldAlert } from "lucide-react";
import { OfferBuilder } from "@/components/domain/OfferBuilder";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { getLoanRequest, offersSubmitted } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Make a loan offer" };

export default async function NewOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, loan] = await Promise.all([requireUser(`/loan-requests/${id}/offer`), getLoanRequest(id)]);

  if (!loan) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Request not available"
        description="This loan request is no longer open for offers."
        action={<LinkButton href="/explore">Browse open requests</LinkButton>}
      />
    );
  }

  const blocked =
    user.role !== "investor"
      ? "Only investor accounts can make loan offers."
      : user.verification !== "APPROVED"
        ? "Get your identity verified before making offers. It only takes a few minutes to submit."
        : null;
  if (blocked) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You can't make an offer yet"
        description={blocked}
        action={<LinkButton href={user.role === "investor" ? "/onboarding" : `/businesses/${loan.business.id}`}>{user.role === "investor" ? "Complete verification" : "View the business"}</LinkButton>}
      />
    );
  }

  // One pending offer per request: send the investor to the one they already made.
  const existing = (await offersSubmitted()).find((offer) => offer.loanRequest.id === loan.id && offer.status === "PENDING");
  if (existing) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You already have an offer on this request"
        description="Withdraw it first if you want to send different terms."
        action={<LinkButton href={`/offers/${existing.id}`}>View your offer</LinkButton>}
      />
    );
  }

  return <OfferBuilder loan={loan} />;
}
