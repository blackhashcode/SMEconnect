import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarCheck, Hourglass, MessageCircle, Search, ShieldCheck, Star, Wallet } from "lucide-react";
import { ProfileHeader } from "@/components/domain/ProfileHeader";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { MessageButton } from "@/components/domain/MessageButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { getProfile, listInvestors, reviewsFor } from "@/lib/api";
import { formatBDT, shortDate } from "@/lib/format";
import { tenureLabel } from "@/lib/loans";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Investor profile" };

export default async function InvestorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, viewer, investors, reviews] = await Promise.all([getProfile(id), getCurrentUser(), listInvestors(), reviewsFor(id)]);
  if (!profile) notFound();
  // Business owners' public page is their business profile.
  if (profile.business) redirect(`/businesses/${id}`);
  const { person: investor, investor: prefs } = profile;
  const isOwnProfile = viewer?.id === investor.id;
  const peers = investors.filter((person) => person.id !== id).slice(0, 3);
  const averageRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;
  const rateRange =
    prefs?.preferredRatePctMin && prefs?.preferredRatePctMax ? `${Number(prefs.preferredRatePctMin)}–${Number(prefs.preferredRatePctMax)}% p.a.` : null;

  const preferences = prefs
    ? [
        { label: "Offer range", value: `${formatBDT(prefs.minLendBdt)} – ${formatBDT(prefs.maxLendBdt)}` },
        { label: "Preferred categories", value: prefs.preferredCategories.length ? prefs.preferredCategories.join(", ") : "Open to any" },
        { label: "Preferred tenure", value: prefs.preferredTenureDays ? tenureLabel(prefs.preferredTenureDays) : "Flexible" },
        { label: "Preferred rate", value: rateRange ?? "Negotiable" },
      ]
    : [];

  return (
    <>
      <ProfileHeader
        person={investor}
        actions={
          isOwnProfile ? (
            <LinkButton href="/onboarding" variant="outline">Edit profile</LinkButton>
          ) : viewer && viewer.role !== "admin" ? (
            <>
              <ConnectButton userId={investor.id} name={investor.name} />
              <MessageButton participantId={investor.id}><MessageCircle className="h-4 w-4" aria-hidden /> Message</MessageButton>
            </>
          ) : null
        }
      />

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-space-lg">
          <div className="grid gap-space-md sm:grid-cols-3">
            <StatCard icon={Wallet} label="Lends" value={prefs ? formatBDT(prefs.maxLendBdt) : "—"} hint={prefs ? `From ${formatBDT(prefs.minLendBdt)}` : "Profile not complete"} />
            <StatCard icon={Star} label="Reviews" value={averageRating ?? "New"} hint={`${reviews.length} from completed loans`} tone="warning" />
            <StatCard icon={ShieldCheck} label="Trust score" value={String(investor.trustScore)} hint={investor.verified ? "Identity verified" : "Verification pending"} tone="success" />
          </div>

          {preferences.length > 0 && (
            <Card className="p-space-lg">
              <SectionHeading eyebrow="Preferences" title="Lending preferences" />
              <div className="mt-space-md grid gap-space-md sm:grid-cols-2">
                {preferences.map((item) => (
                  <div key={item.label} className="rounded-xl bg-surface-container-low p-space-md">
                    <p className="text-label-sm text-outline">{item.label}</p>
                    <p className="mt-0.5 text-label-md font-bold text-on-surface">{item.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card className="p-space-lg">
              <SectionHeading eyebrow="Reputation" title="Reviews from businesses" />
              <ul className="mt-space-md space-y-space-sm">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-xl bg-surface-container-low p-space-md">
                    <p className="flex items-center gap-1 text-label-md font-bold text-warning">
                      {Array.from({ length: review.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" aria-hidden />)}
                      <span className="ml-1 text-on-surface">{review.reviewer.shopName ?? review.reviewer.name}</span>
                    </p>
                    {review.comment && <p className="mt-1 text-body-md text-on-surface-variant">{review.comment}</p>}
                    <p className="mt-1 text-body-sm text-outline">{shortDate(review.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-space-md">
          <Card className="p-space-lg">
            <h2 className="flex items-center gap-space-sm text-headline-sm text-on-surface"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Verification</h2>
            <div className="mt-space-md space-y-space-sm text-body-sm text-on-surface-variant">
              <p className="flex items-center gap-space-sm">
                {investor.verified ? <BadgeCheck className="h-4 w-4 text-success" aria-hidden /> : <Hourglass className="h-4 w-4 text-warning" aria-hidden />}
                Identity document {investor.verified ? "reviewed" : "pending review"}
              </p>
            </div>
            <div className="mt-space-md"><Badge tone={investor.verified ? "success" : "warning"}>Trust score {investor.trustScore}</Badge></div>
          </Card>

          {peers.length > 0 && (
            <Card className="p-space-lg">
              <h2 className="text-headline-sm text-on-surface">Other investors</h2>
              <div className="mt-space-md space-y-space-sm">
                {peers.map((peer) => (
                  <Link key={peer.id} href={`/investors/${peer.id}`} className="flex items-center gap-space-sm rounded-xl p-space-sm transition-colors hover:bg-surface-container-low">
                    <Avatar src={peer.avatar} alt={peer.name} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-label-md font-bold text-on-surface">{peer.name}</span><span className="block truncate text-body-sm text-outline">{peer.headline}</span></span>
                    <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <CalendarCheck className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Looking for businesses to back?</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Browse verified requests and send terms directly to owners.</p>
            <LinkButton href="/explore" variant="outline" size="sm" className="mt-space-md w-full border-primary/20 bg-white/60"><Search className="h-4 w-4" aria-hidden /> Explore requests</LinkButton>
          </div>
        </aside>
      </div>
    </>
  );
}
