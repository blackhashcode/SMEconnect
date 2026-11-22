import { FileQuestion, ShieldAlert } from "lucide-react";
import { OfferBuilder } from "@/components/domain/OfferBuilder";
import { isActiveLoan } from "@/lib/loans";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { getLoan, listLoanOffers } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Make a loan offer" };

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  const user = await requireUser();
  const loan = request ? await getLoan(request) : null;

  if (!loan) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={request ? "Request not found" : "Choose a request first"}
        description={
          request
            ? "The loan request you are trying to offer on is no longer available."
            : "Pick an open loan request in Explore, then make your offer from there."
        }
        action={<LinkButton href="/explore">Browse open requests</LinkButton>}
      />
    );
  }

  const blocked =
    user.role !== "investor"
      ? "Only investor accounts can make loan offers."
      : loan.owner.id === user.id
        ? "You can't make an offer on your own request."
        : !isActiveLoan(loan)
          ? "This request is no longer accepting offers."
          : null;

  // The API returns only this investor's own offers on the request.
  const existing = blocked ? null : (await listLoanOffers(loan.id)).find((offer) => offer.status === "pending" || offer.status === "negotiating" || offer.status === "accepted");
  if (existing) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You already have an offer on this request"
        description="Withdraw it first if you want to send different terms."
        action={<LinkButton href={`/loans/offers/${existing.id}/review`}>View your offer</LinkButton>}
      />
    );
  }

  if (blocked) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You can't make an offer here"
        description={blocked}
        action={<LinkButton href={`/businesses/${loan.business.id}`}>View the business</LinkButton>}
      />
    );
  }

  return <OfferBuilder loan={loan} />;
}
