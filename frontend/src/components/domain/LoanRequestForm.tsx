"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Hourglass, LoaderCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormAlert, FormField } from "@/components/auth/FormField";
import { TermsFields, termsBody, type Terms } from "./TermsFields";
import { api, fieldError, type FieldErrors } from "@/lib/client-api";
import { formatBDT, repaymentEstimate } from "@/lib/format";
import type { OwnLoanRequest, SessionUser } from "@/data/types";

/**
 * Creates a loan request and publishes it in one go. Publishing needs an
 * approved verification and a complete business profile; if either is missing
 * the draft is kept and the owner is pointed to onboarding.
 */
export function LoanRequestForm({ owner, businessName }: { owner: SessionUser; businessName: string }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState("");
  const [fundUsage, setFundUsage] = useState("");
  const [terms, setTerms] = useState<Terms>({ amount: "50000", rate: "12", tenureDays: "90", frequency: "MONTHLY" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ request: OwnLoanRequest; published: boolean; reason?: string } | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const verified = owner.verification === "APPROVED";
  const estimate = repaymentEstimate(Number(terms.amount) || 0, Number(terms.rate) || 0, Number(terms.tenureDays) || 0, terms.frequency);

  async function submit() {
    setPending(true);
    setError(null);
    setFields({});
    const { interestRatePct, ...rest } = termsBody(terms);
    const draft = await api.post<OwnLoanRequest>("/me/loan-requests", {
      ...rest,
      proposedRatePct: interestRatePct,
      purpose: purpose.trim(),
      fundUsage: fundUsage.trim(),
    });
    if (!draft.ok) {
      setPending(false);
      setError(draft.code === "VALIDATION_ERROR" ? "Please fix the highlighted fields." : draft.error);
      // Make sure the reason is seen, e.g. "you already have an active request".
      requestAnimationFrame(() => alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      setFields({ ...draft.fields, interestRatePct: draft.fields.proposedRatePct });
      return;
    }
    const published = await api.post<OwnLoanRequest>(`/me/loan-requests/${draft.data.id}/publish`);
    setPending(false);
    setResult(published.ok ? { request: published.data, published: true } : { request: draft.data, published: false, reason: published.error });
    router.refresh();
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl animate-scale-in rounded-3xl bg-surface-container-lowest p-space-xl text-center card-shadow">
        <span className={`mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full ${result.published ? "bg-success-container text-success" : "bg-tertiary-fixed text-tertiary"}`}>
          {result.published ? <CheckCircle2 className="h-8 w-8" aria-hidden /> : <Hourglass className="h-8 w-8" aria-hidden />}
        </span>
        <h1 className="text-headline-lg text-on-surface">{result.published ? "Your loan request is live" : "Saved as a draft"}</h1>
        <p className="mx-auto mt-space-sm max-w-lg text-body-md text-on-surface-variant">
          {result.published
            ? `"${result.request.purpose}" for ${formatBDT(result.request.amountBdt)} is now visible to verified investors.`
            : `${result.reason ?? "It can't be published yet."} Your draft is saved and you can publish it from your dashboard.`}
        </p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <LinkButton href="/business-dashboard">Go to dashboard</LinkButton>
          {!result.published && <LinkButton href="/onboarding" variant="outline">Complete verification</LinkButton>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/business-dashboard" className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">New loan request · {businessName}</p>
          <h1 className="mt-1 text-headline-lg text-on-surface">Tell investors what you need</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Clear numbers and honest context help you get relevant offers.</p>
        </div>
        {verified ? (
          <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified</Badge>
        ) : (
          <Badge tone="warning"><Hourglass className="h-3.5 w-3.5" aria-hidden /> Verification needed to publish</Badge>
        )}
      </div>

      <section className="mt-space-md rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
        {error && <div ref={alertRef} className="mb-space-md"><FormAlert>{error}</FormAlert></div>}
        <div className="space-y-space-md">
          <FormField label="What is the loan for?" placeholder="e.g. Buy a second deck oven" maxLength={200} value={purpose} onChange={(event) => setPurpose(event.target.value)} error={fieldError(fields, "purpose")} />
          <label className="block">
            <span className="mb-1.5 block text-label-md font-semibold text-on-surface">How will you use the money and repay it?</span>
            <textarea rows={4} maxLength={5000} value={fundUsage} onChange={(event) => setFundUsage(event.target.value)} placeholder="What it pays for, and where repayments will come from." className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none" />
            {fieldError(fields, "fundUsage") && <span className="mt-1 block text-body-sm font-medium text-error">{fieldError(fields, "fundUsage")}</span>}
          </label>
          <TermsFields value={terms} onChange={setTerms} fields={fields} />
          <div className="rounded-xl bg-surface-container-low p-space-md">
            <p className="text-label-sm text-outline">Estimated total repayment at your proposed rate</p>
            <p className="text-numeric-stat text-primary">{formatBDT(estimate.total)}</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">About {estimate.instalments} payments of {formatBDT(estimate.instalment)}. Investors may offer different terms.</p>
          </div>
        </div>
        <div className="mt-space-lg flex justify-end border-t border-surface-container-high pt-space-md">
          <Button variant="secondary" onClick={submit} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Publishing…" : verified ? "Publish request" : "Save draft"}
          </Button>
        </div>
      </section>
    </div>
  );
}
