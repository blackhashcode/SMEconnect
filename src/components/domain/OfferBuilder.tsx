"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, LoaderCircle, MessageSquareText, Percent, ShieldCheck, Wallet } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBDT } from "@/lib/format";
import type { LoanOfferView, LoanRequestView } from "@/data/types";
import { FormAlert } from "@/components/auth/FormField";
import { postJson, type FieldErrors } from "@/lib/client-api";
import { repaymentPlan } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";

export function OfferBuilder({ loan }: { loan: LoanRequestView }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(loan.amount));
  const [rate, setRate] = useState(String(loan.rate));
  const [tenure, setTenure] = useState(String(loan.tenureMonths));
  const [frequency, setFrequency] = useState(loan.repaymentFrequency);
  const [note, setNote] = useState(`Assalamu Alaikum. I have reviewed ${loan.business.name} and would like to offer the following terms.`);
  const [sent, setSent] = useState<{ threadId: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  const { business, owner } = loan;
  const totalRepayment = repaymentPlan(Number(amount) || 0, Number(rate) || 0, Number(tenure) || 0, frequency).total;

  async function send() {
    setPending(true);
    setError(null);
    setFields({});
    const result = await postJson<{ offer: LoanOfferView; threadId: string }>(`/api/loans/${loan.id}/offers`, {
      amount: Number(amount),
      rate: Number(rate),
      tenureMonths: Number(tenure),
      frequency,
      note,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields);
      return;
    }
    setSent({ threadId: result.data.threadId });
    router.refresh();
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-surface-container-lowest p-space-xl text-center card-shadow">
        <span className="mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </span>
        <p className="text-label-sm font-bold uppercase tracking-wider text-success">Offer sent</p>
        <h1 className="mt-space-sm text-headline-lg text-on-surface">Your offer is with the business owner</h1>
        <p className="mx-auto mt-space-sm max-w-lg text-body-md text-on-surface-variant">
          {formatBDT(Number(amount) || 0)} at {rate}% p.a. over {tenure} months, repaid {frequency.toLowerCase()}. The owner can accept, decline or propose different terms.
        </p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <LinkButton href={`/messages?thread=${sent.threadId}`}>Open conversation</LinkButton>
          <LinkButton href="/investor-dashboard" variant="outline">Go to dashboard</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/feed" className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to feed
      </Link>
      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <aside className="space-y-space-md">
          <div className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Request summary</p>
            <h1 className="mt-space-sm text-headline-md text-on-surface">{loan.title}</h1>
            {(
              <div className="mt-space-md flex items-center gap-space-sm">
                <Avatar src={owner.avatar} alt={owner.name} size="md" />
                <div>
                  <p className="text-label-md font-bold text-on-surface">{owner.name}</p>
                  <p className="text-body-sm text-outline">{business.name}</p>
                </div>
              </div>
            )}
            <div className="mt-space-md grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
              <div><p className="text-label-sm text-outline">Ask</p><p className="text-label-md font-bold text-on-surface">{formatBDT(loan.amount)}</p></div>
              <div><p className="text-label-sm text-outline">Term</p><p className="text-label-md font-bold text-on-surface">{loan.tenureMonths} mo</p></div>
              <div><p className="text-label-sm text-outline">Rate</p><p className="text-label-md font-bold text-success">{loan.rate}%</p></div>
            </div>
            <ProgressBar value={loan.progress} label="Owner's request progress" className="mt-space-md" />
          </div>

          <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <ShieldCheck className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Direct terms, shared records</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">
              Your offer goes straight to the verified owner. Repayments follow the terms you agree together.
            </p>
          </div>
        </aside>

        <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <div>
              <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Step 1 of 1</p>
              <h2 className="mt-1 text-headline-md text-on-surface">Create your loan offer</h2>
            </div>
            <span className="rounded-full bg-secondary-fixed px-space-md py-1.5 text-label-sm font-bold text-secondary">
              Goes straight to {owner.name.split(" ")[0]}
            </span>
          </div>

          {error && (
            <div className="mt-space-md">
              <FormAlert>{error}</FormAlert>
            </div>
          )}

          <div className="mt-space-lg grid gap-space-md sm:grid-cols-2">
            <Field label="Offer amount" icon={Wallet} prefix="৳" hint="Min ৳10,000" error={fields.amount?.[0]}>
              <input type="number" min={10000} value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
            </Field>
            <Field label="Rate (p.a.)" icon={Percent} suffix="%" hint="1–30%" error={fields.rate?.[0]}>
              <input type="number" min={1} max={30} step={0.5} value={rate} onChange={(event) => setRate(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
            </Field>
            <Field label="Tenure" icon={CalendarDays} suffix="months" hint="3–36 months" error={fields.tenureMonths?.[0]}>
              <input type="number" min={3} max={36} value={tenure} onChange={(event) => setTenure(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
            </Field>
            <label className="block">
              <span className="mb-space-sm block text-label-sm font-bold text-outline">Repayment frequency</span>
              <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none">
                <option>Monthly</option>
                <option>Bi-weekly</option>
                <option>Weekly</option>
              </select>
            </label>
          </div>

          <label className="mt-space-md block">
            <span className="mb-space-sm block text-label-sm font-bold text-outline">Personal note</span>
            <textarea rows={4} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
          </label>

          <div className="mt-space-md rounded-xl bg-surface-container-low p-space-md">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div>
                <p className="text-label-sm text-outline">Estimated total repayment</p>
                <p className="text-numeric-stat text-primary">{formatBDT(totalRepayment)}</p>
              </div>
              <MessageSquareText className="h-6 w-6 text-outline" aria-hidden />
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">Illustrative only. Final repayment is based on the agreed schedule in the loan agreement.</p>
          </div>

          <div className="mt-space-md flex flex-wrap items-center justify-end gap-space-sm border-t border-surface-container-high pt-space-md">
            <LinkButton href={`/businesses/${business.id}`} variant="ghost">Cancel</LinkButton>
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

function Field({
  label,
  icon: Icon,
  prefix,
  suffix,
  hint,
  error,
  children,
}: {
  label: string;
  icon: typeof Wallet;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-space-sm flex items-center justify-between gap-2">
        <span className="text-label-sm font-bold text-outline">{label}</span>
        {hint && <span className="text-[10px] text-outline">{hint}</span>}
      </div>
      <span className={`flex items-center gap-space-sm rounded-xl border bg-surface-container-lowest px-space-md py-3 transition-colors focus-within:border-primary ${error ? "border-error" : "border-outline-variant"}`}>
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {prefix && <span className="text-body-md text-outline">{prefix}</span>}
        {children}
        {suffix && <span className="shrink-0 text-body-sm text-outline">{suffix}</span>}
      </span>
      {error && <span className="mt-1 block text-body-sm font-medium text-error">{error}</span>}
    </label>
  );
}
