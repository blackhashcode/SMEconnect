"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, Check, Clock3, Handshake, LoaderCircle, MessageSquareText, Percent, ShieldCheck, Undo2, Wallet, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FormAlert } from "@/components/auth/FormField";
import { MessageButton } from "./MessageButton";
import { offerStatusTone } from "@/lib/loans";
import { postJson, type FieldErrors } from "@/lib/client-api";
import { formatBDT } from "@/lib/format";
import type { LoanOfferView, LoanRequestView } from "@/data/types";

type Action = "accept" | "decline" | "counter" | "withdraw";

export function ReviewNegotiation({ offer: initialOffer, loan, viewerSide }: { offer: LoanOfferView; loan: LoanRequestView; viewerSide: "owner" | "investor" }) {
  const router = useRouter();
  const [offer, setOffer] = useState(initialOffer);
  const [amount, setAmount] = useState(String(offer.counter?.amount ?? offer.amount));
  const [rate, setRate] = useState(String(offer.counter?.rate ?? offer.rate));
  const [tenure, setTenure] = useState(String(offer.counter?.tenureMonths ?? offer.tenureMonths));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [threadId, setThreadId] = useState<string | null>(null);
  const [justDid, setJustDid] = useState<Action | null>(null);

  const { investor } = offer;
  const isOwner = viewerSide === "owner";
  const open = offer.status === "pending" || offer.status === "negotiating";
  const hasCounter = Boolean(offer.counter) && offer.lastActionBy === "owner";
  const counterpartId = isOwner ? investor.id : loan.owner.id;
  const backHref = isOwner ? "/business-dashboard" : "/investor-dashboard";

  async function act(action: Action) {
    if (action === "decline" && !window.confirm("Decline this offer? The investor will be notified.")) return;
    if (action === "withdraw" && !window.confirm("Withdraw your offer? You can send a new one later while the request is open.")) return;
    setPending(action);
    setError(null);
    setFields({});
    const body = action === "counter" ? { action, amount: Number(amount), rate: Number(rate), tenureMonths: Number(tenure), note: reason } : { action };
    const result = await postJson<{ offer: LoanOfferView; threadId: string }>(`/api/v1/offers/${offer.id}/respond`, body);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields);
      return;
    }
    setOffer(result.data.offer);
    setThreadId(result.data.threadId);
    setJustDid(action);
    router.refresh();
  }

  // ---------- Outcome screen ----------
  if (justDid || !open) {
    const terms = `${formatBDT(offer.amount)} at ${offer.rate}% p.a. over ${offer.tenureMonths} months`;
    const outcome = {
      accepted: { title: "Offer accepted", text: `${terms}. The agreement is ready to view.` },
      declined: { title: "Offer declined", text: isOwner ? `${investor.name} has been notified. Your request stays open for other offers.` : "The business owner declined this offer." },
      withdrawn: { title: "Offer withdrawn", text: isOwner ? `${investor.name} withdrew this offer.` : "Your offer has been withdrawn. You can make a new one while the request is open." },
      negotiating: { title: "Counter-offer sent", text: `You proposed ${formatBDT(offer.counter?.amount ?? 0)} at ${offer.counter?.rate}% p.a. over ${offer.counter?.tenureMonths} months. ${investor.name} can accept it or reply in messages.` },
      pending: { title: "Offer pending", text: terms },
    }[offer.status];
    const negative = offer.status === "declined" || offer.status === "withdrawn";

    return (
      <div className="mx-auto max-w-2xl animate-scale-in rounded-3xl bg-surface-container-lowest p-space-xl text-center card-shadow">
        <span className={`mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full ${negative ? "bg-error-container text-error" : "bg-success-container text-success"}`}>
          {negative ? <X className="h-8 w-8" aria-hidden /> : <Check className="h-8 w-8" aria-hidden />}
        </span>
        <h1 className="text-headline-lg text-on-surface">{outcome.title}</h1>
        <p className="mx-auto mt-space-sm max-w-lg text-body-md text-on-surface-variant">{outcome.text}</p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          {offer.status === "accepted" && <LinkButton href={`/loans/${loan.id}/agreement`}>View agreement</LinkButton>}
          {threadId ? (
            <LinkButton href={`/messages?thread=${threadId}`} variant={offer.status === "accepted" ? "outline" : "primary"}>Open conversation</LinkButton>
          ) : (
            <MessageButton participantId={counterpartId} variant="outline">Open conversation</MessageButton>
          )}
          {justDid === "counter" && open && (
            <Button variant="ghost" onClick={() => setJustDid(null)}>Back to offer</Button>
          )}
          <LinkButton href={backHref} variant="ghost">Back to dashboard</LinkButton>
        </div>
      </div>
    );
  }

  // ---------- Live negotiation ----------
  const rows = [
    { label: "Amount", request: formatBDT(loan.amount), offer: formatBDT(offer.amount), counter: offer.counter && formatBDT(offer.counter.amount) },
    { label: "Rate p.a.", request: `${loan.rate}%`, offer: `${offer.rate}%`, counter: offer.counter && `${offer.counter.rate}%` },
    { label: "Tenure", request: `${loan.tenureMonths} months`, offer: `${offer.tenureMonths} months`, counter: offer.counter && `${offer.counter.tenureMonths} months` },
    { label: "Repayment", request: loan.repaymentFrequency, offer: offer.frequency, counter: offer.counter && offer.frequency },
  ];
  const cols = hasCounter ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]";
  const waitingOn = offer.lastActionBy === "owner" ? "investor" : "owner";
  const yourTurn = (isOwner && waitingOn === "owner") || (!isOwner && waitingOn === "investor");
  const other = isOwner ? investor : loan.owner;
  const shownAmount = hasCounter && !isOwner && offer.counter ? offer.counter.amount : offer.amount;

  return (
    <div>
      <Link href={backHref} className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">{isOwner ? "Incoming offer" : "Your offer"} · #{offer.id.toUpperCase()}</p>
          <h1 className="mt-1 text-headline-lg text-on-surface">{isOwner ? "Review and negotiate terms" : "Track your offer"}</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">{loan.title} · {loan.business.name}</p>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <Badge tone={offerStatusTone[offer.status]} className="capitalize">{offer.status}</Badge>
          <Badge tone={yourTurn ? "secondary" : "neutral"}><Clock3 className="h-3.5 w-3.5" aria-hidden /> {yourTurn ? "Your turn" : `Waiting for the ${waitingOn}`}</Badge>
        </div>
      </div>

      {error && (
        <div className="mt-space-md">
          <FormAlert>{error}</FormAlert>
        </div>
      )}

      <div className="mt-space-lg grid gap-space-lg lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-space-md">
          <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <div className="flex flex-wrap items-start justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <Avatar src={other.avatar} alt={other.name} size="lg" />
                <div>
                  <p className="text-headline-sm text-on-surface">{other.name}</p>
                  <p className="text-body-sm text-outline">{isOwner ? investor.headline : `${loan.business.name} · ${loan.business.location}`}</p>
                  <p className="mt-1 flex items-center gap-1 text-body-sm text-on-surface-variant">
                    <Building2 className="h-3.5 w-3.5" aria-hidden /> {other.connections} connections
                  </p>
                </div>
              </div>
              <Link href={isOwner ? `/investors/${investor.id}` : `/businesses/${loan.business.id}`} className="text-label-md font-semibold text-primary hover:underline">View profile</Link>
            </div>

            {offer.note && (
              <blockquote className="mt-space-md rounded-xl bg-surface-container-low p-space-md text-body-md italic text-on-surface-variant">“{offer.note}”</blockquote>
            )}

            <div className="mt-space-md overflow-x-auto rounded-xl border border-surface-container-high">
              <div className={`grid ${cols} min-w-[420px] bg-surface-container-low px-space-md py-space-sm text-label-sm font-bold uppercase tracking-wide text-outline`}>
                <span>Term</span>
                <span>Request</span>
                <span>Offer</span>
                {hasCounter && <span>Counter</span>}
              </div>
              {rows.map((row) => (
                <div key={row.label} className={`grid ${cols} min-w-[420px] border-t border-surface-container-high px-space-md py-space-sm text-body-sm text-on-surface-variant`}>
                  <span>{row.label}</span>
                  <span>{row.request}</span>
                  <span className={hasCounter ? "" : "font-bold text-primary"}>{row.offer}</span>
                  {hasCounter && <span className="font-bold text-secondary">{row.counter}</span>}
                </div>
              ))}
            </div>
            {hasCounter && offer.counter?.note && (
              <p className="mt-space-sm rounded-xl bg-tertiary-fixed/60 p-space-sm text-body-sm text-on-tertiary-fixed">Owner&apos;s note: {offer.counter.note}</p>
            )}
          </section>

          {isOwner && (
            <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
              <div className="flex items-center gap-space-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary"><Percent className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h2 className="text-headline-sm text-on-surface">{hasCounter ? "Update your counter-offer" : "Suggest different terms"}</h2>
                  <p className="text-body-sm text-outline">Optional. The investor can accept your terms or reply in messages.</p>
                </div>
              </div>
              <div className="mt-space-md grid gap-space-md sm:grid-cols-3">
                <TermInput label="Amount" icon={Wallet} prefix="৳" value={amount} onChange={setAmount} min={10000} error={fields.amount?.[0]} />
                <TermInput label="Rate p.a." icon={Percent} suffix="%" value={rate} onChange={setRate} min={1} max={30} step={0.5} error={fields.rate?.[0]} />
                <TermInput label="Tenure" icon={CalendarDays} suffix="mo" value={tenure} onChange={setTenure} min={3} max={36} error={fields.tenureMonths?.[0]} />
              </div>
              <label className="mt-space-md block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Reason for counter-offer</span>
                <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the adjustment…" className="w-full rounded-xl border border-outline-variant px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
              </label>
              <div className="mt-space-md flex justify-end">
                <Button variant="soft" onClick={() => act("counter")} disabled={pending !== null}>
                  {pending === "counter" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Send counter-offer
                </Button>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-space-md">
          <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <h2 className="text-headline-sm text-on-surface">Decision console</h2>
            <p className="mt-space-sm text-body-sm text-on-surface-variant">
              {isOwner
                ? hasCounter
                  ? "Waiting for the investor to respond to your counter-offer."
                  : "Accepting agrees these terms and closes the request to other offers."
                : hasCounter
                  ? "The owner proposed new terms. Accept them to reach an agreement."
                  : "Waiting for the owner to respond. You can withdraw at any time."}
            </p>
            <div className="mt-space-md rounded-xl bg-surface-container-low p-space-md">
              <p className="text-label-sm text-outline">{hasCounter && !isOwner ? "Owner's proposal" : "Total offered"}</p>
              <p className="text-numeric-stat text-primary">{formatBDT(shownAmount)}</p>
              <div className="mt-space-sm"><ProgressBar value={Math.min(100, Math.round((shownAmount / loan.amount) * 100))} label="Of the request" /></div>
            </div>
            <div className="mt-space-md grid gap-space-sm">
              {((isOwner && !hasCounter) || (!isOwner && hasCounter)) && (
                <Button variant="secondary" onClick={() => act("accept")} disabled={pending !== null}>
                  {pending === "accept" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Handshake className="h-4 w-4" aria-hidden />}
                  {isOwner ? "Accept & proceed" : "Accept owner's terms"}
                </Button>
              )}
              {isOwner && hasCounter && (
                <p className="rounded-xl bg-surface-container-low p-space-sm text-center text-body-sm text-on-surface-variant">Your counter-offer is with {investor.name.split(" ")[0]}. You can revise it or decline.</p>
              )}
              <MessageButton participantId={counterpartId} variant="soft" className="w-full">
                <MessageSquareText className="h-4 w-4" aria-hidden /> Message {isOwner ? "investor" : "owner"}
              </MessageButton>
              <Button variant="ghost" className="text-error hover:bg-error-container" onClick={() => act(isOwner ? "decline" : "withdraw")} disabled={pending !== null}>
                {pending === "decline" || pending === "withdraw" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : isOwner ? (
                  <X className="h-4 w-4" aria-hidden />
                ) : (
                  <Undo2 className="h-4 w-4" aria-hidden />
                )}
                {isOwner ? "Decline offer" : "Withdraw offer"}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <ShieldCheck className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">One investor, one agreement</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">
              This is a direct offer between two verified members. You agree the terms together before any repayment begins.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TermInput({
  label,
  icon: Icon,
  prefix,
  suffix,
  value,
  onChange,
  min,
  max,
  step,
  error,
}: {
  label: string;
  icon: typeof Wallet;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-space-sm block text-label-sm font-bold text-outline">{label}</span>
      <span className={`flex items-center gap-2 rounded-xl border px-space-md py-3 transition-colors focus-within:border-primary ${error ? "border-error" : "border-outline-variant"}`}>
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {prefix && <span className="text-body-sm text-outline">{prefix}</span>}
        <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="w-full min-w-0 bg-transparent text-body-md text-on-surface outline-none" />
        {suffix && <span className="text-body-sm text-outline">{suffix}</span>}
      </span>
      {error && <span className="mt-1 block text-body-sm font-medium text-error">{error}</span>}
    </label>
  );
}
