"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormAlert } from "@/components/auth/FormField";
import { TermsFields, termsBody, TENURE_OPTIONS, type Terms } from "./TermsFields";
import { api, fieldError, type FieldErrors } from "@/lib/client-api";
import { formatBDT, repaymentEstimate } from "@/lib/format";
import { FREQUENCY_LABEL, tenureLabel } from "@/lib/loans";
import type { LoanRequestView, Offer } from "@/data/types";

export function OfferBuilder({ loan }: { loan: LoanRequestView }) {
  const router = useRouter();
  const [terms, setTerms] = useState<Terms>({
    amount: String(loan.amount),
    rate: String(loan.rate ?? 12),
    tenureDays: String(TENURE_OPTIONS.includes(loan.tenureDays) ? loan.tenureDays : 90),
    frequency: loan.frequency,
  });
  const [message, setMessage] = useState(`Assalamu Alaikum. I've reviewed ${loan.business.name} and would like to offer these terms.`);
  const [sent, setSent] = useState<Offer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  const estimate = repaymentEstimate(Number(terms.amount) || 0, Number(terms.rate) || 0, Number(terms.tenureDays) || 0, terms.frequency);

  async function send() {
    setPending(true);
    setError(null);
    setFields({});
    const result = await api.post<Offer>("/offers", { loanRequestId: loan.id, ...termsBody(terms), message: message.trim() || undefined });
    setPending(false);
    if (!result.ok) {
      setError(result.code === "VALIDATION_ERROR" ? "Please check the highlighted terms." : result.error);
      setFields(result.fields);
      return;
    }
    setSent(result.data);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl animate-scale-in rounded-3xl bg-surface-container-lowest p-space-xl text-center card-shadow">
        <span className="mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </span>
        <p className="text-label-sm font-bold uppercase tracking-wider text-success">Offer sent</p>
        <h1 className="mt-space-sm text-headline-lg text-on-surface">Your offer is with {loan.owner.name.split(" ")[0]}</h1>
        <p className="mx-auto mt-space-sm max-w-lg text-body-md text-on-surface-variant">
          {formatBDT(sent.amountBdt)} at {Number(sent.interestRatePct)}% over {tenureLabel(sent.tenureDays)}, repaid {FREQUENCY_LABEL[sent.repaymentFrequency].toLowerCase()}. They can accept, reject or send back different terms.
        </p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <LinkButton href={`/offers/${sent.id}`}>View your offer</LinkButton>
          <LinkButton href="/investor-dashboard" variant="outline">Go to dashboard</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/businesses/${loan.business.id}`} className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to {loan.business.name}
      </Link>
      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <aside className="space-y-space-md">
          <div className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Request summary</p>
            <h1 className="mt-space-sm text-headline-md text-on-surface">{loan.title}</h1>
            <p className="mt-space-sm text-body-md text-on-surface-variant">{loan.description}</p>
            <div className="mt-space-md flex items-center gap-space-sm">
              <Avatar src={loan.owner.avatar} alt={loan.owner.name} size="md" />
              <div>
                <p className="text-label-md font-bold text-on-surface">{loan.owner.name}</p>
                <p className="text-body-sm text-outline">{loan.business.name}</p>
              </div>
            </div>
            <div className="mt-space-md grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
              <div><p className="text-label-sm text-outline">Ask</p><p className="text-label-md font-bold text-on-surface">{formatBDT(loan.amount)}</p></div>
              <div><p className="text-label-sm text-outline">Term</p><p className="text-label-md font-bold text-on-surface">{tenureLabel(loan.tenureDays)}</p></div>
              <div><p className="text-label-sm text-outline">Rate</p><p className="text-label-md font-bold text-success">{loan.rate === null ? "Open" : `${loan.rate}%`}</p></div>
            </div>
          </div>
          <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <ShieldCheck className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Direct terms, shared records</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Your offer goes straight to the verified owner. If they accept, you both confirm an agreement before any money moves.</p>
          </div>
        </aside>

        <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
          <h2 className="text-headline-md text-on-surface">Create your loan offer</h2>
          {error && <div className="mt-space-md"><FormAlert>{error}</FormAlert></div>}
          <div className="mt-space-lg">
            <TermsFields value={terms} onChange={setTerms} fields={fields} />
          </div>
          <label className="mt-space-md block">
            <span className="mb-space-sm block text-label-sm font-bold text-outline">Message to the owner</span>
            <textarea rows={4} maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
            {fieldError(fields, "message") && <span className="mt-1 block text-body-sm font-medium text-error">{fieldError(fields, "message")}</span>}
          </label>
          <div className="mt-space-md rounded-xl bg-surface-container-low p-space-md">
            <p className="text-label-sm text-outline">Estimated total repayment</p>
            <p className="text-numeric-stat text-primary">{formatBDT(estimate.total)}</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">About {estimate.instalments} payments of {formatBDT(estimate.instalment)}. The exact schedule is set when the offer is accepted.</p>
          </div>
          <div className="mt-space-md flex flex-wrap items-center justify-end gap-space-sm border-t border-surface-container-high pt-space-md">
            <LinkButton href={`/businesses/${loan.business.id}`} variant="ghost">Cancel</LinkButton>
            <Button variant="secondary" onClick={send} disabled={pending}>
              {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Sending…" : "Send offer"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
