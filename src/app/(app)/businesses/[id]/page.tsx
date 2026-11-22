import { notFound } from "next/navigation";
import Link from "next/link";
import { Hourglass, ArrowUpRight, BadgeCheck, Building2, CalendarDays, FileCheck2, Handshake, MapPin, MessageCircle, Star, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { ProfileHeader } from "@/components/domain/ProfileHeader";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { LoanCard } from "@/components/domain/LoanCard";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { formatBDT } from "@/lib/format";
import { MessageButton } from "@/components/domain/MessageButton";
import { isActiveLoan } from "@/lib/loans";
import { getBusiness, listBusinesses, listLoans } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { Photo } from "@/components/ui/Photo";

export const metadata = { title: "Business profile" };

export default async function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, all, viewer, loans] = await Promise.all([getBusiness(id), listBusinesses(), getCurrentUser(), listLoans({ businessId: id })]);
  if (!result?.owner) notFound();
  const { business, owner } = result;
  const isOwnProfile = viewer?.id === owner.id;

  const activeLoan = loans.find(isActiveLoan);
  const pastLoans = loans.filter((loan) => loan !== activeLoan);
  const related = all.filter((item) => item.id !== business.id).slice(0, 3);

  return (
    <>
      <ProfileHeader
        person={owner}
        actions={
          <>
            {isOwnProfile ? (
              <>
                <LinkButton href="/business-dashboard" variant="outline">Business Hub</LinkButton>
                <LinkButton href="/loans/request/new" variant="secondary"><Handshake className="h-4 w-4" aria-hidden /> New loan request</LinkButton>
              </>
            ) : (
              <>
                <ConnectButton name={owner.name} />
                <MessageButton participantId={owner.id} subject={business.name}><MessageCircle className="h-4 w-4" aria-hidden /> Message</MessageButton>
                {activeLoan && viewer?.role === "investor" && <LinkButton href={`/loans/offers/new?request=${activeLoan.id}`} variant="secondary"><Handshake className="h-4 w-4" aria-hidden /> Make an offer</LinkButton>}
              </>
            )}
          </>
        }
      />

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-space-lg">
          <div className="grid gap-space-md sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Monthly revenue"
              value={business.monthlyRevenue ? formatBDT(business.monthlyRevenue) : "—"}
              hint={business.monthlyRevenue ? "Verified merchant records" : "Not shared yet"}
            />
            <StatCard icon={UsersRound} label="Team" value={business.teamSize || "—"} hint={`Founded ${business.founded}`} tone="secondary" />
            <StatCard icon={Star} label="Rating" value={owner.rating ? `${owner.rating}` : "New"} hint={`${owner.followers ?? 0} followers`} tone="warning" />
            <StatCard
              icon={BadgeCheck}
              label="Trust score"
              value={business.verified ? "810" : "Pending"}
              hint={business.verified ? "Low risk · Grade A" : "Verification in progress"}
              tone="success"
            />
          </div>

          <Card className="p-space-lg">
            <SectionHeading eyebrow="About" title={`About ${business.name}`} />
            <p className="mt-space-md text-body-md leading-relaxed text-on-surface-variant">{business.description}</p>
            {business.specialties.length > 0 && (
              <div className="mt-space-md flex flex-wrap gap-space-sm">
                {business.specialties.map((item) => <Badge key={item} tone="primary">{item}</Badge>)}
              </div>
            )}
          </Card>

          {activeLoan && (
            <section>
              <SectionHeading eyebrow="Current request" title="Open loan request" description="Direct offers from verified investors with terms you agree together." />
              <div className="mt-space-md"><LoanCard loan={activeLoan} featured /></div>
            </section>
          )}

          {business.gallery.length > 0 && (
          <Card className="p-space-lg">
            <SectionHeading eyebrow="Gallery" title="Work & products" />
            <div className="mt-space-md grid grid-cols-2 gap-space-sm md:grid-cols-3">
              {business.gallery.map((src, index) => (
                <Photo key={src} src={src} alt={`${business.name} gallery ${index + 1}`} className="group aspect-[4/3] w-full rounded-xl" sizes="(min-width: 768px) 25vw, 50vw" zoomOnHover />
              ))}
            </div>
          </Card>
          )}

          {pastLoans.length > 0 && (
            <section>
              <SectionHeading eyebrow="More" title={pastLoans.some(isActiveLoan) ? "Other requests" : "Previous requests"} />
              <div className="mt-space-md space-y-space-sm">{pastLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}</div>
            </section>
          )}
        </div>

        <aside className="space-y-space-md">
          <Card className="p-space-lg">
            <h2 className="text-headline-sm text-on-surface">Business details</h2>
            <dl className="mt-space-md space-y-space-md">
              <div className="flex items-start gap-space-sm"><MapPin className="mt-0.5 h-4 w-4 text-primary" aria-hidden /><div><dt className="text-label-sm text-outline">Location</dt><dd className="text-label-md font-semibold text-on-surface">{business.location}</dd></div></div>
              <div className="flex items-start gap-space-sm"><Building2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden /><div><dt className="text-label-sm text-outline">Category</dt><dd className="text-label-md font-semibold text-on-surface">{business.category}</dd></div></div>
              <div className="flex items-start gap-space-sm"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" aria-hidden /><div><dt className="text-label-sm text-outline">Operating since</dt><dd className="text-label-md font-semibold text-on-surface">{business.founded}</dd></div></div>
              <div className="flex items-start gap-space-sm"><Wallet className="mt-0.5 h-4 w-4 text-primary" aria-hidden /><div><dt className="text-label-sm text-outline">Monthly revenue</dt><dd className="text-label-md font-semibold text-on-surface">{formatBDT(business.monthlyRevenue)}</dd></div></div>
            </dl>
          </Card>

          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><ShieldCheckIcon /><h2 className="text-headline-sm text-on-surface">Trust scorecard</h2></div>
            <div className="mt-space-md space-y-space-sm">
              {["NID", "Trade licence", "Merchant statements", "Repayment record"].map((item) => (
                <div key={item} className="flex items-center gap-space-sm text-body-sm text-on-surface-variant">
                  {business.verified ? <BadgeCheck className="h-4 w-4 text-success" aria-hidden /> : <Hourglass className="h-4 w-4 text-warning" aria-hidden />}
                  {item} {business.verified ? "verified" : "· pending review"}
                </div>
              ))}
            </div>
            <div className="mt-space-md">
              {business.verified ? <Badge tone="success">Low risk · 810/850</Badge> : <Badge tone="warning">Not yet scored</Badge>}
            </div>
          </Card>

          <Card className="p-space-lg">
            <h2 className="text-headline-sm text-on-surface">More businesses</h2>
            <div className="mt-space-md space-y-space-sm">
              {related.map((item) => (
                <Link key={item.id} href={`/businesses/${item.id}`} className="flex items-center gap-space-sm rounded-xl p-space-sm transition-colors hover:bg-surface-container-low">
                  <Photo src={item.image} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg" sizes="40px" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-label-md font-bold text-on-surface">{item.name}</span><span className="block truncate text-body-sm text-outline">{item.category}</span></span>
                  <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                </Link>
              ))}
            </div>
          </Card>

          {!isOwnProfile && (
          <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <FileCheck2 className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Want to see the full file?</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Verified records are shared after you connect with the owner.</p>
            <Button variant="outline" size="sm" className="mt-space-md w-full border-primary/20 bg-white/60">Request connection</Button>
          </div>
          )}
        </aside>
      </div>
    </>
  );
}

function ShieldCheckIcon() {
  return <BadgeCheck className="h-5 w-5 text-primary" aria-hidden />;
}
