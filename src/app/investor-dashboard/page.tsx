import Link from "next/link";
import { ArrowUpRight, Building2, CalendarClock, ChevronRight, CircleDollarSign, Handshake, Landmark, PieChart, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { LoanCardCompact } from "@/components/domain/LoanCard";
import { OfferCard } from "@/components/domain/OfferCard";
import { businessById } from "@/data/businesses";
import { investorPortfolio, repaymentTrend, sectorAllocation } from "@/data/dashboard";
import { formatBDT, loanById, loanRequests } from "@/data/loans";
import { offersByInvestor } from "@/data/offers";
import { personById } from "@/data/users";

export const metadata = { title: "Investor dashboard" };

export default function InvestorDashboardPage() {
  const investor = personById("rafiq");
  const offers = offersByInvestor("rafiq");
  const opportunities = loanRequests.filter((loan) => loan.id !== "lr-1").slice(0, 4);

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <Avatar src={investor?.avatar ?? ""} alt={investor?.name ?? "Investor"} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-lg text-on-surface">Welcome back, {investor?.name.split(" ")[0]}</h1>
              {investor?.verified && <VerifiedBadge />}
            </div>
            <p className="mt-1 max-w-2xl text-body-md text-on-surface-variant">{investor?.headline}</p>
            <div className="mt-space-sm flex flex-wrap gap-space-md text-body-sm text-outline">
              <span className="flex items-center gap-1"><UsersRound className="h-4 w-4" aria-hidden /> {investor?.connections} connections</span>
              <span className="flex items-center gap-1"><Handshake className="h-4 w-4" aria-hidden /> {investor?.offersMade} offers made</span>
              <span className="flex items-center gap-1"><MapPinIcon /> {investor?.location}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <LinkButton href="/explore" variant="outline">Explore businesses</LinkButton>
          <LinkButton href="/loans/offers/new?request=lr-2" variant="secondary">Make an offer</LinkButton>
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Committed capital" value={formatBDT(investor?.committed ?? 0)} hint="Across verified businesses" />
        <StatCard icon={Landmark} label="Active offers" value={String(offers.length)} hint="Awaiting owner response" tone="secondary" />
        <StatCard icon={TrendingUp} label="Agreed return" value="10.9%" hint="Weighted across active terms" tone="success" />
        <StatCard icon={CalendarClock} label="Next repayment" value={formatBDT(12500)} hint="Due in 6 days" tone="warning" />
      </div>

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="p-space-lg">
          <SectionHeading eyebrow="Portfolio" title="Your active loan offers" description="Direct offers with agreed terms and shared repayment progress." />
          <div className="mt-space-md overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-surface-container-high text-label-sm uppercase tracking-wide text-outline">
                  <th className="pb-space-sm font-bold">Business</th>
                  <th className="pb-space-sm font-bold">Committed</th>
                  <th className="pb-space-sm font-bold">Next inflow</th>
                  <th className="pb-space-sm font-bold">Progress</th>
                  <th className="pb-space-sm font-bold">Status</th>
                  <th className="pb-space-sm" />
                </tr>
              </thead>
              <tbody>
                {investorPortfolio.map((item) => {
                  const loan = loanById(item.loanId);
                  const business = loan ? businessById(loan.businessId) : undefined;
                  const owner = business ? personById(business.ownerId) : undefined;
                  return (
                    <tr key={item.loanId} className="border-b border-surface-container-high/70 last:border-0">
                      <td className="py-space-md">
                        <div className="flex items-center gap-space-sm">
                          {owner && <Avatar src={owner.avatar} alt={owner.name} size="sm" />}
                          <div><p className="text-label-md font-bold text-on-surface">{business?.name}</p><p className="text-body-sm text-outline">{item.role}</p></div>
                        </div>
                      </td>
                      <td className="py-space-md"><p className="text-label-md font-bold text-on-surface">{formatBDT(item.committed)}</p><p className="text-body-sm text-outline">{item.returnRate}% p.a.</p></td>
                      <td className="py-space-md"><p className="text-label-md font-bold text-on-surface">{formatBDT(item.nextAmount)}</p><p className="text-body-sm text-outline">{item.due} · {item.cycle}</p></td>
                      <td className="w-40 py-space-md"><ProgressBar value={item.progress} showValue={false} /></td>
                      <td className="py-space-md"><Badge tone={item.status === "Due soon" ? "warning" : "success"}>{item.status}</Badge></td>
                      <td className="py-space-md text-right"><Link href="/messages" aria-label="Open deal chat" className="inline-flex rounded-full bg-surface-container-high p-2 text-primary hover:bg-primary-fixed"><ChevronRight className="h-4 w-4" aria-hidden /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-space-md">
          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><PieChart className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Portfolio mix</h2></div>
            <div className="mt-space-md space-y-space-sm">
              {sectorAllocation.map((sector) => (
                <div key={sector.label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-body-sm"><span className="text-on-surface-variant">{sector.label}</span><span className="font-bold text-on-surface">{sector.share}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-high"><div className={`h-full rounded-full ${sector.color}`} style={{ width: `${sector.share}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-space-md text-body-sm text-outline">Based on {formatBDT(investor?.committed ?? 0)} committed.</p>
          </Card>
          <Card className="p-space-lg">
            <h2 className="text-headline-sm text-on-surface">Repayment trend</h2>
            <p className="mt-1 text-body-sm text-outline">Principal and agreed return received</p>
            <div className="mt-space-md flex h-32 items-end gap-2">
              {repaymentTrend.map((point) => (
                <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end gap-0.5">
                    <div className="w-1/2 rounded-t bg-primary/80" style={{ height: `${point.principal * 2}%` }} />
                    <div className="w-1/2 rounded-t bg-secondary-container" style={{ height: `${point.return * 3}%` }} />
                  </div>
                  <span className="text-[10px] text-outline">{point.month}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-lg lg:grid-cols-2">
        <section>
          <SectionHeading eyebrow="Your offers" title="Recent offers" action={<Link href="/messages" className="text-label-md font-semibold text-primary hover:underline">View all</Link>} />
          <div className="mt-space-md space-y-space-sm">
            {offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>
        </section>
        <section>
          <SectionHeading eyebrow="Opportunities" title="Verified requests for you" action={<Link href="/explore" className="text-label-md font-semibold text-primary hover:underline">Explore all</Link>} />
          <div className="mt-space-md rounded-2xl bg-surface-container-lowest p-space-sm card-shadow">
            {opportunities.map((loan) => <LoanCardCompact key={loan.id} loan={loan} />)}
          </div>
          <Card className="mt-space-md bg-primary-fixed p-space-lg text-on-primary-fixed">
            <CircleDollarSign className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Ready to deploy capital?</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Review verified requests and send a direct offer with your own rate and tenure.</p>
            <Button variant="outline" size="sm" className="mt-space-md border-primary/20 bg-white/60">Browse matches</Button>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function MapPinIcon() {
  return <Building2 className="h-4 w-4" aria-hidden />;
}
