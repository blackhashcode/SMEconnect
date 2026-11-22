import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Banknote, CalendarCheck, Handshake, MapPin, MessageCircle, PieChart, ShieldCheck, Star, TrendingUp, UsersRound } from "lucide-react";
import { ProfileHeader } from "@/components/domain/ProfileHeader";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { OfferCard } from "@/components/domain/OfferCard";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { formatBDT } from "@/lib/format";
import { MessageButton } from "@/components/domain/MessageButton";
import { getPerson, listMyOffers, listPeople } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { Avatar } from "@/components/ui/Avatar";

export const metadata = { title: "Investor profile" };

export default async function InvestorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, investors, viewer] = await Promise.all([getPerson(id), listPeople("investor"), getCurrentUser()]);
  if (!result) notFound();
  // Business owners' public page is their business profile.
  if (result.user.role === "business" && result.business) redirect(`/businesses/${result.business.id}`);
  if (result.user.role !== "investor") notFound();
  const investor = result.user;
  const isOwnProfile = viewer?.id === investor.id;

  // Offers are private between the two parties, so only your own profile lists them.
  const offers = isOwnProfile ? await listMyOffers("sent") : [];
  const accepted = offers.filter((offer) => offer.status === "accepted");
  const agreedReturn = accepted.length
    ? (accepted.reduce((sum, offer) => sum + offer.rate * offer.amount, 0) / accepted.reduce((sum, offer) => sum + offer.amount, 0)).toFixed(1)
    : null;
  const peers = investors.filter((person) => person.id !== investor.id).slice(0, 3);

  return (
    <>
      <ProfileHeader
        person={investor}
        actions={
          <>
            {isOwnProfile ? (
              <LinkButton href="/investor-dashboard" variant="outline">Investor Hub</LinkButton>
            ) : (
              <>
                <ConnectButton name={investor.name} />
                <MessageButton participantId={investor.id}><MessageCircle className="h-4 w-4" aria-hidden /> Message</MessageButton>
              </>
            )}
            <LinkButton href="/explore" variant="secondary"><Handshake className="h-4 w-4" aria-hidden /> Explore requests</LinkButton>
          </>
        }
      />

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-space-lg">
          <div className="grid gap-space-md sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard icon={Banknote} label="Total committed" value={formatBDT(investor.committed ?? 0)} hint={`Across ${investor.offersMade ?? 0} offers`} />
            <StatCard icon={UsersRound} label="Connections" value={String(investor.connections)} hint="Verified founders and peers" tone="secondary" />
            <StatCard icon={TrendingUp} label="Agreed return" value={agreedReturn ? `${agreedReturn}%` : "—"} hint={agreedReturn ? "Weighted across agreements" : isOwnProfile ? "No agreements yet" : "Shared with connections"} tone="success" />
            <StatCard icon={Star} label="Rating" value={investor.rating ? `${investor.rating}` : "New"} hint="From business partners" tone="warning" />
          </div>

          {investor.verified && (
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
          )}

          {offers.length > 0 && (
            <section>
              <SectionHeading eyebrow="Activity" title="Your recent offers" description="Only you and each business owner can see these." />
              <div className="mt-space-md space-y-space-sm">{offers.slice(0, 5).map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>
            </section>
          )}

          {isOwnProfile && (
          <Card className="p-space-lg">
            <SectionHeading eyebrow="History" title="Businesses supported" />
            <div className="mt-space-md space-y-space-sm">
              {accepted.length === 0 && (
                <p className="rounded-xl bg-surface-container-low p-space-md text-body-sm text-on-surface-variant">
                  No agreements yet. Accepted offers will show up here.
                </p>
              )}
              {accepted.map((offer) => (
                <Link key={offer.id} href={`/loans/${offer.requestId}/agreement`} className="flex items-center justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md transition-colors hover:bg-surface-container">
                  <div><p className="text-label-md font-bold text-on-surface">{offer.request.business.name}</p><p className="text-body-sm text-outline">{offer.request.business.category} · {offer.request.title}</p></div>
                  <div className="text-right"><p className="text-label-md font-bold text-primary">{formatBDT(offer.amount)}</p><p className="text-body-sm text-outline">{offer.rate}% p.a. · {offer.tenureMonths} mo</p></div>
                </Link>
              ))}
            </div>
          </Card>
          )}
        </div>

        <aside className="space-y-space-md">
          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Verification & trust</h2></div>
            <div className="mt-space-md space-y-space-sm">
              {investor.verified ? (
                ["NID & biometric verified", "Bank account linked", "Funding commitment honoured", "Fast responder"].map((item) => (
                  <div key={item} className="flex items-center gap-space-sm text-body-sm text-on-surface-variant"><BadgeCheck className="h-4 w-4 text-success" aria-hidden /> {item}</div>
                ))
              ) : (
                <p className="text-body-sm text-on-surface-variant">Identity verification is in progress. Checks appear here once they&apos;re complete.</p>
              )}
            </div>
          </Card>

          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><PieChart className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Co-investors</h2></div>
            <div className="mt-space-md space-y-space-sm">
              {peers.map((peer) => (
                <Link key={peer.id} href={`/investors/${peer.id}`} className="flex items-center gap-space-sm rounded-xl p-space-sm transition-colors hover:bg-surface-container-low">
                  <Avatar src={peer.avatar} alt={peer.name} size="sm" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-label-md font-bold text-on-surface">{peer.name}</span><span className="block truncate text-body-sm text-outline">{formatBDT(peer.committed ?? 0)} committed</span></span>
                  <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                </Link>
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
            <p className="mt-1">Member since {investor.joined} · {investor.followers ?? 0} followers</p>
          </div>
        </aside>
      </div>
    </>
  );
}
