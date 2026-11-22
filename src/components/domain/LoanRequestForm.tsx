"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Check, CheckCircle2, CircleDollarSign, Clock3, FileCheck2, ShieldCheck, UploadCloud } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { businessByOwner } from "@/data/businesses";
import { formatBDT } from "@/data/loans";
import { personById } from "@/data/users";
import { images } from "@/data/images";
import { cn } from "@/lib/cn";

const purposes = ["Inventory & raw materials", "Equipment & machinery", "Expansion & fitting", "Festive marketing & packaging"];

export function LoanRequestForm({ ownerId = "nusrat" }: { ownerId?: string }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("150000");
  const [purpose, setPurpose] = useState(purposes[1]);
  const [story, setStory] = useState("Adding a second commercial deck oven and extra packaging capacity to fulfil festive gift-box orders across Dhaka.");
  const [tenure, setTenure] = useState("12");
  const [rate, setRate] = useState("10.5");
  const [frequency, setFrequency] = useState("Monthly");
  const [submitted, setSubmitted] = useState(false);

  const owner = personById(ownerId);
  const business = businessByOwner(ownerId);
  const totalRepayment = Math.round((Number(amount) || 0) * (1 + ((Number(rate) || 0) / 100) * ((Number(tenure) || 0) / 12)));

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-surface-container-lowest p-space-xl text-center card-shadow">
        <span className="mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success"><CheckCircle2 className="h-8 w-8" aria-hidden /></span>
        <h1 className="text-headline-lg text-on-surface">Loan request submitted for review</h1>
        <p className="mx-auto mt-space-sm max-w-lg text-body-md text-on-surface-variant">
          Your {formatBDT(Number(amount) || 0)} request for {purpose.toLowerCase()} is now in the verification queue. Verified investors will be able to make direct offers once approved.
        </p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <LinkButton href="/business-dashboard">Go to dashboard</LinkButton>
          <LinkButton href="/businesses/crave-co" variant="outline">View business profile</LinkButton>
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
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Loan request studio</p>
          <h1 className="mt-1 text-headline-lg text-on-surface">Tell investors what you need</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Clear numbers and honest context help you receive relevant direct offers.</p>
        </div>
        <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Identity verified</Badge>
      </div>

      <div className="mt-space-md grid gap-space-lg lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
          <div className="grid grid-cols-4 gap-space-sm border-b border-surface-container-high pb-space-md">
            {["Details", "Proof", "Terms", "Review"].map((label, index) => (
              <button key={label} type="button" onClick={() => setStep(index + 1)} className="text-center">
                <span className={cn("mx-auto flex h-8 w-8 items-center justify-center rounded-full text-label-sm font-bold", step >= index + 1 ? "bg-primary text-on-primary" : "bg-surface-container-high text-outline")}>{index + 1}</span>
                <span className={cn("mt-1 block text-[10px] font-semibold", step >= index + 1 ? "text-primary" : "text-outline")}>{label}</span>
              </button>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">1. Loan details</h2>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Amount needed</span>
                <span className="flex items-center gap-2 rounded-xl border border-outline-variant px-space-md py-3 focus-within:border-primary">
                  <CircleDollarSign className="h-4 w-4 text-primary" aria-hidden />
                  <span className="text-body-md text-outline">৳</span>
                  <input type="number" min={20000} max={300000} value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
                </span>
              </label>
              <div>
                <p className="mb-space-sm text-label-sm font-bold text-outline">Purpose</p>
                <div className="grid gap-space-sm sm:grid-cols-2">
                  {purposes.map((item) => (
                    <button key={item} type="button" onClick={() => setPurpose(item)} className={cn("rounded-xl border px-space-md py-3 text-left text-body-sm transition-colors", purpose === item ? "border-primary bg-primary-fixed font-semibold text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary")}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Story for investors</span>
                <textarea rows={5} maxLength={400} value={story} onChange={(event) => setStory(event.target.value)} className="w-full rounded-xl border border-outline-variant px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
                <span className="mt-1 block text-right text-[10px] text-outline">{story.length}/400</span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">2. Verification & proof</h2>
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary-fixed/40 p-space-lg text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-primary" aria-hidden />
                <p className="mt-space-sm text-label-md font-bold text-on-surface">Upload 90-day merchant statement</p>
                <p className="mt-1 text-body-sm text-on-surface-variant">bKash Merchant, Nagad Business or PDF bank statement · up to 15MB</p>
                <Button variant="soft" size="sm" className="mt-space-md">Browse files</Button>
              </div>
              <div className="flex items-center gap-space-sm rounded-xl bg-success-container p-space-md text-success">
                <FileCheck2 className="h-5 w-5" aria-hidden />
                <div>
                  <p className="text-label-md font-bold">bKash_Statement_Oct_Dec2024.pdf</p>
                  <p className="text-body-sm">Verified · 90-day turnover ৳482,000</p>
                </div>
              </div>
              {["NID identity verified", "Trade licence verified", "Social page ownership verified"].map((item) => (
                <div key={item} className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
                  <BadgeCheck className="h-4 w-4 text-success" aria-hidden /> {item}
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">3. Repayment terms</h2>
              <div>
                <p className="mb-space-sm text-label-sm font-bold text-outline">Tenure</p>
                <div className="grid grid-cols-3 gap-space-sm">
                  {["6", "12", "18"].map((item) => (
                    <button key={item} type="button" onClick={() => setTenure(item)} className={cn("rounded-xl border px-space-sm py-3 text-center text-body-sm", tenure === item ? "border-primary bg-primary-fixed font-bold text-primary" : "border-outline-variant text-on-surface-variant")}>{item} months</button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Offered rate (p.a.)</span>
                <span className="flex items-center gap-2 rounded-xl border border-outline-variant px-space-md py-3 focus-within:border-primary">
                  <input type="number" min={5} max={20} step={0.5} value={rate} onChange={(event) => setRate(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
                  <span className="text-body-sm text-outline">%</span>
                </span>
              </label>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Repayment frequency</span>
                <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none">
                  <option>Monthly</option>
                  <option>Bi-weekly</option>
                  <option>Weekly</option>
                </select>
              </label>
              <div className="rounded-xl bg-surface-container-low p-space-md">
                <p className="text-label-sm text-outline">Estimated total repayment</p>
                <p className="text-numeric-stat text-primary">{formatBDT(totalRepayment)}</p>
                <p className="mt-1 text-body-sm text-on-surface-variant">{formatBDT(Number(amount) || 0)} principal + {formatBDT(totalRepayment - (Number(amount) || 0))} agreed return</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">4. Review before submitting</h2>
              <dl className="grid gap-space-sm rounded-xl bg-surface-container-low p-space-md sm:grid-cols-2">
                <div><dt className="text-label-sm text-outline">Business</dt><dd className="text-label-md font-bold text-on-surface">{business?.name}</dd></div>
                <div><dt className="text-label-sm text-outline">Owner</dt><dd className="text-label-md font-bold text-on-surface">{owner?.name}</dd></div>
                <div><dt className="text-label-sm text-outline">Amount</dt><dd className="text-label-md font-bold text-on-surface">{formatBDT(Number(amount) || 0)}</dd></div>
                <div><dt className="text-label-sm text-outline">Purpose</dt><dd className="text-label-md font-bold text-on-surface">{purpose}</dd></div>
                <div><dt className="text-label-sm text-outline">Terms</dt><dd className="text-label-md font-bold text-on-surface">{tenure} months · {rate}% p.a. · {frequency}</dd></div>
                <div><dt className="text-label-sm text-outline">Total repayment</dt><dd className="text-label-md font-bold text-on-surface">{formatBDT(totalRepayment)}</dd></div>
              </dl>
              <p className="rounded-xl bg-primary-fixed p-space-md text-body-sm text-on-primary-fixed">
                Submitting sends this request for a 24-hour review. Verified investors can then send direct offers with their own terms.
              </p>
            </div>
          )}

          <div className="mt-space-lg flex items-center justify-between border-t border-surface-container-high pt-space-md">
            <Button variant="ghost" onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1}>Back</Button>
            {step < 4 ? (
              <Button onClick={() => setStep((value) => Math.min(4, value + 1))}>Continue</Button>
            ) : (
              <Button variant="secondary" onClick={() => setSubmitted(true)}>Submit request</Button>
            )}
          </div>
        </section>

        <aside className="space-y-space-md">
          <div className="overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
            <img src={images["artisan-workshop"]} alt="Workshop" className="h-32 w-full object-cover" />
            <div className="p-space-md">
              <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Live preview</p>
              <p className="mt-space-sm text-headline-sm text-on-surface">{purpose}</p>
              <p className="mt-1 line-clamp-3 text-body-sm text-on-surface-variant">{story}</p>
              <div className="mt-space-md grid grid-cols-2 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
                <div><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(Number(amount) || 0)}</p></div>
                <div><p className="text-label-sm text-outline">Rate</p><p className="text-label-md font-bold text-success">{rate}% p.a.</p></div>
              </div>
              <div className="mt-space-md flex items-center gap-2 text-body-sm text-outline"><Clock3 className="h-4 w-4" aria-hidden /> {tenure} months · {frequency}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-success-container p-space-md text-success">
            <Check className="h-5 w-5" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Pre-screening ready</p>
            <p className="mt-1 text-body-sm">Identity, trade licence and turnover checks are complete.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
