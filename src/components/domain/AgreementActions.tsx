"use client";

import { useState } from "react";
import { CheckCircle2, Download, MessageSquareText } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";

export function AgreementActions({ loanId }: { loanId: string }) {
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-space-sm rounded-2xl bg-success-container p-space-md text-success">
        <CheckCircle2 className="h-5 w-5" aria-hidden />
        <p className="text-label-md font-bold">Agreement confirmed. Repayment tracking is now active.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-space-sm">
      <Button variant="secondary" size="lg" onClick={() => setConfirmed(true)}><CheckCircle2 className="h-4 w-4" aria-hidden /> Confirm agreement</Button>
      <Button variant="outline" size="lg"><Download className="h-4 w-4" aria-hidden /> Download PDF</Button>
      <LinkButton href="/messages" variant="ghost" size="lg"><MessageSquareText className="h-4 w-4" aria-hidden /> Message {loanId.startsWith("lr-") ? "investor" : "member"}</LinkButton>
    </div>
  );
}
