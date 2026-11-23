import Link from "next/link";
import { BadgeCheck, CalendarClock, ChevronRight, CircleDollarSign, Handshake, Hourglass, Landmark, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { LoanCardCompact } from "@/components/domain/LoanCard";
import { OfferCard } from "@/components/domain/OfferCard";
import { investorDashboard, listOpenLoanRequests, offersSubmitted } from "@/lib/api";
import { formatBDT, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Investor dashboard" };

const HEALTH = {
  ON_TRACK: { label: "On track", tone: "success" },
  DUE_SOON: { label: "Due soon", tone: "warning" },
  OVERDUE: { label: "Overdue", tone: "error" },
  COMPLETED: { label: "Completed", tone: "neutral" },
} as const;

export default async function InvestorDashboardPage() {
  const user = await requireUser("/investor-dashboard");
  if (user.role !== "investor") {
    return (
      <EmptyState
        icon={Landmark}
        title="Investor Hub is for investors"
        description="Your Business Hub shows your loan requests and the offers investors have sent you."
        action={<LinkButton href={user.role === "admin" ? "/admin/verification" : "/business-dashboard"}>{user.role === "admin" ? "Go to verification" : "Go to Business Hub"}</LinkButton>}
      />
    );
  }

  const [dashboard, offers, openLoans] = await Promise.all([investorDashboard(), offersSubmitted(), listOpenLoanRequests({ limit: 20 })]);
  const verified = user.verification === "APPROVED";
  const loans = dashboard?.loans;
  const repayments = dashboard?.repayments;
  const portfolio = dashboard?.portfolio ?? [];
  const yourTurn = offers.filter((offer) => offer.status === "PENDING" && offer.proposedBy === "OWNER").length;
  const offeredOn = new Set(offers.filter((offer) => offer.status === "PENDING").map((offer) => offer.loanRequest.id));
  const opportunities = openLoans.filter((loan) => !offeredOn.has(loan.id)).slice(0, 5);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <Avatar src={user.avatar} alt={user.name} name={user.name} size="xl" priority />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-lg text-on-surface">Welcome back, {user.name.split(" ")[0]}</h1>
              {verified && <VerifiedBadge />}
            </div>
            <div className="mt-space-sm flex flex-wrap gap-space-md text-body-sm text-outline">
              {verified ? (
                <span className="flex items-center gap-1"><BadgeCheck className="h-4 w-4 text-success" aria-hidden /> Verified investor</span>
              ) : (
                <Link href="/onboarding" className="flex items-center gap-1 font-semibold text-primary hover:underline"><Hourglass className="h-4 w-4" aria-hidden /> {user.verification === "PENDING" ? "Verification in review" : "Get verified to make offers"}</Link>
              )}
              <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" aria-hidden /> Trust score {dashboard?.trustScore ?? 0}</span>
              <span className="flex items-center gap-1"><Handshake className="h-4 w-4" aria-hidden /> {dashboard?.offers.submitted ?? offers.length} offers made</span>
            </div>
          </div>
        </div>
        <LinkButton href="/explore" variant="outline">Explore businesses</LinkButton>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Total lent" value={loans?.totalLentBdt ? formatBDT(loans.totalLentBdt) : "—"} hint={`${loans?.active ?? 0} active · ${loans?.completed ?? 0} completed`} />
        <StatCard icon={TrendingUp} label="Repaid to you" value={repayments?.confirmedBdt ? formatBDT(repayments.confirmedBdt) : "—"} hint={repayments ? `${formatBDT(repayments.outstandingBdt)} outstanding` : undefined} tone="success" />
        <StatCard icon={Landmark} label="Active offers" value={String(dashboard?.offers.pendingSubmitted ?? 0)} hint={yourTurn ? `${yourTurn} waiting for your reply` : "Awaiting owners"} tone="secondary" />
        <StatCard icon={CalendarClock} label="Next repayment" value={dashboard?.nextDue ? formatBDT(dashboard.nextDue.amountBdt) : "—"} hint={dashboard?.nextDue ? `Due ${shortDate(dashboard.nextDue.dueDate)}` : "Nothing due"} tone="warning" />
      </div>

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <Card className="p-space-lg">
          <SectionHeading eyebrow="Portfolio" title="Your loans" description="Agreed loans and how repayments are going." />
          {portfolio.length === 0 ? (
            <p className="mt-space-md rounded-2xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">No loans yet. When an owner accepts your offer it shows up here.</p>
          ) : (
            <ul className="mt-space-md divide-y divide-surface-container-high">
              {portfolio.map((item) => {
                const pct = item.progress.totalInstallments ? Math.round((item.progress.confirmedCount / item.progress.totalInstallments) * 100) : 0;
                return (
                  <li key={item.id}>
                    <Link href={`/loans/${item.id}`} className="flex items-center gap-space-md py-space-md transition-colors hover:bg-surface-container-low/60">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-label-md font-bold text-on-surface">{formatBDT(item.principalBdt)}</p>
                          <Badge tone={HEALTH[item.health].tone}>{HEALTH[item.health].label}</Badge>
                          {item.status === "PENDING_AGREEMENT" && <Badge tone="secondary">Confirm agreement</Badge>}
                        </div>
                        <ProgressBar value={pct} showValue={false} tone="success" className="mt-space-sm max-w-sm" />
                        <p className="mt-1 text-body-sm text-outline">{item.progress.confirmedCount}/{item.progress.totalInstallments} instalments{item.nextDue ? ` · next ${shortDate(item.nextDue.dueDate)}` : ""}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-primary" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="bg-primary-fixed p-space-lg text-on-primary-fixed">
          <CircleDollarSign className="h-6 w-6" aria-hidden />
          <p className="mt-space-sm text-label-md font-bold">Ready to back a business?</p>
          <p className="mt-1 text-body-sm text-on-primary-fixed/80">Review verified requests and send an offer with your own rate and tenure.</p>
          <LinkButton href="/explore" variant="outline" size="sm" className="mt-space-md border-primary/20 bg-white/60">Browse requests</LinkButton>
        </Card>
      </div>

      <div className="mt-space-lg grid gap-space-lg lg:grid-cols-2">
        <section>
          <SectionHeading eyebrow="Your offers" title="Recent offers" />
          <div className="mt-space-md space-y-space-sm">
            {offers.length === 0 && <p className="rounded-2xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">Offers you send will show up here.</p>}
            {offers.slice(0, 4).map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>
        </section>
        <section>
          <SectionHeading eyebrow="Opportunities" title="Open requests for you" action={<Link href="/explore" className="text-label-md font-semibold text-primary hover:underline">Explore all</Link>} />
          <div className="mt-space-md rounded-2xl bg-surface-container-lowest p-space-sm card-shadow">
            {opportunities.length === 0 && <p className="p-space-md text-body-sm text-on-surface-variant">No new open requests right now.</p>}
            {opportunities.map((loan) => <LoanCardCompact key={loan.id} loan={loan} />)}
          </div>
        </section>
      </div>
    </>
  );
}
