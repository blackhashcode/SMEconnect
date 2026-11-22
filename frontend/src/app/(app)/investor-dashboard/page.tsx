import Link from "next/link";
import { Building2, ChevronRight, CircleDollarSign, Handshake, Landmark, PieChart, Send, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { LoanCardCompact } from "@/components/domain/LoanCard";
import { OfferCard } from "@/components/domain/OfferCard";
import { offerStatusTone } from "@/lib/loans";
import { listLoans, listMyOffers } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Investor dashboard" };

const sectorColors = ["bg-primary", "bg-secondary-container", "bg-tertiary-fixed-dim", "bg-success", "bg-primary-fixed-dim"];

export default async function InvestorDashboardPage() {
  const investor = await requireUser("/investor-dashboard");

  if (investor.role !== "investor") {
    return (
      <EmptyState
        icon={Landmark}
        title="Investor Hub is for investors"
        description="Your Business Hub shows your loan requests and the offers investors have sent you."
        action={<LinkButton href="/business-dashboard">Go to Business Hub</LinkButton>}
      />
    );
  }

  const [offers, openLoans] = await Promise.all([listMyOffers("sent"), listLoans({ status: "active" })]);
  const live = offers.filter((offer) => offer.status === "pending" || offer.status === "negotiating");
  const accepted = offers.filter((offer) => offer.status === "accepted");
  const committed = accepted.reduce((sum, offer) => sum + offer.amount, 0);
  const agreedReturn = committed ? (accepted.reduce((sum, offer) => sum + offer.rate * offer.amount, 0) / committed).toFixed(1) : null;
  const yourTurn = live.filter((offer) => offer.lastActionBy === "owner").length;
  const offeredOn = new Set(offers.filter((offer) => offer.status !== "withdrawn" && offer.status !== "declined").map((offer) => offer.requestId));
  const opportunities = openLoans
    .filter((loan) => !offeredOn.has(loan.id) && loan.owner.id !== investor.id)
    .sort((a, b) => Number(b.business.verified) - Number(a.business.verified))
    .slice(0, 4);
  const portfolio = [...accepted, ...live];

  // Sector mix across active and agreed offers, by amount.
  const bySector = new Map<string, number>();
  for (const offer of portfolio) bySector.set(offer.request.business.category, (bySector.get(offer.request.business.category) ?? 0) + offer.amount);
  const portfolioTotal = [...bySector.values()].reduce((a, b) => a + b, 0);
  const sectors = [...bySector.entries()].sort((a, b) => b[1] - a[1]).map(([label, amount], i) => ({ label, share: Math.round((amount / portfolioTotal) * 100), color: sectorColors[i % sectorColors.length] }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <Avatar src={investor.avatar} alt={investor.name} size="xl" priority />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-lg text-on-surface">Welcome back, {investor.name.split(" ")[0]}</h1>
              {investor.verified && <VerifiedBadge />}
            </div>
            <p className="mt-1 max-w-2xl text-body-md text-on-surface-variant">{investor.headline}</p>
            <div className="mt-space-sm flex flex-wrap gap-space-md text-body-sm text-outline">
              <span className="flex items-center gap-1"><UsersRound className="h-4 w-4" aria-hidden /> {investor.connections} connections</span>
              <span className="flex items-center gap-1"><Handshake className="h-4 w-4" aria-hidden /> {offers.length} offers made</span>
              <span className="flex items-center gap-1"><Building2 className="h-4 w-4" aria-hidden /> {investor.location}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <LinkButton href="/explore" variant="outline">Explore businesses</LinkButton>
          {opportunities[0] && <LinkButton href={`/loans/offers/new?request=${opportunities[0].id}`} variant="secondary">Make an offer</LinkButton>}
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Committed capital" value={committed ? formatBDT(committed) : "—"} hint={accepted.length ? `Across ${accepted.length} ${accepted.length === 1 ? "agreement" : "agreements"}` : "No agreements yet"} />
        <StatCard icon={Landmark} label="Active offers" value={String(live.length)} hint={yourTurn ? `${yourTurn} waiting for your reply` : "Awaiting owner response"} tone="secondary" />
        <StatCard icon={TrendingUp} label="Agreed return" value={agreedReturn ? `${agreedReturn}%` : "—"} hint="Weighted across agreements" tone="success" />
        <StatCard icon={Send} label="Offers sent" value={String(offers.length)} hint={`${offers.filter((offer) => offer.status === "declined").length} declined · ${offers.filter((offer) => offer.status === "withdrawn").length} withdrawn`} tone="warning" />
      </div>

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <Card className="p-space-lg">
          <SectionHeading eyebrow="Portfolio" title="Your active loan offers" description="Agreed deals and offers still under negotiation." />
          {portfolio.length === 0 ? (
            <p className="mt-space-md rounded-2xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">
              You haven&apos;t made any offers yet. Browse open requests to find a business to back.
            </p>
          ) : (
            <div className="mt-space-md overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-surface-container-high text-label-sm uppercase tracking-wide text-outline">
                    <th className="pb-space-sm font-bold">Business</th>
                    <th className="pb-space-sm font-bold">Amount</th>
                    <th className="pb-space-sm font-bold">Terms</th>
                    <th className="pb-space-sm font-bold">Status</th>
                    <th className="pb-space-sm" />
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((offer) => (
                    <tr key={offer.id} className="border-b border-surface-container-high/70 last:border-0">
                      <td className="py-space-md">
                        <p className="text-label-md font-bold text-on-surface">{offer.request.business.name}</p>
                        <p className="max-w-[220px] truncate text-body-sm text-outline">{offer.request.title}</p>
                      </td>
                      <td className="py-space-md"><p className="text-label-md font-bold text-on-surface">{formatBDT(offer.amount)}</p><p className="text-body-sm text-outline">of {formatBDT(offer.request.amount)}</p></td>
                      <td className="py-space-md"><p className="text-label-md font-bold text-on-surface">{offer.rate}% p.a.</p><p className="text-body-sm text-outline">{offer.tenureMonths} mo · {offer.frequency}</p></td>
                      <td className="py-space-md">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={offerStatusTone[offer.status]} className="capitalize">{offer.status}</Badge>
                          {offer.status !== "accepted" && offer.lastActionBy === "owner" && <Badge tone="secondary">Your turn</Badge>}
                        </div>
                      </td>
                      <td className="py-space-md text-right">
                        <Link
                          href={offer.status === "accepted" ? `/loans/${offer.requestId}/agreement` : `/loans/offers/${offer.id}/review`}
                          aria-label={`Open ${offer.request.business.name} offer`}
                          className="inline-flex rounded-full bg-surface-container-high p-2 text-primary transition-colors hover:bg-primary-fixed"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-space-md">
          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><PieChart className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Portfolio mix</h2></div>
            {sectors.length === 0 ? (
              <p className="mt-space-md text-body-sm text-on-surface-variant">Your mix by sector appears once you make offers.</p>
            ) : (
              <>
                <div className="mt-space-md space-y-space-sm">
                  {sectors.map((sector) => (
                    <div key={sector.label}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-body-sm"><span className="text-on-surface-variant">{sector.label}</span><span className="font-bold text-on-surface">{sector.share}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                        <div className="h-full" style={{ width: `${sector.share}%` }}>
                          <div className={`h-full origin-left animate-grow-x rounded-full ${sector.color}`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-space-md text-body-sm text-outline">Based on {formatBDT(portfolioTotal)} in active and agreed offers.</p>
              </>
            )}
          </Card>
          <Card className="bg-primary-fixed p-space-lg text-on-primary-fixed">
            <CircleDollarSign className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Ready to deploy capital?</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Review verified requests and send a direct offer with your own rate and tenure.</p>
            <LinkButton href="/explore" variant="outline" size="sm" className="mt-space-md border-primary/20 bg-white/60">Browse requests</LinkButton>
          </Card>
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-lg lg:grid-cols-2">
        <section>
          <SectionHeading eyebrow="Your offers" title="Recent offers" action={<Link href="/messages" className="text-label-md font-semibold text-primary hover:underline">Open messages</Link>} />
          <div className="mt-space-md space-y-space-sm">
            {offers.length === 0 && <p className="rounded-2xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">Offers you send will show up here.</p>}
            {offers.slice(0, 4).map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>
        </section>
        <section>
          <SectionHeading eyebrow="Opportunities" title="Open requests for you" action={<Link href="/explore" className="text-label-md font-semibold text-primary hover:underline">Explore all</Link>} />
          <div className="mt-space-md rounded-2xl bg-surface-container-lowest p-space-sm card-shadow">
            {opportunities.length === 0 && <p className="p-space-md text-body-sm text-on-surface-variant">You&apos;ve made offers on every open request. New ones will appear here.</p>}
            {opportunities.map((loan) => <LoanCardCompact key={loan.id} loan={loan} />)}
          </div>
        </section>
      </div>
    </>
  );
}
