/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarDays, Check, CheckCircle2, Clock3, FilePlus2, Handshake, MessageCircle, PiggyBank, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { OfferCard } from "@/components/domain/OfferCard";
import { businessByOwner } from "@/data/businesses";
import { businessMilestones } from "@/data/dashboard";
import { formatBDT, loanRequests } from "@/data/loans";
import { offersForRequest } from "@/data/offers";
import { personById } from "@/data/users";

export const metadata = { title: "Business dashboard" };

export default function BusinessDashboardPage() {
  const owner = personById("nusrat");
  const business = businessByOwner("nusrat");
  const loan = loanRequests[0];
  const offers = offersForRequest(loan.id);
  const installment = 4003;

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <Avatar src={owner?.avatar ?? ""} alt={owner?.name ?? "Owner"} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-lg text-on-surface">Welcome back, {owner?.name.split(" ")[0]}</h1>
              {owner?.verified && <VerifiedBadge />}
            </div>
            <p className="mt-1 text-body-md text-on-surface-variant">{business?.name} · {business?.category} · {business?.location}</p>
            <div className="mt-space-sm flex flex-wrap gap-space-md text-body-sm text-outline">
              <span className="flex items-center gap-1"><BadgeCheck className="h-4 w-4 text-success" aria-hidden /> Trade licence verified</span>
              <span className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-primary" aria-hidden /> Trust score 810/850</span>
              <span className="flex items-center gap-1"><UsersRound className="h-4 w-4 text-primary" aria-hidden /> {owner?.connections} connections</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <LinkButton href={`/businesses/${business?.id}`} variant="outline">View public profile</LinkButton>
          <LinkButton href="/loans/request/new" variant="secondary"><FilePlus2 className="h-4 w-4" aria-hidden /> New loan request</LinkButton>
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Active principal" value={formatBDT(150000)} hint="Second deck oven loan" />
        <StatCard icon={CalendarDays} label="Next instalment" value={formatBDT(installment)} hint="Due in 6 days" tone="warning" />
        <StatCard icon={Handshake} label="Offers received" value={String(offers.length)} hint="All direct from investors" tone="secondary" />
        <StatCard icon={PiggyBank} label="Repayment health" value="33%" hint="4 of 12 cycles cleared" tone="success" />
      </div>

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-space-lg">
          <Card className="overflow-hidden">
            <div className="grid gap-space-lg p-space-lg md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="secondary">Open request</Badge>
                  <Badge tone="primary">{loan.createdAt}</Badge>
                </div>
                <h2 className="mt-space-sm text-headline-md text-on-surface">{loan.title}</h2>
                <p className="mt-space-sm max-w-2xl text-body-md text-on-surface-variant">{loan.description}</p>
                <div className="mt-space-md grid gap-space-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(loan.amount)}</p></div>
                  <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Terms</p><p className="text-label-md font-bold text-on-surface">{loan.tenureMonths} mo · {loan.rate}% p.a.</p></div>
                  <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Interest</p><p className="text-label-md font-bold text-on-surface">{loan.offersCount} direct offers</p></div>
                </div>
                <ProgressBar value={loan.progress} label="Request progress" className="mt-space-md" />
              </div>
              <div className="flex flex-col gap-space-sm">
                <LinkButton href="/loans/request/new">Edit request</LinkButton>
                <LinkButton href="/messages" variant="outline">Message investors</LinkButton>
              </div>
            </div>
          </Card>

          <section>
            <SectionHeading eyebrow="Incoming offers" title="Compare direct offers" description="Accept, decline or negotiate terms with each investor." action={<Link href="/messages" className="text-label-md font-semibold text-primary hover:underline">Open deal room</Link>} />
            <div className="mt-space-md space-y-space-sm">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>
          </section>

          <Card className="p-space-lg">
            <SectionHeading eyebrow="Repayment" title="Agreement schedule" description="Monthly instalments recorded in both dashboards." />
            <div className="mt-space-md overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-body-sm">
                <thead>
                  <tr className="border-b border-surface-container-high text-label-sm uppercase tracking-wide text-outline"><th className="pb-space-sm">Cycle</th><th className="pb-space-sm">Amount</th><th className="pb-space-sm">Due</th><th className="pb-space-sm">Status</th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, index) => {
                    const cycle = index + 1;
                    const paid = cycle <= 3;
                    const due = cycle === 4;
                    return (
                      <tr key={cycle} className="border-b border-surface-container-high/70 last:border-0">
                        <td className="py-space-sm font-bold text-on-surface">Cycle {cycle}</td>
                        <td className="py-space-sm text-on-surface-variant">{formatBDT(installment)}</td>
                        <td className="py-space-sm text-on-surface-variant">Month {cycle}</td>
                        <td className="py-space-sm">
                          {paid ? <Badge tone="success"><Check className="h-3.5 w-3.5" aria-hidden /> Paid</Badge> : due ? <Badge tone="warning"><Clock3 className="h-3.5 w-3.5" aria-hidden /> Due soon</Badge> : <Badge>Scheduled</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Link href={`/loans/${loan.id}/agreement`} className="mt-space-md inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">View full agreement <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
          </Card>
        </div>

        <aside className="space-y-space-md">
          <Card className="p-space-lg">
            <h2 className="text-headline-sm text-on-surface">Your progress</h2>
            <div className="mt-space-md space-y-space-md">
              {businessMilestones.map((item) => (
                <div key={item.label} className="flex items-start gap-space-sm">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-success-container text-success" : "bg-surface-container-high text-outline"}`}>
                    {item.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Clock3 className="h-4 w-4" aria-hidden />}
                  </span>
                  <p className={`text-body-sm ${item.done ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-space-lg">
            <h2 className="text-headline-sm text-on-surface">Request snapshot</h2>
            <img src={loan.image} alt="Loan request" className="mt-space-md h-32 w-full rounded-xl object-cover" />
            <div className="mt-space-md space-y-space-sm">
              <div className="flex items-center justify-between text-body-sm"><span className="text-outline">Connections</span><span className="font-bold text-on-surface">{loan.connectionsCount}</span></div>
              <div className="flex items-center justify-between text-body-sm"><span className="text-outline">Offers</span><span className="font-bold text-on-surface">{loan.offersCount}</span></div>
              <div className="flex items-center justify-between text-body-sm"><span className="text-outline">Monthly revenue</span><span className="font-bold text-on-surface">{formatBDT(business?.monthlyRevenue ?? 0)}</span></div>
            </div>
          </Card>

          <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <MessageCircle className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Need a hand?</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Your relationship manager can help you compare offer terms before you reply.</p>
            <LinkButton href="/messages" variant="outline" size="sm" className="mt-space-md w-full border-primary/20 bg-white/60">Contact support</LinkButton>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
