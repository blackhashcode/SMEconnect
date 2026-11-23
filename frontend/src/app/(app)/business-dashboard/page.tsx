import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarDays, CheckCircle2, Clock3, FilePlus2, Handshake, Hourglass, Inbox, Landmark, ShieldCheck, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { OfferCard } from "@/components/domain/OfferCard";
import { OwnRequestActions } from "@/components/domain/OwnRequestActions";
import { myLoanRequests, offersReceived, ownerDashboard } from "@/lib/api";
import { formatBDT, shortDate, firstName } from "@/lib/format";
import { FREQUENCY_LABEL, LOAN_REQUEST_STATUS, tenureLabel } from "@/lib/loans";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Business dashboard" };

export default async function BusinessDashboardPage() {
  const user = await requireUser("/business-dashboard");
  if (user.role !== "business") {
    return (
      <EmptyState
        icon={Landmark}
        title="Business Hub is for business owners"
        description="Your investor dashboard tracks the offers you've made and the businesses you back."
        action={<LinkButton href="/investor-dashboard">Go to Investor Hub</LinkButton>}
      />
    );
  }

  const [dashboard, requests, offers] = await Promise.all([ownerDashboard(), myLoanRequests(), offersReceived()]);
  const profile = dashboard?.profile;
  const loan = dashboard?.loan ?? null;
  const verified = user.verification === "APPROVED";
  const current = requests.find((r) => ["OPEN", "IN_DISCUSSION", "PAUSED", "DRAFT"].includes(r.status)) ?? requests[0] ?? null;
  const liveOffers = offers.filter((offer) => offer.status === "PENDING");
  const yourTurn = liveOffers.filter((offer) => offer.proposedBy === "INVESTOR").length;
  const loanPct = loan && loan.progress.totalInstallments ? Math.round((loan.progress.confirmedCount / loan.progress.totalInstallments) * 100) : 0;

  const milestones = [
    { label: "Business profile completed", done: user.hasProfile, href: "/onboarding" },
    { label: "Identity verified", done: verified, href: "/onboarding" },
    { label: "Loan request published", done: requests.some((r) => r.status !== "DRAFT"), href: "/loans/new" },
    { label: "First offer received", done: offers.length > 0 },
    { label: "Agreement confirmed", done: loan !== null && loan.status !== "PENDING_AGREEMENT" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <Avatar src={user.avatar} alt={user.name} name={user.name} size="xl" priority />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-lg text-on-surface">Welcome back, {firstName(user.name)}</h1>
              {verified && <VerifiedBadge />}
            </div>
            <p className="mt-1 text-body-md text-on-surface-variant">{profile?.shopName ? `${profile.shopName} · ${profile.category} · ${[profile.district, profile.city].filter(Boolean).join(", ")}` : "Complete your business profile to get started."}</p>
            <div className="mt-space-sm flex flex-wrap gap-space-md text-body-sm text-outline">
              {verified ? (
                <span className="flex items-center gap-1"><BadgeCheck className="h-4 w-4 text-success" aria-hidden /> Verified</span>
              ) : (
                <span className="flex items-center gap-1"><Hourglass className="h-4 w-4 text-warning" aria-hidden /> {user.verification === "PENDING" ? "Verification in review" : "Not verified yet"}</span>
              )}
              <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Trust score {dashboard?.trustScore ?? 0}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <LinkButton href={`/businesses/${user.id}`} variant="outline">View public profile</LinkButton>
          <LinkButton href="/loans/new" variant="secondary"><FilePlus2 className="h-4 w-4" aria-hidden /> New loan request</LinkButton>
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Active loan" value={loan ? formatBDT(loan.principalBdt) : "—"} hint={loan ? `${formatBDT(loan.totalRepayableBdt)} to repay` : "No loan yet"} />
        <StatCard icon={CalendarDays} label="Next instalment" value={loan?.nextDue ? formatBDT(loan.nextDue.amountBdt) : "—"} hint={loan?.nextDue ? `Due ${shortDate(loan.nextDue.dueDate)}` : "Nothing due"} tone="warning" />
        <StatCard icon={Handshake} label="Offers received" value={String(dashboard?.offers.received ?? offers.length)} hint={yourTurn ? `${yourTurn} waiting for your reply` : "All direct from investors"} tone="secondary" />
        <StatCard icon={Inbox} label="Requests" value={String(requests.length)} hint={current ? LOAN_REQUEST_STATUS[current.status].label : "None yet"} tone="success" />
      </div>

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="space-y-space-lg">
          {loan && (
            <Card className="p-space-lg">
              <SectionHeading eyebrow="Your loan" title={loan.status === "PENDING_AGREEMENT" ? "Agreement waiting for confirmation" : "Repayment progress"} />
              <div className="mt-space-md"><ProgressBar value={loanPct} label={`${loan.progress.confirmedCount} of ${loan.progress.totalInstallments} instalments confirmed`} tone="success" /></div>
              <LinkButton href={`/loans/${loan.id}`} className="mt-space-md">{loan.status === "PENDING_AGREEMENT" ? "Review & confirm" : "Open repayments"} <ArrowUpRight className="h-4 w-4" aria-hidden /></LinkButton>
            </Card>
          )}

          {current ? (
            <Card className="p-space-lg">
              <div className="flex flex-wrap items-start justify-between gap-space-md">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={LOAN_REQUEST_STATUS[current.status].tone}>{LOAN_REQUEST_STATUS[current.status].label}</Badge>
                    <Badge tone="neutral"><TimeAgo iso={current.publishedAt ?? current.createdAt} /></Badge>
                  </div>
                  <h2 className="mt-space-sm text-headline-md text-on-surface">{current.purpose}</h2>
                  <p className="mt-space-sm max-w-2xl text-body-md text-on-surface-variant">{current.fundUsage}</p>
                  <div className="mt-space-md grid gap-space-sm sm:grid-cols-3">
                    <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(current.amountBdt)}</p></div>
                    <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Tenure</p><p className="text-label-md font-bold text-on-surface">{tenureLabel(current.tenureDays)}</p></div>
                    <div className="rounded-xl bg-surface-container-low p-space-sm"><p className="text-label-sm text-outline">Repayment</p><p className="text-label-md font-bold text-on-surface">{FREQUENCY_LABEL[current.repaymentFrequency]}</p></div>
                  </div>
                </div>
                <OwnRequestActions request={current} />
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={FilePlus2}
              title="Post your first loan request"
              description="Tell investors how much you need and why. They'll reply with offers you can accept, counter or reject."
              action={<LinkButton href="/loans/new" variant="secondary">Create a loan request</LinkButton>}
            />
          )}

          <section>
            <SectionHeading eyebrow="Incoming offers" title="Compare direct offers" description="Accept, counter or reject each investor's terms." />
            <div className="mt-space-md space-y-space-sm">
              {offers.length === 0 && <p className="rounded-2xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">No offers yet. Investors usually reply within a few days of publishing.</p>}
              {offers.slice(0, 6).map((offer) => <OfferCard key={offer.id} offer={offer} />)}
            </div>
          </section>
        </div>

        <aside className="space-y-space-md">
          <Card className="p-space-lg">
            <h2 className="text-headline-sm text-on-surface">Your progress</h2>
            <ul className="mt-space-md space-y-space-md">
              {milestones.map((item) => (
                <li key={item.label} className="flex items-start gap-space-sm">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-success-container text-success" : "bg-surface-container-high text-outline"}`}>
                    {item.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Clock3 className="h-4 w-4" aria-hidden />}
                  </span>
                  {!item.done && item.href ? (
                    <Link href={item.href} className="text-body-sm font-semibold text-primary hover:underline">{item.label}</Link>
                  ) : (
                    <p className={`text-body-sm ${item.done ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>{item.label}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {requests.length > 1 && (
            <Card className="p-space-lg">
              <h2 className="text-headline-sm text-on-surface">All your requests</h2>
              <ul className="mt-space-md space-y-space-sm">
                {requests.map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-space-sm text-body-sm">
                    <span className="min-w-0 truncate text-on-surface">{request.purpose}</span>
                    <Badge tone={LOAN_REQUEST_STATUS[request.status].tone} className="shrink-0">{LOAN_REQUEST_STATUS[request.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
