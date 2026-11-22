import { ArrowLeft, BadgeCheck, CalendarDays, Check, CircleDollarSign, FileSignature, Fingerprint, Hourglass, Percent, Repeat2, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AgreementActions } from "@/components/domain/AgreementActions";
import { formatBDT, repaymentPlan } from "@/lib/format";
import { getAgreement } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/ui/Avatar";
import { Photo } from "@/components/ui/Photo";

export const metadata = { title: "Loan agreement" };

export default async function LoanAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [viewer, agreement] = await Promise.all([requireUser(), getAgreement(id)]);
  // Only the business owner and the investor on the deal can see it.
  if (!agreement) notFound();

  const { loan, offer: deal } = agreement;
  const { business, owner } = loan;
  const investor = deal.investor;
  const agreed = agreement.status === "agreed";
  const viewerSide = viewer.id === owner.id ? "owner" : "investor";
  // While negotiating, the owner's counter (if it's the latest move) is what's on the table.
  const ownerCountered = !agreed && deal.lastActionBy === "owner" && deal.counter;
  const offer = ownerCountered && deal.counter ? { ...deal, ...deal.counter } : deal;
  const { installment, cycles } = repaymentPlan(offer.amount, offer.rate, offer.tenureMonths, offer.frequency);
  // Whoever didn't make the latest move confirms: the owner accepts the investor's terms, the investor accepts a counter.
  const canConfirm = !agreed && (viewerSide === "owner" ? !ownerCountered : Boolean(ownerCountered));
  const backHref = viewerSide === "owner" ? "/business-dashboard" : "/investor-dashboard";

  return (
    <>
      <Link href={backHref} className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>

      <div className="overflow-hidden rounded-3xl bg-surface-container-lowest card-shadow">
        <div className="bg-gradient-to-r from-primary via-primary-container to-secondary-container px-space-lg py-space-xl text-on-primary">
          <div className="flex flex-wrap items-center justify-between gap-space-md">
            <div>
              {agreed ? (
                <Badge tone="success" className="bg-white/15 text-white"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Agreed</Badge>
              ) : (
                <Badge tone="warning" className="bg-white/15 text-white"><Hourglass className="h-3.5 w-3.5" aria-hidden /> Draft · awaiting confirmation</Badge>
              )}
              <h1 className="mt-space-md text-headline-lg">{agreed ? "Loan agreement" : "Draft loan agreement"}</h1>
              <p className="mt-1 max-w-2xl text-body-md text-on-primary/85">{loan.title} · {business.name}</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-space-lg py-space-md text-center">
              <p className="text-label-sm uppercase tracking-wide text-white/70">Agreement ID</p>
              <p className="mt-1 text-headline-sm">SME-{deal.id.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-space-lg p-space-lg lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="space-y-space-md">
            <section className="grid gap-space-md sm:grid-cols-2">
              <div className="flex gap-space-md rounded-2xl bg-surface-container-low p-space-md">
                <Avatar src={owner.avatar} alt={owner.name} size="lg" />
                <div><p className="text-label-sm text-outline">Borrower</p><p className="text-headline-sm text-on-surface">{owner.name}</p><p className="text-body-sm text-outline">{business.name}</p>{owner.verified && <Badge tone="success" className="mt-1">Verified</Badge>}</div>
              </div>
              <div className="flex gap-space-md rounded-2xl bg-surface-container-low p-space-md">
                <Avatar src={investor.avatar} alt={investor.name} size="lg" />
                <div><p className="text-label-sm text-outline">Investor</p><p className="text-headline-sm text-on-surface">{investor.name}</p><p className="text-body-sm text-outline">{investor.headline}</p>{investor.verified && <Badge tone="success" className="mt-1">Verified</Badge>}</div>
              </div>
            </section>

            <section className="rounded-2xl border border-surface-container-high p-space-lg">
              <div className="flex items-center gap-space-sm"><FileSignature className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Agreed terms</h2></div>
              <div className="mt-space-md grid gap-space-md sm:grid-cols-2 xl:grid-cols-3">
                {[
                  { icon: CircleDollarSign, label: "Principal", value: formatBDT(offer.amount), hint: "Paid directly to the business" },
                  { icon: Percent, label: "Agreed rate", value: `${offer.rate}% p.a.`, hint: "Fixed for the full term" },
                  { icon: CalendarDays, label: "Tenure", value: `${offer.tenureMonths} months`, hint: `${cycles} ${offer.frequency.toLowerCase()} instalments` },
                  { icon: Repeat2, label: "Instalment", value: formatBDT(installment), hint: offer.frequency },
                  { icon: Wallet, label: "Repayment method", value: "Tracked transfer", hint: "Recorded in both dashboards" },
                  { icon: BadgeCheck, label: "Early repayment", value: "Allowed", hint: "No early settlement penalty" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-surface-container-low p-space-md">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden />
                    <p className="mt-space-sm text-label-sm text-outline">{item.label}</p>
                    <p className="text-label-md font-bold text-on-surface">{item.value}</p>
                    <p className="mt-0.5 text-body-sm text-outline">{item.hint}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-surface-container-high p-space-lg">
              <h2 className="text-headline-sm text-on-surface">Repayment roadmap</h2>
              <p className="mt-1 text-body-sm text-outline">First instalment due 14 days after the agreed start date.</p>
              <div className="mt-space-md grid gap-space-sm sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: Math.min(cycles, 6) }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between rounded-xl bg-surface-container-low px-space-md py-space-sm">
                    <div className="flex items-center gap-space-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-fixed text-label-sm font-bold text-primary">{index + 1}</span><span className="text-body-sm text-on-surface-variant">Cycle {index + 1}</span></div>
                    <span className="text-label-md font-bold text-on-surface">{formatBDT(installment)}</span>
                  </div>
                ))}
              </div>
              {cycles > 6 && <p className="mt-space-sm text-body-sm text-outline">+ {cycles - 6} more instalments through month {offer.tenureMonths}</p>}
              <ProgressBar value={12} className="mt-space-md" showValue={false} />
            </section>
          </div>

          <aside className="space-y-space-md">
            <div className="overflow-hidden rounded-2xl bg-surface-container-low">
              <Photo src={loan.image || business.image} alt="" className="h-40 w-full" sizes="400px" />
              <div className="p-space-md">
                <p className="text-label-sm font-bold uppercase tracking-wider text-outline">Digital signatures</p>
                <div className="mt-space-md flex items-start gap-space-sm">
                  <Fingerprint className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <div><p className="text-label-md font-bold text-on-surface">Borrower</p><p className="text-body-sm text-outline">{agreed ? "Confirmed" : ownerCountered ? "Proposed these terms" : "Awaiting confirmation"}</p></div>
                  <Check className={`ml-auto h-4 w-4 ${agreed || ownerCountered ? "text-success" : "text-outline"}`} aria-hidden />
                </div>
                <div className="mt-space-md flex items-start gap-space-sm">
                  <Fingerprint className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <div><p className="text-label-md font-bold text-on-surface">Investor</p><p className="text-body-sm text-outline">{agreed ? "Confirmed" : ownerCountered ? "Awaiting confirmation" : "Offered these terms"}</p></div>
                  <Check className={`ml-auto h-4 w-4 ${agreed || !ownerCountered ? "text-success" : "text-outline"}`} aria-hidden />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-primary-fixed p-space-md text-on-primary-fixed">
              <ShieldCheck className="h-6 w-6" aria-hidden />
              <p className="mt-space-sm text-label-md font-bold">Direct agreement</p>
              <p className="mt-1 text-body-sm text-on-primary-fixed/80">Funds, terms and repayment records stay between the verified borrower and investor.</p>
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
              <p className="text-label-sm font-bold uppercase tracking-wider text-outline">Documents</p>
              <p className="mt-space-sm text-body-sm text-on-surface-variant">Use “Save as PDF” below to keep a copy of these terms.</p>
            </div>
          </aside>
        </div>

        <div className="border-t border-surface-container-high bg-surface-container-low px-space-lg py-space-md">
          <AgreementActions offerId={deal.id} agreed={agreed} canConfirm={canConfirm} counterpartId={viewerSide === "owner" ? investor.id : owner.id} counterpartLabel={viewerSide === "owner" ? "investor" : "owner"} waitingOn={viewerSide === "owner" ? investor.name : owner.name} />
        </div>
      </div>
    </>
  );
}
