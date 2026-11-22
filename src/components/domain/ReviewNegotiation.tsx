"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, Check, Clock3, Handshake, MessageSquareText, Percent, ShieldCheck, Wallet, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { businessById } from "@/data/businesses";
import { formatBDT } from "@/data/loans";
import { personById } from "@/data/users";
import type { LoanOffer, LoanRequest } from "@/data/types";

export function ReviewNegotiation({ offer, loan }: { offer: LoanOffer; loan: LoanRequest }) {
  const [amount, setAmount] = useState(String(offer.amount));
  const [rate, setRate] = useState(String(offer.rate));
  const [tenure, setTenure] = useState(String(offer.tenureMonths));
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"review" | "accepted" | "countered" | "declined">("review");

  const investor = personById(offer.investorId);
  const business = businessById(loan.businessId);
  if (!investor) return null;

  if (state !== "review") {
    const copy = {
      accepted: {
        title: "Offer accepted",
        text: `You and ${investor.name} have agreed to ${formatBDT(offer.amount)} at ${offer.rate}% p.a. over ${offer.tenureMonths} months. Generate the agreement to confirm the terms.`,
      },
      countered: {
        title: "Counter-offer sent",
        text: `Your proposed ${formatBDT(Number(amount) || 0)} at ${rate}% p.a. over ${tenure} months is with ${investor.name}. You can continue the conversation in messages.`,
      },
      declined: {
        title: "Offer declined",
        text: `${investor.name} has been notified. Your request stays open and you can review other offers at any time.`,
      },
    }[state];

    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-surface-container-lowest p-space-xl text-center card-shadow">
        <span className={`mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full ${state === "declined" ? "bg-error-container text-error" : "bg-success-container text-success"}`}>
          {state === "declined" ? <X className="h-8 w-8" aria-hidden /> : <Check className="h-8 w-8" aria-hidden />}
        </span>
        <h1 className="text-headline-lg text-on-surface">{copy.title}</h1>
        <p className="mx-auto mt-space-sm max-w-lg text-body-md text-on-surface-variant">{copy.text}</p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          {state === "accepted" && <LinkButton href={`/loans/${loan.id}/agreement`}>View agreement</LinkButton>}
          <LinkButton href="/messages" variant={state === "accepted" ? "outline" : "primary"}>Open messages</LinkButton>
          <LinkButton href="/business-dashboard" variant="ghost">Back to dashboard</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/business-dashboard" className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Incoming offer · #{offer.id.toUpperCase()}</p>
          <h1 className="mt-1 text-headline-lg text-on-surface">Review and negotiate terms</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">{loan.title} · {business?.name}</p>
        </div>
        <Badge tone="warning"><Clock3 className="h-3.5 w-3.5" aria-hidden /> Open for 48 hours</Badge>
      </div>

      <div className="mt-space-lg grid gap-space-lg lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-space-md">
          <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <div className="flex flex-wrap items-start justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <Avatar src={investor.avatar} alt={investor.name} size="lg" />
                <div>
                  <p className="text-headline-sm text-on-surface">{investor.name}</p>
                  <p className="text-body-sm text-outline">{investor.headline}</p>
                  <p className="mt-1 flex items-center gap-1 text-body-sm text-on-surface-variant"><Building2 className="h-3.5 w-3.5" aria-hidden /> {investor.connections} connections · {formatBDT(investor.committed ?? 0)} committed</p>
                </div>
              </div>
              <Link href={`/investors/${investor.id}`} className="text-label-md font-semibold text-primary hover:underline">View profile</Link>
            </div>

            <blockquote className="mt-space-md rounded-xl bg-surface-container-low p-space-md text-body-md italic text-on-surface-variant">
              “{offer.note}”
            </blockquote>

            <div className="mt-space-md overflow-hidden rounded-xl border border-surface-container-high">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-surface-container-low px-space-md py-space-sm text-label-sm font-bold uppercase tracking-wide text-outline">
                <span>Term</span>
                <span>Your request</span>
                <span>Offer</span>
              </div>
              {[
                { label: "Amount", request: formatBDT(loan.amount), offer: formatBDT(offer.amount) },
                { label: "Rate p.a.", request: `${loan.rate}%`, offer: `${offer.rate}%` },
                { label: "Tenure", request: `${loan.tenureMonths} months`, offer: `${offer.tenureMonths} months` },
                { label: "Repayment", request: loan.repaymentFrequency, offer: offer.frequency },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-[1.2fr_1fr_1fr] border-t border-surface-container-high px-space-md py-space-sm text-body-sm text-on-surface-variant">
                  <span>{row.label}</span>
                  <span>{row.request}</span>
                  <span className="font-bold text-primary">{row.offer}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <div className="flex items-center gap-space-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary"><Percent className="h-5 w-5" aria-hidden /></span>
              <div>
                <h2 className="text-headline-sm text-on-surface">Suggest different terms</h2>
                <p className="text-body-sm text-outline">Optional — send a counter-offer for review.</p>
              </div>
            </div>
            <div className="mt-space-md grid gap-space-md sm:grid-cols-3">
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Amount</span>
                <span className="flex items-center gap-2 rounded-xl border border-outline-variant px-space-md py-3 focus-within:border-primary">
                  <Wallet className="h-4 w-4 text-primary" aria-hidden />
                  <span className="text-body-sm text-outline">৳</span>
                  <input type="number" min={10000} value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
                </span>
              </label>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Rate p.a.</span>
                <span className="flex items-center gap-2 rounded-xl border border-outline-variant px-space-md py-3 focus-within:border-primary">
                  <Percent className="h-4 w-4 text-primary" aria-hidden />
                  <input type="number" min={1} max={30} step={0.5} value={rate} onChange={(event) => setRate(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
                  <span className="text-body-sm text-outline">%</span>
                </span>
              </label>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Tenure</span>
                <span className="flex items-center gap-2 rounded-xl border border-outline-variant px-space-md py-3 focus-within:border-primary">
                  <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                  <input type="number" min={3} max={36} value={tenure} onChange={(event) => setTenure(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
                </span>
              </label>
            </div>
            <label className="mt-space-md block">
              <span className="mb-space-sm block text-label-sm font-bold text-outline">Reason for counter-offer</span>
              <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the adjustment…" className="w-full rounded-xl border border-outline-variant px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
            </label>
            <div className="mt-space-md flex justify-end">
              <Button variant="soft" onClick={() => setState("countered")}>Send counter-offer</Button>
            </div>
          </section>
        </div>

        <aside className="space-y-space-md">
          <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
            <h2 className="text-headline-sm text-on-surface">Decision console</h2>
            <p className="mt-space-sm text-body-sm text-on-surface-variant">Review the direct terms before confirming.</p>
            <div className="mt-space-md rounded-xl bg-surface-container-low p-space-md">
              <p className="text-label-sm text-outline">Total offered</p>
              <p className="text-numeric-stat text-primary">{formatBDT(offer.amount)}</p>
              <div className="mt-space-sm"><ProgressBar value={Math.min(100, Math.round((offer.amount / loan.amount) * 100))} label="Of your request" /></div>
            </div>
            <div className="mt-space-md grid gap-space-sm">
              <Button variant="secondary" onClick={() => setState("accepted")}><Handshake className="h-4 w-4" aria-hidden /> Accept & proceed</Button>
              <Link href="/messages"><Button variant="soft" className="w-full"><MessageSquareText className="h-4 w-4" aria-hidden /> Message investor</Button></Link>
              <Button variant="ghost" className="text-error hover:bg-error-container" onClick={() => setState("declined")}><X className="h-4 w-4" aria-hidden /> Decline offer</Button>
            </div>
          </section>

          <section className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <ShieldCheck className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">One investor, one agreement</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">
              This is one investor making a direct offer to your business. You agree the terms together before any repayment begins.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
