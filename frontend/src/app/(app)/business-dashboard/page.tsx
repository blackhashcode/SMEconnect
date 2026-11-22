import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarDays, CheckCircle2, Clock3, FilePlus2, Handshake, Hourglass, Inbox, Landmark, MessageCircle, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { Photo } from "@/components/ui/Photo";
import { OfferCard } from "@/components/domain/OfferCard";
import { getPerson, listLoans, listMyOffers } from "@/lib/api";
import { formatBDT, repaymentPlan } from "@/lib/format";
import { isActiveLoan } from "@/lib/loans";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Business dashboard" };

export default async function BusinessDashboardPage() {
  const owner = await requireUser("/business-dashboard");

  if (owner.role !== "business") {
    return (
      <EmptyState
        icon={Landmark}
        title="Business Hub is for business owners"
        description="Your investor dashboard tracks the offers you've made and the businesses you back."
        action={<LinkButton href="/investor-dashboard">Go to Investor Hub</LinkButton>}
      />
    );
  }

  const [profile, loans, received] = await Promise.all([getPerson(owner.id), listLoans({ mine: true }), listMyOffers("received")]);
  const business = profile?.business ?? null;
  const current = loans.find(isActiveLoan) ?? loans[0] ?? null;
  const currentOffers = current ? received.filter((offer) => offer.requestId === current.id) : [];
  const liveOffers = currentOffers.filter((offer) => offer.status === "pending" || offer.status === "negotiating");
  const accepted = received.filter((offer) => offer.status === "accepted");
  const latestDeal = accepted[0] ?? null;
  const plan = latestDeal ? repaymentPlan(latestDeal.amount, latestDeal.rate, latestDeal.tenureMonths, latestDeal.frequency) : null;
  const awaitingReply = received.filter((offer) => (offer.status === "pending" || offer.status === "negotiating") && offer.lastActionBy === "investor").length;

  const milestones = [
    { label: "Business profile created", done: true },
    { label: "Verification approved", done: Boolean(business?.verified) },
    { label: "Loan request published", done: loans.length > 0 },
    { label: "First offer received", done: received.length > 0 },
    { label: "Agreement confirmed", done: accepted.length > 0 },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <Avatar src={owner.avatar} alt={owner.name} size="xl" priority />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-lg text-on-surface">Welcome back, {owner.name.split(" ")[0]}</h1>
              {owner.verified && <VerifiedBadge />}
            </div>
            <p className="mt-1 text-body-md text-on-surface-variant">{business ? `${business.name} · ${business.category} · ${business.location}` : owner.headline}</p>
            <div className="mt-space-sm flex flex-wrap gap-space-md text-body-sm text-outline">
              {business?.verified ? (
                <span className="flex items-center gap-1"><BadgeCheck className="h-4 w-4 text-success" aria-hidden /> Trade licence verified</span>
              ) : (
                <span className="flex items-center gap-1"><Hourglass className="h-4 w-4 text-warning" aria-hidden /> Verification in progress</span>
              )}
              <span className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-primary" aria-hidden /> {loans.length} {loans.length === 1 ? "request" : "requests"} posted</span>
              <span className="flex items-center gap-1"><UsersRound className="h-4 w-4 text-primary" aria-hidden /> {owner.connections} connections</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          {business && <LinkButton href={`/businesses/${business.id}`} variant="outline">View public profile</LinkButton>}
          <LinkButton href="/loans/request/new" variant="secondary"><FilePlus2 className="h-4 w-4" aria-hidden /> New loan request</LinkButton>
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Agreed principal" value={accepted.length ? formatBDT(accepted.reduce((sum, offer) => sum + offer.amount, 0)) : "—"} hint={accepted.length ? `${accepted.length} confirmed ${accepted.length === 1 ? "agreement" : "agreements"}` : "No agreements yet"} />
        <StatCard icon={CalendarDays} label="Instalment" value={plan ? formatBDT(plan.installment) : "—"} hint={latestDeal ? `${latestDeal.frequency} · ${plan?.cycles} payments` : "Starts once you agree an offer"} tone="warning" />
        <StatCard icon={Handshake} label="Offers received" value={String(received.length)} hint={awaitingReply ? `${awaitingReply} waiting for your reply` : "All direct from investors"} tone="secondary" />
        <StatCard icon={Inbox} label="Open requests" value={String(loans.filter(isActiveLoan).length)} hint="Visible to verified investors" tone="success" />
      </div>

      {!current ? (
        <div className="mt-space-lg">
          <EmptyState
            icon={FilePlus2}
            title="Post your first loan request"
            description="Tell investors how much you need and why. They'll reply with direct offers you can accept, negotiate or decline."
            action={<LinkButton href="/loans/request/new" variant="secondary">Create a loan request</LinkButton>}
          />
        </div>
      ) : (
        <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <div className="space-y-space-lg">
            <Card className="overflow-hidden">
              <div className="grid gap-space-lg p-space-lg md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={isActiveLoan(current) ? "secondary" : current.status === "agreed" ? "success" : "neutral"}>
                      {isActiveLoan(current) ? "Open request" : current.status === "agreed" ? "Agreed" : "Closed"}
                    </Badge>
                    <Badge tone="primary"><TimeAgo iso={current.createdAt} /></Badge>
                  </div>
                  <h2 className="mt-space-sm text-headline-md text-on-surface">{current.title}</h2>
                  <p className="mt-space-sm max-w-2xl text-body-md text-on-surface-variant">{current.description}</p>
                  <div className="mt-space-md grid gap-space-sm sm:grid-cols-3">
                    <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(current.amount)}</p></div>
                    <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Terms</p><p className="text-label-md font-bold text-on-surface">{current.tenureMonths} mo · {current.rate}% p.a.</p></div>
                    <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Interest</p><p className="text-label-md font-bold text-on-surface">{current.offersCount} direct {current.offersCount === 1 ? "offer" : "offers"}</p></div>
                  </div>
                  <ProgressBar value={current.progress} label="Request progress" className="mt-space-md" />
                </div>
                <div className="flex flex-col gap-space-sm">
                  {current.status === "agreed" ? (
                    <LinkButton href={`/loans/${current.id}/agreement`}>View agreement</LinkButton>
                  ) : (
                    <LinkButton href={`/businesses/${current.business.id}`}>View on profile</LinkButton>
                  )}
                  <LinkButton href="/messages" variant="outline">Open messages</LinkButton>
                </div>
              </div>
            </Card>

            <section>
              <SectionHeading
                eyebrow="Incoming offers"
                title="Compare direct offers"
                description={liveOffers.length ? "Accept, decline or negotiate terms with each investor." : "Offers from verified investors will appear here."}
                action={<Link href="/messages" className="text-label-md font-semibold text-primary hover:underline">Open deal room</Link>}
              />
              <div className="mt-space-md space-y-space-sm">
                {currentOffers.length === 0 && (
                  <p className="rounded-2xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">No offers on this request yet. Investors usually reply within a few days.</p>
                )}
                {currentOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
              </div>
            </section>

            {latestDeal && plan && (
              <Card className="p-space-lg">
                <SectionHeading eyebrow="Repayment" title="Agreement schedule" description={`${latestDeal.frequency} instalments agreed with ${latestDeal.investor.name}.`} />
                <div className="mt-space-md overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-body-sm">
                    <thead>
                      <tr className="border-b border-surface-container-high text-label-sm uppercase tracking-wide text-outline"><th className="pb-space-sm">Payment</th><th className="pb-space-sm">Amount</th><th className="pb-space-sm">Status</th></tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: Math.min(plan.cycles, 6) }).map((_, index) => (
                        <tr key={index} className="border-b border-surface-container-high/70 last:border-0">
                          <td className="py-space-sm font-bold text-on-surface">#{index + 1}</td>
                          <td className="py-space-sm text-on-surface-variant">{formatBDT(plan.installment)}</td>
                          <td className="py-space-sm"><Badge><Clock3 className="h-3.5 w-3.5" aria-hidden /> Scheduled</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {plan.cycles > 6 && <p className="mt-space-sm text-body-sm text-outline">+ {plan.cycles - 6} more payments</p>}
                <Link href={`/loans/${latestDeal.requestId}/agreement`} className="mt-space-md inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">View full agreement <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
              </Card>
            )}
          </div>

          <aside className="space-y-space-md">
            <Card className="p-space-lg">
              <h2 className="text-headline-sm text-on-surface">Your progress</h2>
              <div className="mt-space-md space-y-space-md">
                {milestones.map((item) => (
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
              <Photo src={current.image} alt="" className="mt-space-md h-32 w-full rounded-xl" sizes="320px" />
              <div className="mt-space-md space-y-space-sm">
                <div className="flex items-center justify-between text-body-sm"><span className="text-outline">Connections</span><span className="font-bold text-on-surface">{current.connectionsCount}</span></div>
                <div className="flex items-center justify-between text-body-sm"><span className="text-outline">Offers</span><span className="font-bold text-on-surface">{current.offersCount}</span></div>
                <div className="flex items-center justify-between text-body-sm"><span className="text-outline">Monthly revenue</span><span className="font-bold text-on-surface">{business?.monthlyRevenue ? formatBDT(business.monthlyRevenue) : "Not shared"}</span></div>
              </div>
            </Card>

            {loans.length > 1 && (
              <Card className="p-space-lg">
                <h2 className="text-headline-sm text-on-surface">All your requests</h2>
                <ul className="mt-space-md space-y-space-sm">
                  {loans.map((loan) => (
                    <li key={loan.id} className="flex items-center justify-between gap-space-sm text-body-sm">
                      <span className="min-w-0 truncate text-on-surface">{loan.title}</span>
                      <Badge tone={isActiveLoan(loan) ? "primary" : loan.status === "agreed" ? "success" : "neutral"} className="shrink-0">{loan.status.replace("_", " ")}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
              <MessageCircle className="h-6 w-6" aria-hidden />
              <p className="mt-space-sm text-label-md font-bold">Need a hand?</p>
              <p className="mt-1 text-body-sm text-on-primary-fixed/80">Ask investors questions in messages before you accept an offer.</p>
              <LinkButton href="/messages" variant="outline" size="sm" className="mt-space-md w-full border-primary/20 bg-white/60">Open messages</LinkButton>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
