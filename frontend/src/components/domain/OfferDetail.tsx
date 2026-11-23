"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, Handshake, LoaderCircle, MessageSquareText, Undo2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormAlert } from "@/components/auth/FormField";
import { MessageButton } from "./MessageButton";
import { TermsFields, termsBody, TENURE_OPTIONS, type Terms } from "./TermsFields";
import { api, type FieldErrors } from "@/lib/client-api";
import { formatBDT } from "@/lib/format";
import { FREQUENCY_LABEL, OFFER_STATUS, tenureLabel } from "@/lib/loans";
import { partyPerson } from "@/lib/backend/mappers";
import { profileHref } from "@/lib/profile";
import type { Offer } from "@/data/types";

type Action = "accept" | "reject" | "withdraw" | "counter";

/**
 * One offer as either party sees it. Whoever didn't propose the current terms
 * may accept, reject or counter; whoever proposed them may withdraw. A counter
 * creates a new linked offer, so the page moves to it.
 */
export function OfferDetail({ offer, viewerId, loanId, nextOfferId }: { offer: Offer; viewerId: string; loanId: string | null; nextOfferId: string | null }) {
  const router = useRouter();
  const myRole = viewerId === offer.investor.id ? "INVESTOR" : "OWNER";
  const counterpart = myRole === "INVESTOR" ? offer.owner : offer.investor;
  const pendingOffer = offer.status === "PENDING";
  const iProposed = offer.proposedBy === myRole;
  const canRespond = pendingOffer && !iProposed;
  const canWithdraw = pendingOffer && iProposed;
  const status = OFFER_STATUS[offer.status];
  const backHref = myRole === "OWNER" ? "/business-dashboard" : "/investor-dashboard";

  const [countering, setCountering] = useState(false);
  const [terms, setTerms] = useState<Terms>({
    amount: String(offer.amountBdt),
    rate: String(Number(offer.interestRatePct)),
    tenureDays: String(TENURE_OPTIONS.includes(offer.tenureDays) ? offer.tenureDays : 90),
    frequency: offer.repaymentFrequency,
  });
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  async function act(action: Action) {
    if (action === "reject" && !window.confirm("Reject this offer? The other side will be notified.")) return;
    if (action === "withdraw" && !window.confirm("Withdraw your offer?")) return;
    setPending(action);
    setError(null);
    setFields({});
    const path = `/offers/${offer.id}/${action}`;
    const result =
      action === "counter"
        ? await api.post<Offer>(path, { ...termsBody(terms), message: note.trim() || undefined })
        : action === "accept"
          ? await api.post<{ loanId: string }>(path)
          : await api.post<Offer>(path, note.trim() ? { note: note.trim() } : {});
    setPending(null);
    if (!result.ok) {
      setError(result.code === "VALIDATION_ERROR" ? "Please check the highlighted terms." : result.error);
      setFields(result.fields);
      return;
    }
    if (action === "accept") router.push(`/loans/${(result.data as { loanId: string }).loanId}`);
    else if (action === "counter") router.push(`/offers/${(result.data as Offer).id}`);
    else router.refresh();
  }

  const rows = [
    { label: "Amount", request: formatBDT(offer.loanRequest.amountBdt), offer: formatBDT(offer.amountBdt) },
    { label: "Tenure", request: tenureLabel(offer.loanRequest.tenureDays), offer: tenureLabel(offer.tenureDays) },
    { label: "Interest rate", request: "—", offer: `${Number(offer.interestRatePct)}% p.a.` },
    { label: "Repayment", request: "—", offer: FREQUENCY_LABEL[offer.repaymentFrequency] },
  ];

  return (
    <div>
      <Link href={backHref} className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">
            {offer.proposedBy === "OWNER" ? "Counter-offer from the business" : "Offer from the investor"}
          </p>
          <h1 className="mt-1 text-headline-lg text-on-surface">{offer.loanRequest.purpose}</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">{offer.owner.shopName ?? offer.owner.name}</p>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <Badge tone={status.tone}>{status.label}</Badge>
          {pendingOffer && (
            <Badge tone={canRespond ? "secondary" : "neutral"}>
              <Clock3 className="h-3.5 w-3.5" aria-hidden /> {canRespond ? "Your turn" : `Waiting for ${counterpart.name.split(" ")[0]}`}
            </Badge>
          )}
        </div>
      </div>

      {error && <div className="mt-space-md"><FormAlert>{error}</FormAlert></div>}

      <div className="mt-space-lg grid gap-space-lg lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-space-md">
          <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <div className="flex flex-wrap items-start justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <Avatar src={counterpart.image ?? ""} alt={counterpart.name} size="lg" />
                <div>
                  <p className="text-headline-sm text-on-surface">{counterpart.name}</p>
                  <p className="text-body-sm text-outline">{counterpart.shopName ?? (counterpart.role === "INVESTOR" ? "Investor" : "Business owner")}</p>
                </div>
              </div>
              <Link href={profileHref(partyPerson(counterpart))} className="text-label-md font-semibold text-primary hover:underline">View profile</Link>
            </div>
            {offer.message && <blockquote className="mt-space-md rounded-xl bg-surface-container-low p-space-md text-body-md italic text-on-surface-variant">“{offer.message}”</blockquote>}
            <div className="mt-space-md overflow-x-auto rounded-xl border border-surface-container-high">
              <div className="grid min-w-[360px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] bg-surface-container-low px-space-md py-space-sm text-label-sm font-bold uppercase tracking-wide text-outline">
                <span>Term</span>
                <span>Request</span>
                <span>This offer</span>
              </div>
              {rows.map((row) => (
                <div key={row.label} className="grid min-w-[360px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] border-t border-surface-container-high px-space-md py-space-sm text-body-sm text-on-surface-variant">
                  <span>{row.label}</span>
                  <span>{row.request}</span>
                  <span className="font-bold text-primary">{row.offer}</span>
                </div>
              ))}
            </div>
          </section>

          {canRespond && countering && (
            <section className="animate-fade-in rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
              <h2 className="text-headline-sm text-on-surface">Propose different terms</h2>
              <p className="mt-1 text-body-sm text-outline">This replaces the current offer. {counterpart.name.split(" ")[0]} can then accept, reject or counter again.</p>
              <div className="mt-space-md">
                <TermsFields value={terms} onChange={setTerms} fields={fields} />
              </div>
              <label className="mt-space-md block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Message (optional)</span>
                <textarea rows={3} maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the change…" className="w-full rounded-xl border border-outline-variant px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
              </label>
              <div className="mt-space-md flex justify-end gap-space-sm">
                <Button variant="ghost" onClick={() => setCountering(false)}>Cancel</Button>
                <Button variant="secondary" onClick={() => act("counter")} disabled={pending !== null}>
                  {pending === "counter" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Send counter-offer
                </Button>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-space-md">
          <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <h2 className="text-headline-sm text-on-surface">What happens next</h2>
            <p className="mt-space-sm text-body-sm text-on-surface-variant">
              {offer.status === "ACCEPTED"
                ? "Accepted. Both of you confirm the agreement, then repayments start."
                : offer.status === "COUNTERED"
                  ? "These terms were replaced by a counter-offer."
                  : canRespond
                    ? "Accepting creates a loan agreement for both of you to confirm. It also closes the request to other offers."
                    : canWithdraw
                      ? `Waiting for ${counterpart.name.split(" ")[0]} to respond. You can withdraw at any time.`
                      : "This offer is no longer active."}
            </p>
            <div className="mt-space-md grid gap-space-sm">
              {offer.status === "ACCEPTED" && loanId && (
                <LinkButton href={`/loans/${loanId}`} variant="secondary">View agreement <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
              )}
              {offer.status === "COUNTERED" && nextOfferId && (
                <LinkButton href={`/offers/${nextOfferId}`} variant="secondary">See the counter-offer <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
              )}
              {canRespond && (
                <>
                  <Button variant="secondary" onClick={() => act("accept")} disabled={pending !== null}>
                    {pending === "accept" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Handshake className="h-4 w-4" aria-hidden />} Accept offer
                  </Button>
                  {!countering && (
                    <Button variant="soft" onClick={() => setCountering(true)} disabled={pending !== null}>
                      <Check className="h-4 w-4" aria-hidden /> Counter with new terms
                    </Button>
                  )}
                  <Button variant="ghost" className="text-error hover:bg-error-container" onClick={() => act("reject")} disabled={pending !== null}>
                    {pending === "reject" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />} Reject
                  </Button>
                </>
              )}
              {canWithdraw && (
                <Button variant="ghost" className="text-error hover:bg-error-container" onClick={() => act("withdraw")} disabled={pending !== null}>
                  {pending === "withdraw" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />} Withdraw offer
                </Button>
              )}
              <MessageButton participantId={counterpart.id} variant="outline" className="w-full">
                <MessageSquareText className="h-4 w-4" aria-hidden /> Message {counterpart.name.split(" ")[0]}
              </MessageButton>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
