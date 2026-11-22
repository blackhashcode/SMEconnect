import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ReviewNegotiation } from "@/components/domain/ReviewNegotiation";
import { loanById } from "@/data/loans";
import { offerById } from "@/data/offers";

export const metadata = { title: "Review loan offer" };

export default async function ReviewOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = offerById(id);
  const loan = offer ? loanById(offer.requestId) : undefined;

  if (!offer || !loan) notFound();

  return (
    <AppShell>
      <ReviewNegotiation offer={offer} loan={loan} />
    </AppShell>
  );
}
