"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Hourglass, LoaderCircle, MessageSquareText, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/auth/FormField";
import { MessageButton } from "./MessageButton";
import { postJson } from "@/lib/client-api";

export function AgreementActions({
  offerId,
  agreed,
  canConfirm,
  counterpartId,
  counterpartLabel,
  waitingOn,
}: {
  offerId: string;
  agreed: boolean;
  canConfirm: boolean;
  counterpartId: string;
  counterpartLabel: string;
  waitingOn: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!window.confirm("Confirm these terms? This accepts the offer and closes the request to other offers.")) return;
    setPending(true);
    setError(null);
    const result = await postJson(`/api/offers/${offerId}/respond`, { action: "accept" });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-space-sm">
      {error && <FormAlert>{error}</FormAlert>}
      {agreed ? (
        <div className="flex animate-fade-in flex-wrap items-center justify-center gap-space-sm rounded-2xl bg-success-container p-space-md text-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <p className="text-label-md font-bold">Agreement confirmed by both sides.</p>
        </div>
      ) : (
        !canConfirm && (
          <div className="flex flex-wrap items-center justify-center gap-space-sm rounded-2xl bg-tertiary-fixed/60 p-space-md text-on-tertiary-fixed">
            <Hourglass className="h-5 w-5" aria-hidden />
            <p className="text-label-md font-bold">Waiting for {waitingOn} to confirm these terms.</p>
          </div>
        )
      )}
      <div className="flex flex-wrap items-center justify-center gap-space-sm print:hidden">
        {canConfirm && (
          <Button variant="secondary" size="lg" onClick={confirm} disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />} Confirm agreement
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Save as PDF
        </Button>
        <MessageButton participantId={counterpartId} variant="ghost" size="lg">
          <MessageSquareText className="h-4 w-4" aria-hidden /> Message {counterpartLabel}
        </MessageButton>
      </div>
    </div>
  );
}
