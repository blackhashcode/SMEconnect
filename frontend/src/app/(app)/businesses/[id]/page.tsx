import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, CalendarDays, ExternalLink, Handshake, Hourglass, MapPin, MessageCircle, ShieldCheck, Star, TrendingUp, Wallet } from "lucide-react";
import { ProfileHeader } from "@/components/domain/ProfileHeader";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { LoanCard } from "@/components/domain/LoanCard";
import { MessageButton } from "@/components/domain/MessageButton";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { StatCard } from "@/components/ui/StatCard";
import { getProfile, listBusinesses, listOpenLoanRequests, reviewsFor } from "@/lib/api";
import { formatBDT, formatBDTCompact, shortDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Business profile" };

export default async function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, viewer, openLoans, directory, reviews] = await Promise.all([getProfile(id), getCurrentUser(), listOpenLoanRequests(), listBusinesses(), reviewsFor(id)]);
  if (!profile) notFound();
  if (!profile.business) redirect(`/investors/${id}`);
  const { person: owner, business } = profile;
  const isOwnProfile = viewer?.id === owner.id;
  const activeLoan = openLoans.find((loan) => loan.owner.id === id);
  const related = directory.filter((entry) => entry.business.id !== id).slice(0, 3);
  const sales = business.salesMin !== null && business.salesMax !== null ? `${formatBDT(business.salesMin)}–${formatBDT(business.salesMax)}` : null;
  const salesShort = business.salesMin !== null && business.salesMax !== null ? `${formatBDTCompact(business.salesMin)}–${formatBDTCompact(business.salesMax)}` : null;
  const averageRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <>
      <ProfileHeader
        person={{ ...owner, cover: business.image, about: "" }}
        actions={
          isOwnProfile ? (
            <>
              <LinkButton href="/onboarding" variant="outline">Edit profile</LinkButton>
              <LinkButton href="/loans/new" variant="secondary"><Handshake className="h-4 w-4" aria-hidden /> New loan request</LinkButton>
            </>
          ) : viewer && viewer.role !== "admin" ? (
            <>
              <ConnectButton userId={owner.id} name={owner.name} />
              <MessageButton participantId={owner.id}><MessageCircle className="h-4 w-4" aria-hidden /> Message</MessageButton>
              {activeLoan && viewer.role === "investor" && (
                <LinkButton href={`/loan-requests/${activeLoan.id}/offer`} variant="secondary"><Handshake className="h-4 w-4" aria-hidden /> Make an offer</LinkButton>
              )}
            </>
          ) : null
        }
      />

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-space-lg">
          <div className="grid gap-space-md sm:grid-cols-2">
            <StatCard icon={TrendingUp} label="Monthly sales" value={salesShort ?? "—"} hint={sales ? "Owner reported" : "Not shared yet"} />
            <StatCard icon={Building2} label="Monthly orders" value={business.ordersRange ?? "—"} hint={business.runningSince ? `Running since ${new Date(business.runningSince).getFullYear()}` : undefined} tone="secondary" />
            <StatCard icon={Star} label="Reviews" value={averageRating ?? "New"} hint={`${reviews.length} from completed loans`} tone="warning" />
            <StatCard icon={ShieldCheck} label="Trust score" value={String(business.trustScore)} hint={business.verified ? "Identity verified" : "Verification pending"} tone="success" />
          </div>

          <Card className="p-space-lg">
            <SectionHeading eyebrow="About" title={`About ${business.name}`} />
            {business.description && <p className="mt-space-md text-body-md leading-relaxed text-on-surface-variant">{business.description}</p>}
            {business.growthStory && <p className="mt-space-sm text-body-md leading-relaxed text-on-surface-variant">{business.growthStory}</p>}
            {business.links.length > 0 && (
              <div className="mt-space-md flex flex-wrap gap-space-sm">
                {business.links.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 rounded-full bg-primary-fixed px-space-md py-1.5 text-label-md font-semibold text-primary transition-colors hover:bg-primary-fixed-dim">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> {link.label}
                  </a>
                ))}
              </div>
            )}
          </Card>

          {activeLoan && (
            <section>
              <SectionHeading eyebrow="Current request" title="Open loan request" description="Direct offers from verified investors, with terms you agree together." />
              <div className="mt-space-md"><LoanCard loan={activeLoan} /></div>
            </section>
          )}

          {business.gallery.length > 0 && (
            <Card className="p-space-lg">
              <SectionHeading eyebrow="Gallery" title="Products" />
              <div className="mt-space-md grid grid-cols-2 gap-space-sm md:grid-cols-3">
                {business.gallery.map((src, index) => (
                  <Photo key={src} src={src} alt={`${business.name} product ${index + 1}`} className="group aspect-[4/3] w-full rounded-xl" sizes="(min-width: 768px) 25vw, 50vw" zoomOnHover />
                ))}
              </div>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card className="p-space-lg">
              <SectionHeading eyebrow="Reputation" title="Reviews from investors" />
              <ul className="mt-space-md space-y-space-sm">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-xl bg-surface-container-low p-space-md">
                    <p className="flex items-center gap-1 text-label-md font-bold text-warning">
                      {Array.from({ length: review.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" aria-hidden />)}
                      <span className="ml-1 text-on-surface">{review.reviewer.name}</span>
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
            <h2 className="text-headline-sm text-on-surface">Business details</h2>
            <dl className="mt-space-md space-y-space-md">
              {[
                { icon: MapPin, label: "Location", value: business.location },
                { icon: Building2, label: "Category", value: business.category },
                { icon: CalendarDays, label: "Running since", value: business.runningSince ? shortDate(business.runningSince) : "—" },
                { icon: Wallet, label: "Monthly sales", value: sales ?? "Not shared" },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-space-sm">
                  <row.icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                  <div><dt className="text-label-sm text-outline">{row.label}</dt><dd className="text-label-md font-semibold text-on-surface">{row.value}</dd></div>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-space-lg">
            <h2 className="flex items-center gap-space-sm text-headline-sm text-on-surface"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Trust checks</h2>
            <div className="mt-space-md space-y-space-sm">
              {["Identity document", "Sales records", "Shop links"].map((item) => (
                <div key={item} className="flex items-center gap-space-sm text-body-sm text-on-surface-variant">
                  {business.verified ? <BadgeCheck className="h-4 w-4 text-success" aria-hidden /> : <Hourglass className="h-4 w-4 text-warning" aria-hidden />}
                  {item} {business.verified ? "reviewed" : "pending review"}
                </div>
              ))}
            </div>
            <div className="mt-space-md"><Badge tone={business.verified ? "success" : "warning"}>Trust score {business.trustScore}</Badge></div>
          </Card>

          {related.length > 0 && (
            <Card className="p-space-lg">
              <h2 className="text-headline-sm text-on-surface">More businesses</h2>
              <div className="mt-space-md space-y-space-sm">
                {related.map(({ business: item }) => (
                  <Link key={item.id} href={`/businesses/${item.id}`} className="flex items-center gap-space-sm rounded-xl p-space-sm transition-colors hover:bg-surface-container-low">
                    <Photo src={item.image} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg" sizes="40px" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-label-md font-bold text-on-surface">{item.name}</span><span className="block truncate text-body-sm text-outline">{item.category}</span></span>
                    <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
