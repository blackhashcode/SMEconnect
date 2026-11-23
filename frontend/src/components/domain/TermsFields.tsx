"use client";

import { CalendarDays, Percent, Wallet } from "lucide-react";
import { FREQUENCIES, FREQUENCY_LABEL, tenureLabel } from "@/lib/loans";
import { fieldError, type FieldErrors } from "@/lib/client-api";
import type { RepaymentFrequency } from "@/data/types";
import { cn } from "@/lib/cn";

export type Terms = { amount: string; rate: string; tenureDays: string; frequency: RepaymentFrequency };

export const TENURE_OPTIONS = [30, 60, 90, 120, 180, 270, 365];

/** Amount, rate, tenure and frequency inputs shared by offers, counters and loan requests. */
export function TermsFields({
  value,
  onChange,
  fields,
  names = { amount: "amountBdt", rate: "interestRatePct", tenureDays: "tenureDays", frequency: "repaymentFrequency" },
}: {
  value: Terms;
  onChange: (next: Terms) => void;
  fields: FieldErrors;
  /** API field names, so server validation errors land on the right input. */
  names?: Record<keyof Terms, string>;
}) {
  const set = (key: keyof Terms) => (event: { target: { value: string } }) => onChange({ ...value, [key]: event.target.value });
  const box = (error?: string) =>
    cn("flex items-center gap-space-sm rounded-xl border bg-surface-container-lowest px-space-md py-3 transition-colors focus-within:border-primary", error ? "border-error" : "border-outline-variant");
  const errors = {
    amount: fieldError(fields, names.amount),
    rate: fieldError(fields, names.rate),
    tenureDays: fieldError(fields, names.tenureDays),
    frequency: fieldError(fields, names.frequency),
  };

  return (
    <div className="grid gap-space-md sm:grid-cols-2">
      <label className="block">
        <span className="mb-space-sm block text-label-sm font-bold text-outline">Amount</span>
        <span className={box(errors.amount)}>
          <Wallet className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="text-body-md text-outline">৳</span>
          <input type="number" inputMode="numeric" min={1000} step={1000} value={value.amount} onChange={set("amount")} className="w-full min-w-0 bg-transparent text-body-md text-on-surface outline-none" />
        </span>
        {errors.amount && <span className="mt-1 block text-body-sm font-medium text-error">{errors.amount}</span>}
      </label>
      <label className="block">
        <span className="mb-space-sm block text-label-sm font-bold text-outline">Interest rate (per year)</span>
        <span className={box(errors.rate)}>
          <Percent className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <input type="number" inputMode="decimal" min={0} max={100} step={0.5} value={value.rate} onChange={set("rate")} className="w-full min-w-0 bg-transparent text-body-md text-on-surface outline-none" />
          <span className="text-body-sm text-outline">%</span>
        </span>
        {errors.rate && <span className="mt-1 block text-body-sm font-medium text-error">{errors.rate}</span>}
      </label>
      <label className="block">
        <span className="mb-space-sm block text-label-sm font-bold text-outline">Tenure</span>
        <span className={box(errors.tenureDays)}>
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <select value={value.tenureDays} onChange={set("tenureDays")} className="w-full bg-transparent text-body-md text-on-surface outline-none">
            {TENURE_OPTIONS.map((days) => (
              <option key={days} value={days}>{tenureLabel(days)}</option>
            ))}
          </select>
        </span>
        {errors.tenureDays && <span className="mt-1 block text-body-sm font-medium text-error">{errors.tenureDays}</span>}
      </label>
      <label className="block">
        <span className="mb-space-sm block text-label-sm font-bold text-outline">Repayment</span>
        <span className={box(errors.frequency)}>
          <select value={value.frequency} onChange={set("frequency")} className="w-full bg-transparent text-body-md text-on-surface outline-none">
            {FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>{FREQUENCY_LABEL[frequency]}</option>
            ))}
          </select>
        </span>
      </label>
    </div>
  );
}

/** Converts the inputs to the API's term fields. */
export const termsBody = (terms: Terms) => ({
  amountBdt: Math.round(Number(terms.amount)),
  interestRatePct: Number(terms.rate),
  tenureDays: Number(terms.tenureDays),
  repaymentFrequency: terms.frequency,
});
