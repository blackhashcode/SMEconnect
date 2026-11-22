import { AppShell } from "@/components/layout/AppShell";
import { OfferBuilder } from "@/components/domain/OfferBuilder";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { FileQuestion } from "lucide-react";
import { loanById } from "@/data/loans";

export const metadata = { title: "Make a loan offer" };

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  const loan = loanById(request ?? "lr-1");

  return (
    <AppShell>
      {loan ? (
        <OfferBuilder loan={loan} />
      ) : (
        <EmptyState
          icon={FileQuestion}
          title="Request not found"
          description="The loan request you are trying to offer on is no longer available."
          action={<LinkButton href="/feed">Back to feed</LinkButton>}
        />
      )}
    </AppShell>
  );
}
