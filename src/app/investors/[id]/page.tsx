import { notFound } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Banknote, CalendarCheck, Handshake, MapPin, MessageCircle, PieChart, ShieldCheck, Star, TrendingUp, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileHeader } from "@/components/domain/ProfileHeader";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { OfferCard } from "@/components/domain/OfferCard";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { businessById } from "@/data/businesses";
import { formatBDT, loanById } from "@/data/loans";
import { offersByInvestor } from "@/data/offers";
import { people, personById } from "@/data/users";

export const metadata = { title: "Investor profile" };

export default async function InvestorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const investor = personById(id);
  if (!investor || investor.role !== "investor") notFound();

  const offers = offersByInvestor(investor.id);
  const peers = people.filter((person) => person.role === "investor" && person.id !== investor.id).slice(0, 3);
  const portfolio = offers.map((offer) => {
    const loan = loanById(offer.requestId);
    return { offer, business: loan ? businessById(loan.businessId) : undefined };
  });

  return (
    <AppShell>
      <ProfileHeader
        person={investor}
        actions={
          <>
            <ConnectButton name={investor.name} />
            <LinkButton href="/messages" variant="outline"><MessageCircle className="h-4 w-4" aria-hidden /> Message</LinkButton>
            <LinkButton href="/explore" variant="secondary"><Handshake className="h-4 w-4" aria-hidden /> Explore requests</LinkButton>
          </>
        }
      />

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[1fr_320px]">
        <div className="space-y-space-lg">
          <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Banknote} label="Total committed" value={formatBDT(investor.committed ?? 0)} hint={`Across ${investor.offersMade} offers`} />
            <StatCard icon={UsersRound} label="Connections" value={String(investor.connections)} hint="Verified founders and peers" tone="secondary" />
            <StatCard icon={TrendingUp} label="Agreed return" value="13.8%" hint="Weighted across agreements" tone="success" />
            <StatCard icon={Star} label="Rating" value={`${investor.rating}`} hint="From business partners" tone="warning" />
          </div>

          <Card className="p-space-lg">
            <SectionHeading eyebrow="Preferences" title="Lending preferences & terms" />
            <div className="mt-space-md grid gap-space-md sm:grid-cols-2">
              {[
                { label: "Preferred categories", value: "Food, textiles, crafts & logistics" },
                { label: "Offer range", value: "৳50,000 – ৳200,000" },
                { label: "Tenure", value: "6 – 24 months" },
                { label: "Repayment", value: "Monthly or bi-weekly" },
                { label: "Minimum trust score", value: "700+ · Grade A/B" },
                { label: "Response time", value: "Usually within 2 hours" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-surface-container-low p-space-md">
                  <p className="text-label-sm text-outline">{item.label}</p>
                  <p className="mt-0.5 text-label-md font-bold text-on-surface">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {offers.length > 0 && (
            <section>
              <SectionHeading eyebrow="Activity" title="Recent offers" description="Direct proposals sent to verified businesses." />
              <div className="mt-space-md space-y-space-sm">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} showActions={false} />)}</div>
            </section>
          )}

          <Card className="p-space-lg">
            <SectionHeading eyebrow="History" title="Businesses supported" />
            <div className="mt-space-md space-y-space-sm">
              {portfolio.map(({ offer, business }) => business && (
                <div key={offer.id} className="flex items-center justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md">
                  <div><p className="text-label-md font-bold text-on-surface">{business.name}</p><p className="text-body-sm text-outline">{business.category} · {business.location}</p></div>
                  <div className="text-right"><p className="text-label-md font-bold text-primary">{formatBDT(offer.amount)}</p><p className="text-body-sm text-outline">{offer.rate}% p.a. · {offer.status}</p></div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-space-md">
          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Verification & trust</h2></div>
            <div className="mt-space-md space-y-space-sm">
              {["NID & biometric verified", "Bank account linked", "Funding commitment honoured", "Fast responder"].map((item) => (
                <div key={item} className="flex items-center gap-space-sm text-body-sm text-on-surface-variant"><BadgeCheck className="h-4 w-4 text-success" aria-hidden /> {item}</div>
              ))}
            </div>
          </Card>

          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><PieChart className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Co-investors</h2></div>
            <div className="mt-space-md space-y-space-sm">
              {peers.map((peer) => (
                <a key={peer.id} href={`/investors/${peer.id}`} className="flex items-center gap-space-sm rounded-xl p-space-sm transition-colors hover:bg-surface-container-low">
                  <img src={peer.avatar} alt={peer.name} className="h-9 w-9 rounded-full object-cover" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-label-md font-bold text-on-surface">{peer.name}</span><span className="block truncate text-body-sm text-outline">{formatBDT(peer.committed ?? 0)} committed</span></span>
                  <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                </a>
              ))}
            </div>
          </Card>

          <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <CalendarCheck className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Available for new offers</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Browse verified requests and send terms directly to owners.</p>
            <LinkButton href="/explore" variant="outline" size="sm" className="mt-space-md w-full border-primary/20 bg-white/60">Explore now</LinkButton>
          </div>

          <div className="rounded-2xl bg-surface-container-lowest p-space-lg text-body-sm text-on-surface-variant card-shadow">
            <MapPin className="mb-space-sm h-5 w-5 text-primary" aria-hidden />
            <p className="text-label-md font-bold text-on-surface">Based in {investor.location}</p>
            <p className="mt-1">Member since {investor.joined} · {investor.followers} followers</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
