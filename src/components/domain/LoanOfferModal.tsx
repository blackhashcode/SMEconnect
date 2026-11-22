"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Percent, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatBDT } from "@/data/loans";
import type { LoanRequest } from "@/data/types";

export function LoanOfferModal({
  loan,
  open,
  onClose,
}: {
  loan: LoanRequest;
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(loan.amount));
  const [rate, setRate] = useState(String(loan.rate));
  const [tenure, setTenure] = useState(String(loan.tenureMonths));
  const [frequency, setFrequency] = useState("Monthly");
  const [note, setNote] = useState("I'd like to support this verified business. Here is my proposed offer.");
  const [sent, setSent] = useState(false);

  function submit() {
    setSent(true);
  }

  function close() {
    setSent(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={sent ? "Offer sent" : "Make a loan offer"}
      description={sent ? undefined : `Your offer goes directly to the business owner for review.`}
      footer={
        sent ? (
          <Button onClick={close} className="w-full"><CheckCircle2 className="h-4 w-4" aria-hidden /> Done</Button>
        ) : (
          <div className="flex gap-space-sm">
            <Button variant="ghost" onClick={close} className="flex-1">Cancel</Button>
            <Button onClick={submit} variant="secondary" className="flex-1">Send offer</Button>
          </div>
        )
      }
    >
      {sent ? (
        <div className="py-space-lg text-center">
          <span className="mx-auto mb-space-md flex h-14 w-14 items-center justify-center rounded-full bg-success-container text-success">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <p className="text-headline-sm text-on-surface">Your offer is on its way</p>
          <p className="mt-space-sm text-body-md text-on-surface-variant">
            {formatBDT(Number(amount) || 0)} at {rate}% p.a. over {tenure} months. The owner can accept, decline or propose new terms.
          </p>
        </div>
      ) : (
        <div className="space-y-space-md">
          <div className="rounded-xl bg-surface-container-low p-space-md">
            <p className="text-label-sm text-outline">Request</p>
            <p className="mt-0.5 text-headline-sm text-on-surface">{loan.title}</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">Requested {formatBDT(loan.amount)} · {loan.tenureMonths} months · {loan.rate}% p.a.</p>
          </div>

          <div className="grid gap-space-md sm:grid-cols-2">
            <Field label="Offer amount" icon={Wallet} prefix="৳">
              <input type="number" min={10000} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
            </Field>
            <Field label="Rate (p.a.)" icon={Percent} suffix="%">
              <input type="number" min={1} max={30} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
            </Field>
            <Field label="Tenure" icon={CalendarDays} suffix="months">
              <input type="number" min={3} max={36} value={tenure} onChange={(e) => setTenure(e.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
            </Field>
            <label className="block">
              <span className="mb-space-sm block text-label-sm font-bold text-outline">Repayment</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none">
                <option>Monthly</option>
                <option>Bi-weekly</option>
                <option>Weekly</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-space-sm block text-label-sm font-bold text-outline">Message to the owner</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
          </label>

          <div className="rounded-xl bg-primary-fixed p-space-md text-body-sm text-on-primary-fixed">
            This is a direct loan offer between you and a verified business. Terms are agreed together and repayments are tracked on SME Connect.
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({
  label,
  icon: Icon,
  prefix,
  suffix,
  children,
}: {
  label: string;
  icon: typeof Wallet;
  prefix?: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-space-sm block text-label-sm font-bold text-outline">{label}</span>
      <span className="flex items-center gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 focus-within:border-primary">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {prefix && <span className="text-body-md text-outline">{prefix}</span>}
        {children}
        {suffix && <span className="shrink-0 text-body-sm text-outline">{suffix}</span>}
      </span>
    </label>
  );
}
