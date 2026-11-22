import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Bookmark, FilePlus2, Handshake, MapPin, MessageCircle, Share2, Star, TrendingUp, UserPlus } from "lucide-react";
import { FilterBar } from "@/components/domain/FilterBar";
import { FeedTabs } from "@/components/domain/FeedTabs";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBDT } from "@/lib/format";
import { listBusinesses, listLoans, listPeople, unreadMessageCount } from "@/lib/api";
import { profileHref } from "@/lib/profile";
import { requireUser } from "@/lib/session";
import { Photo } from "@/components/ui/Photo";

export const metadata = { title: "Home feed" };

export default async function FeedPage() {
  const currentUser = await requireUser("/feed");
  const [members, directory, loans, unread] = await Promise.all([listPeople(), listBusinesses(), listLoans({ status: "active" }), unreadMessageCount()]);
  const myProfile = profileHref(currentUser, currentUser.businessId);
  // Spotlight the most-offered open request from someone else.
  const featuredLoan = [...loans].filter((loan) => loan.owner.id !== currentUser.id).sort((a, b) => b.offersCount - a.offersCount)[0];
  const isInvestor = currentUser.role === "investor";
  const suggested = members.filter((person) => person.id !== currentUser.id).slice(0, 4);

  return (
    <>
      <div className="grid gap-space-lg lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="hidden space-y-space-md lg:block">
          <div className="overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
            <div className="h-20 bg-gradient-to-r from-primary via-primary-container to-secondary-container" />
            <div className="-mt-8 px-space-md pb-space-md">
              <Avatar src={currentUser.avatar} alt={currentUser.name} size="lg" priority className="ring-4 ring-surface-container-lowest" />
              <p className="mt-space-sm text-headline-sm text-on-surface">{currentUser.name}</p>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">{currentUser.headline}</p>
              <div className="mt-space-md grid grid-cols-2 gap-space-sm border-t border-surface-container-high pt-space-md text-center">
                <div><p className="text-label-md font-bold text-on-surface">{currentUser.connections}</p><p className="text-label-sm text-outline">Connections</p></div>
                {currentUser.role === "business" ? (
                  <div><p className="text-label-md font-bold text-on-surface">{currentUser.completedLoans ?? 0}</p><p className="text-label-sm text-outline">Loans repaid</p></div>
                ) : (
                  <div><p className="text-label-md font-bold text-on-surface">{currentUser.offersMade ?? 0}</p><p className="text-label-sm text-outline">Offers made</p></div>
                )}
              </div>
              <LinkButton href={myProfile} variant="soft" size="sm" className="mt-space-md w-full">View my profile</LinkButton>
            </div>
          </div>

          <nav className="rounded-2xl bg-surface-container-lowest p-space-sm card-shadow">
            {[
              { label: "Loan requests", href: "/explore", icon: FilePlus2, count: loans.length },
              { label: "Messages", href: "/messages", icon: MessageCircle, count: unread || undefined },
              { label: "My profile", href: myProfile, icon: UserPlus },
              { label: "Saved offers", href: "/investor-dashboard", icon: Bookmark },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center gap-space-sm rounded-xl px-space-sm py-2.5 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary">
                <item.icon className="h-4 w-4 text-primary" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.count && <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold">{item.count}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <FilterBar />
          <div className="mt-space-md rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
            <div className="flex items-start gap-space-sm">
              <Avatar src={currentUser.avatar} alt={currentUser.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-label-md font-bold text-on-surface">Share an update with your network</p>
                <div className="mt-space-sm flex flex-wrap gap-space-sm">
                  {isInvestor && featuredLoan && (
                    <Link href={`/loans/offers/new?request=${featuredLoan.id}`} className="flex items-center gap-1.5 rounded-full bg-secondary-fixed px-space-md py-2 text-label-sm font-bold text-secondary transition-colors hover:bg-secondary-fixed-dim">
                      <Handshake className="h-4 w-4" aria-hidden /> Make an offer
                    </Link>
                  )}
                  {currentUser.role === "business" && (
                    <Link href="/loans/request/new" className="flex items-center gap-1.5 rounded-full bg-primary-fixed px-space-md py-2 text-label-sm font-bold text-primary transition-colors hover:bg-primary-fixed-dim">
                      <FilePlus2 className="h-4 w-4" aria-hidden /> Request a loan
                    </Link>
                  )}
                  <Link href="/explore" className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-space-md py-2 text-label-sm font-bold text-on-surface-variant transition-colors hover:text-primary">
                    <Share2 className="h-4 w-4" aria-hidden /> Explore
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-space-md"><FeedTabs loans={loans} businesses={directory} members={members} /></div>
        </div>

        <aside className="space-y-space-md">
          {featuredLoan && (
          <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
            <div className="flex items-center justify-between"><p className="text-headline-sm text-on-surface">Featured request</p><Badge tone="secondary">Live</Badge></div>
            <Photo src={featuredLoan.image} alt="Featured loan request" className="mt-space-sm h-28 w-full rounded-xl" sizes="300px" />
            <div className="mt-space-sm flex items-center gap-space-sm">
              <Avatar src={featuredLoan.owner.avatar} alt={featuredLoan.owner.name} size="sm" />
              <div><div className="flex items-center gap-1"><p className="text-label-md font-bold text-on-surface">{featuredLoan.business.name}</p>{featuredLoan.business.verified && <VerifiedBadge compact />}</div><p className="text-body-sm text-outline">{featuredLoan.business.location}</p></div>
            </div>
            <p className="mt-space-sm text-body-sm text-on-surface-variant">{featuredLoan.title}</p>
            <div className="mt-space-sm flex items-center justify-between text-label-md font-bold"><span className="text-primary">{formatBDT(featuredLoan.amount)}</span><span className="text-success">{featuredLoan.rate}% p.a.</span></div>
            <ProgressBar value={featuredLoan.progress} className="mt-space-sm" showValue={false} />
            <Link href={`/businesses/${featuredLoan.business.id}`} className="mt-space-sm flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">View request <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          )}

          <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
            <p className="text-headline-sm text-on-surface">People to connect with</p>
            <div className="mt-space-sm space-y-space-sm">
              {suggested.map((person) => (
                <div key={person.id} className="flex items-center gap-space-sm">
                  <Avatar src={person.avatar} alt={person.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-md font-bold text-on-surface">{person.name}</p>
                    <p className="truncate text-body-sm text-outline">{person.role === "business" ? "Business owner" : "Investor"} · {person.location}</p>
                  </div>
                  <Link href={profileHref(person, directory.find((b) => b.ownerId === person.id)?.id)} aria-label={`View ${person.name}`} className="rounded-full bg-surface-container-high p-2 text-primary hover:bg-primary-fixed"><UserPlus className="h-4 w-4" aria-hidden /></Link>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-primary p-space-md text-on-primary">
            <TrendingUp className="h-6 w-6" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Direct deals, clear terms</p>
            <p className="mt-1 text-body-sm text-on-primary/80">Investors connect with owners, make offers and track agreed repayments.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
