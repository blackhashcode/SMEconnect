import { notFound } from "next/navigation";
import { OfferDetail } from "@/components/domain/OfferDetail";
import { getOffer, investorDashboard, offersReceived, offersSubmitted, ownerDashboard } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Loan offer" };

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, offer] = await Promise.all([requireUser(`/offers/${id}`), getOffer(id)]);
  // The API only returns an offer to its two parties.
  if (!offer) notFound();

  const isInvestor = user.id === offer.investor.id;
  const requestId = offer.loanRequest.id;

  // Where to go next: the follow-up counter-offer, or the loan an accepted offer created.
  const related = offer.status === "COUNTERED" ? await (isInvestor ? offersSubmitted() : offersReceived(requestId)) : [];
  const nextOfferId = related.find((item) => item.parentOfferId === offer.id)?.id ?? null;

  let loanId: string | null = null;
  if (offer.status === "ACCEPTED") {
    if (isInvestor) loanId = (await investorDashboard())?.portfolio.find((loan) => loan.loanRequestId === requestId)?.id ?? null;
    else {
      const loan = (await ownerDashboard())?.loan;
      loanId = loan && loan.loanRequestId === requestId ? loan.id : null;
    }
  }

  return <OfferDetail key={offer.id} offer={offer} viewerId={user.id} loanId={loanId} nextOfferId={nextOfferId} />;
}
