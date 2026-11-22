/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, CalendarDays, FileCheck2, Handshake, MapPin, MessageCircle, Star, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileHeader } from "@/components/domain/ProfileHeader";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { LoanCard } from "@/components/domain/LoanCard";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { businessById, businesses } from "@/data/businesses";
import { formatBDT, loansByBusiness } from "@/data/loans";
import { personById } from "@/data/users";

export const metadata = { title: "Business profile" };

export default async function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = businessById(id);
  if (!business) notFound();

  const owner = personById(business.ownerId);
  if (!owner) notFound();
  const loans = loansByBusiness(business.id);
  const activeLoan = loans[0];
  const related = businesses.filter((item) => item.id !== business.id).slice(0, 3);

  return (
    <AppShell>
      <ProfileHeader
        person={owner}
        actions={
          <>
            <ConnectButton name={owner.name} />
            <LinkButton href="/messages" variant="outline"><MessageCircle className="h-4 w-4" aria-hidden /> Message</LinkButton>
            {activeLoan && <LinkButton href={`/loans/offers/new?request=${activeLoan.id}`} variant="secondary"><Handshake className="h-4 w-4" aria-hidden /> Make an offer</LinkButton>}
          </>
        }
      />

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[1fr_320px]">
        <div className="space-y-space-lg">
          <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={TrendingUp} label="Monthly revenue" value={formatBDT(business.monthlyRevenue)} hint="Verified merchant records" />
            <StatCard icon={UsersRound} label="Team" value={business.teamSize} hint={`Founded ${business.founded}`} tone="secondary" />
            <StatCard icon={Star} label="Rating" value={`${owner.rating}`} hint={`${owner.followers} followers`} tone="warning" />
            <StatCard icon={BadgeCheck} label="Trust score" value="810" hint="Low risk · Grade A" tone="success" />
          </div>

          <Card className="p-space-lg">
            <SectionHeading eyebrow="About" title={`About ${business.name}`} />
            <p className="mt-space-md text-body-md leading-relaxed text-on-surface-variant">{business.description}</p>
            <div className="mt-space-md flex flex-wrap gap-space-sm">
              {business.specialties.map((item) => <Badge key={item} tone="primary">{item}</Badge>)}
            </div>
          </Card>

          {activeLoan && (
            <section>
              <SectionHeading eyebrow="Current request" title="Open loan request" description="Direct offers from verified investors with terms you agree together." />
              <div className="mt-space-md"><LoanCard loan={activeLoan} featured /></div>
            </section>
          )}

          <Card className="p-space-lg">
            <SectionHeading eyebrow="Gallery" title="Work & products" />
            <div className="mt-space-md grid grid-cols-2 gap-space-sm md:grid-cols-3">
              {business.gallery.map((src, index) => <img key={src} src={src} alt={`${business.name} gallery ${index + 1}`} className="h-36 w-full rounded-xl object-cover" />)}
            </div>
          </Card>

          {loans.length > 1 && (
            <section>
              <SectionHeading eyebrow="History" title="Previous requests" />
              <div className="mt-space-md space-y-space-sm">{loans.slice(1).map((loan) => <LoanCard key={loan.id} loan={loan} />)}</div>
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
              {["NID verified", "Trade licence verified", "Merchant statements reviewed", "Repayment record checked"].map((item) => (
                <div key={item} className="flex items-center gap-space-sm text-body-sm text-on-surface-variant"><BadgeCheck className="h-4 w-4 text-success" aria-hidden /> {item}</div>
              ))}
            </div>
            <div className="mt-space-md"><Badge tone="success">Low risk · 810/850</Badge></div>
          </Card>

          <Card className="p-space-lg">
            <h2 className="text-headline-sm text-on-surface">More businesses</h2>
            <div className="mt-space-md space-y-space-sm">
              {related.map((item) => (
                <Link key={item.id} href={`/businesses/${item.id}`} className="flex items-center gap-space-sm rounded-xl p-space-sm transition-colors hover:bg-surface-container-low">
                  <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-label-md font-bold text-on-surface">{item.name}</span><span className="block truncate text-body-sm text-outline">{item.category}</span></span>
                  <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                </Link>
              ))}
            </div>
          </Card>

          <div className="rounded-2xl bg-primary-fixed p-space-lg text-on-primary-fixed">
            <FileCheck2 className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Want to see the full file?</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Verified records are shared after you connect with the owner.</p>
            <Button variant="outline" size="sm" className="mt-space-md w-full border-primary/20 bg-white/60">Request connection</Button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function ShieldCheckIcon() {
  return <BadgeCheck className="h-5 w-5 text-primary" aria-hidden />;
}
