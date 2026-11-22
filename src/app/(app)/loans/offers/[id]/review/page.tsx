import { notFound } from "next/navigation";
import { ReviewNegotiation } from "@/components/domain/ReviewNegotiation";
import { getOffer } from "@/lib/api";

export const metadata = { title: "Review loan offer" };

export default async function ReviewOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The API only returns the offer to its investor and the request's owner.
  const result = await getOffer(id);
  if (!result?.loan) notFound();

  return <ReviewNegotiation key={result.offer.id} offer={result.offer} loan={result.loan} viewerSide={result.viewerSide} />;
}
