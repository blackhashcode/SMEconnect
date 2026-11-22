"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Check, CheckCircle2, CircleDollarSign, Clock3, Hourglass, LoaderCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Photo } from "@/components/ui/Photo";
import { FormAlert } from "@/components/auth/FormField";
import { postJson, type FieldErrors } from "@/lib/client-api";
import { formatBDT, repaymentPlan } from "@/lib/format";
import type { Business, LoanRequestView, SessionUser } from "@/data/types";
import { cn } from "@/lib/cn";

const purposes = ["Inventory & raw materials", "Equipment & machinery", "Expansion & fitting", "Festive marketing & packaging"];
const steps = ["Details", "Proof", "Terms", "Review"];
/** Which step each API field lives on, so validation errors jump to the right place. */
const fieldStep: Record<string, number> = { title: 1, amount: 1, purpose: 1, description: 1, tenureMonths: 3, rate: 3, repaymentFrequency: 3 };

const inputClass = (error?: string) =>
  cn("flex items-center gap-2 rounded-xl border px-space-md py-3 transition-colors focus-within:border-primary", error ? "border-error" : "border-outline-variant");

export function LoanRequestForm({ owner, business }: { owner: SessionUser; business: Business }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("150000");
  const [purpose, setPurpose] = useState(purposes[1]);
  const [story, setStory] = useState("");
  const [tenure, setTenure] = useState("12");
  const [rate, setRate] = useState("10.5");
  const [frequency, setFrequency] = useState("Monthly");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [created, setCreated] = useState<LoanRequestView | null>(null);

  const plan = repaymentPlan(Number(amount) || 0, Number(rate) || 0, Number(tenure) || 0, frequency);

  async function submit() {
    setPending(true);
    setError(null);
    setFields({});
    const result = await postJson<{ loan: LoanRequestView }>("/api/loans", {
      title,
      purpose,
      description: story,
      amount: Number(amount),
      rate: Number(rate),
      tenureMonths: Number(tenure),
      repaymentFrequency: frequency,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields);
      const firstBad = Object.keys(result.fields).map((key) => fieldStep[key]).filter(Boolean).sort()[0];
      if (firstBad) setStep(firstBad);
      return;
    }
    setCreated(result.data.loan);
    router.refresh();
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl animate-scale-in rounded-3xl bg-surface-container-lowest p-space-xl text-center card-shadow">
        <span className="mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success"><CheckCircle2 className="h-8 w-8" aria-hidden /></span>
        <h1 className="text-headline-lg text-on-surface">Your loan request is live</h1>
        <p className="mx-auto mt-space-sm max-w-lg text-body-md text-on-surface-variant">
          “{created.title}” for {formatBDT(created.amount)} is now visible to verified investors, who can send you direct offers.
        </p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <LinkButton href="/business-dashboard">Go to dashboard</LinkButton>
          <LinkButton href={`/businesses/${business.id}`} variant="outline">View on your profile</LinkButton>
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
        {business.verified ? (
          <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Identity verified</Badge>
        ) : (
          <Badge tone="warning"><Hourglass className="h-3.5 w-3.5" aria-hidden /> Verification in progress</Badge>
        )}
      </div>

      <div className="mt-space-md grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
          <div className="grid grid-cols-4 gap-space-sm border-b border-surface-container-high pb-space-md">
            {steps.map((label, index) => (
              <button key={label} type="button" onClick={() => setStep(index + 1)} className="group text-center">
                <span className={cn("mx-auto flex h-8 w-8 items-center justify-center rounded-full text-label-sm font-bold transition-colors duration-300", step >= index + 1 ? "bg-primary text-on-primary" : "bg-surface-container-high text-outline group-hover:bg-surface-container-highest")}>{index + 1}</span>
                <span className={cn("mt-1 block text-[10px] font-semibold", step >= index + 1 ? "text-primary" : "text-outline")}>{label}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-space-md">
              <FormAlert>{error}</FormAlert>
            </div>
          )}

          {step === 1 && (
            <div key="s1" className="animate-fade-in space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">1. Loan details</h2>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Request title</span>
                <span className={inputClass(fields.title?.[0])}>
                  <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Second deck oven for festive orders" className="w-full bg-transparent text-body-md text-on-surface outline-none placeholder:text-outline" />
                </span>
                {fields.title?.[0] && <span className="mt-1 block text-body-sm font-medium text-error">{fields.title[0]}</span>}
              </label>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Amount needed</span>
                <span className={inputClass(fields.amount?.[0])}>
                  <CircleDollarSign className="h-4 w-4 text-primary" aria-hidden />
                  <span className="text-body-md text-outline">৳</span>
                  <input type="number" min={10000} value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
                </span>
                {fields.amount?.[0] && <span className="mt-1 block text-body-sm font-medium text-error">{fields.amount[0]}</span>}
              </label>
              <div>
                <p className="mb-space-sm text-label-sm font-bold text-outline">Purpose</p>
                <div className="grid gap-space-sm sm:grid-cols-2">
                  {purposes.map((item) => (
                    <button key={item} type="button" onClick={() => setPurpose(item)} aria-pressed={purpose === item} className={cn("rounded-xl border px-space-md py-3 text-left text-body-sm transition-all duration-200 active:scale-[0.98]", purpose === item ? "border-primary bg-primary-fixed font-semibold text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary")}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Story for investors</span>
                <textarea rows={5} maxLength={2000} value={story} onChange={(event) => setStory(event.target.value)} placeholder="What will the money pay for, and how will repayments be covered?" className={cn("w-full rounded-xl border px-space-md py-3 text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none", fields.description?.[0] ? "border-error" : "border-outline-variant")} />
                <span className="mt-1 flex justify-between text-[10px] text-outline">
                  <span className="text-body-sm font-medium text-error">{fields.description?.[0]}</span>
                  <span>{story.length}/2000</span>
                </span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div key="s2" className="animate-fade-in space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">2. Verification & proof</h2>
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary-fixed/40 p-space-lg text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-primary" aria-hidden />
                <p className="mt-space-sm text-label-md font-bold text-on-surface">Merchant statement upload</p>
                <p className="mt-1 text-body-sm text-on-surface-variant">Document upload is coming soon. Investors may ask for statements in messages after you connect.</p>
              </div>
              {[
                { label: "NID identity", done: business.verified },
                { label: "Trade licence", done: business.verified },
                { label: "Business profile created", done: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
                  {item.done ? <BadgeCheck className="h-4 w-4 text-success" aria-hidden /> : <Hourglass className="h-4 w-4 text-warning" aria-hidden />}
                  {item.label} · {item.done ? "verified" : "pending review"}
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div key="s3" className="animate-fade-in space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">3. Repayment terms</h2>
              <div>
                <p className="mb-space-sm text-label-sm font-bold text-outline">Tenure</p>
                <div className="grid grid-cols-3 gap-space-sm sm:grid-cols-5">
                  {["6", "9", "12", "18", "24"].map((item) => (
                    <button key={item} type="button" onClick={() => setTenure(item)} aria-pressed={tenure === item} className={cn("rounded-xl border px-space-sm py-3 text-center text-body-sm transition-all duration-200 active:scale-[0.97]", tenure === item ? "border-primary bg-primary-fixed font-bold text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary")}>{item} months</button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-space-sm block text-label-sm font-bold text-outline">Offered rate (p.a.)</span>
                <span className={inputClass(fields.rate?.[0])}>
                  <input type="number" min={1} max={30} step={0.5} value={rate} onChange={(event) => setRate(event.target.value)} className="w-full bg-transparent text-body-md text-on-surface outline-none" />
                  <span className="text-body-sm text-outline">%</span>
                </span>
                {fields.rate?.[0] && <span className="mt-1 block text-body-sm font-medium text-error">{fields.rate[0]}</span>}
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
                <p className="text-numeric-stat text-primary">{formatBDT(plan.total)}</p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {formatBDT(Number(amount) || 0)} principal + {formatBDT(plan.total - (Number(amount) || 0))} agreed return · {plan.cycles} payments of about {formatBDT(plan.installment)}
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div key="s4" className="animate-fade-in space-y-space-md pt-space-md">
              <h2 className="text-headline-sm text-on-surface">4. Review before submitting</h2>
              <dl className="grid gap-space-sm rounded-xl bg-surface-container-low p-space-md sm:grid-cols-2">
                <div className="sm:col-span-2"><dt className="text-label-sm text-outline">Title</dt><dd className="text-label-md font-bold text-on-surface">{title || <span className="text-error">Missing, add one in step 1</span>}</dd></div>
                <div><dt className="text-label-sm text-outline">Business</dt><dd className="text-label-md font-bold text-on-surface">{business.name}</dd></div>
                <div><dt className="text-label-sm text-outline">Owner</dt><dd className="text-label-md font-bold text-on-surface">{owner.name}</dd></div>
                <div><dt className="text-label-sm text-outline">Amount</dt><dd className="text-label-md font-bold text-on-surface">{formatBDT(Number(amount) || 0)}</dd></div>
                <div><dt className="text-label-sm text-outline">Purpose</dt><dd className="text-label-md font-bold text-on-surface">{purpose}</dd></div>
                <div><dt className="text-label-sm text-outline">Terms</dt><dd className="text-label-md font-bold text-on-surface">{tenure} months · {rate}% p.a. · {frequency}</dd></div>
                <div><dt className="text-label-sm text-outline">Total repayment</dt><dd className="text-label-md font-bold text-on-surface">{formatBDT(plan.total)}</dd></div>
              </dl>
              <p className="rounded-xl bg-primary-fixed p-space-md text-body-sm text-on-primary-fixed">
                Submitting publishes this request to verified investors, who can then send direct offers with their own terms.
              </p>
            </div>
          )}

          <div className="mt-space-lg flex items-center justify-between border-t border-surface-container-high pt-space-md">
            <Button variant="ghost" onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1}>Back</Button>
            {step < 4 ? (
              <Button onClick={() => setStep((value) => Math.min(4, value + 1))}>Continue</Button>
            ) : (
              <Button variant="secondary" onClick={submit} disabled={pending}>
                {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
                {pending ? "Publishing…" : "Submit request"}
              </Button>
            )}
          </div>
        </section>

        <aside className="space-y-space-md">
          <div className="overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
            <Photo src={business.image} alt="" className="h-32 w-full" sizes="360px" />
            <div className="p-space-md">
              <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Live preview</p>
              <p className="mt-space-sm text-headline-sm text-on-surface">{title || purpose}</p>
              <p className="mt-1 line-clamp-3 text-body-sm text-on-surface-variant">{story || "Your story for investors will appear here."}</p>
              <div className="mt-space-md grid grid-cols-2 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
                <div><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(Number(amount) || 0)}</p></div>
                <div><p className="text-label-sm text-outline">Rate</p><p className="text-label-md font-bold text-success">{rate}% p.a.</p></div>
              </div>
              <div className="mt-space-md flex items-center gap-2 text-body-sm text-outline"><Clock3 className="h-4 w-4" aria-hidden /> {tenure} months · {frequency}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-success-container p-space-md text-success">
            <Check className="h-5 w-5" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Direct offers only</p>
            <p className="mt-1 text-body-sm">Investors send you their own terms. You choose which offer to accept, negotiate or decline.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
