import { notFound } from "next/navigation";
import { LoanView } from "@/components/domain/LoanView";
import { backendGet } from "@/lib/backend/server";
import { getLoan } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { Agreement } from "@/data/types";

export const metadata = { title: "Loan agreement" };

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, loan] = await Promise.all([requireUser(`/loans/${id}`), getLoan(id)]);
  // Only the two parties (and admins) can read a loan.
  if (!loan) notFound();
  const agreement = loan.agreementId ? (await backendGet<Agreement>(`/agreements/${loan.agreementId}`)).data : null;
  return <LoanView loan={loan} agreement={agreement} viewerId={user.id} />;
}
