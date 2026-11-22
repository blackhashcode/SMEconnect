/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Bookmark, FilePlus2, Handshake, MapPin, MessageCircle, Share2, Star, TrendingUp, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FilterBar } from "@/components/domain/FilterBar";
import { FeedTabs } from "@/components/domain/FeedTabs";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { businesses } from "@/data/businesses";
import { formatBDT, loanRequests, loansByBusiness } from "@/data/loans";
import { people, personById } from "@/data/users";
import { images } from "@/data/images";

export const metadata = { title: "Home feed" };

export default function FeedPage() {
  const currentUser = personById("rafiq");
  const featuredLoan = loanRequests[0];
  const featuredBusiness = businesses[0];
  const featuredOwner = personById(featuredBusiness.ownerId);
  const suggested = people.filter((person) => person.id !== "rafiq").slice(0, 4);

  return (
    <AppShell>
      <div className="grid gap-space-lg lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="space-y-space-md">
          <div className="overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
            <div className="h-20 bg-gradient-to-r from-primary via-primary-container to-secondary-container" />
            <div className="-mt-8 px-space-md pb-space-md">
              <Avatar src={currentUser?.avatar ?? images["avatar-placeholder"]} alt={currentUser?.name ?? "Member"} size="lg" className="ring-4 ring-surface-container-lowest" />
              <p className="mt-space-sm text-headline-sm text-on-surface">{currentUser?.name}</p>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">{currentUser?.headline}</p>
              <div className="mt-space-md grid grid-cols-2 gap-space-sm border-t border-surface-container-high pt-space-md text-center">
                <div><p className="text-label-md font-bold text-on-surface">{currentUser?.connections}</p><p className="text-label-sm text-outline">Connections</p></div>
                <div><p className="text-label-md font-bold text-on-surface">{currentUser?.offersMade}</p><p className="text-label-sm text-outline">Offers made</p></div>
              </div>
              <LinkButton href="/investors/rafiq" variant="soft" size="sm" className="mt-space-md w-full">View my profile</LinkButton>
            </div>
          </div>

          <nav className="rounded-2xl bg-surface-container-lowest p-space-sm card-shadow">
            {[
              { label: "Loan requests", href: "/feed", icon: FilePlus2, count: loanRequests.length },
              { label: "Messages", href: "/messages", icon: MessageCircle, count: 2 },
              { label: "My connections", href: "/investors/rafiq", icon: UserPlus },
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
              <Avatar src={currentUser?.avatar ?? images["avatar-placeholder"]} alt={currentUser?.name ?? "Member"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-label-md font-bold text-on-surface">Share an update with your network</p>
                <div className="mt-space-sm flex flex-wrap gap-space-sm">
                  <Link href="/loans/offers/new?request=lr-1" className="flex items-center gap-1.5 rounded-full bg-secondary-fixed px-space-md py-2 text-label-sm font-bold text-secondary hover:bg-secondary-fixed-dim">
                    <Handshake className="h-4 w-4" aria-hidden /> Make an offer
                  </Link>
                  <Link href="/loans/request/new" className="flex items-center gap-1.5 rounded-full bg-primary-fixed px-space-md py-2 text-label-sm font-bold text-primary hover:bg-primary-fixed-dim">
                    <FilePlus2 className="h-4 w-4" aria-hidden /> Request a loan
                  </Link>
                  <button type="button" className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-space-md py-2 text-label-sm font-bold text-on-surface-variant hover:text-primary"><Share2 className="h-4 w-4" aria-hidden /> Share</button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-space-md"><FeedTabs /></div>
        </div>

        <aside className="space-y-space-md">
          <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
            <div className="flex items-center justify-between"><p className="text-headline-sm text-on-surface">Featured request</p><Badge tone="secondary">Live</Badge></div>
            <div className="mt-space-sm overflow-hidden rounded-xl"><img src={featuredLoan.image} alt="Featured loan request" className="h-28 w-full object-cover" /></div>
            <div className="mt-space-sm flex items-center gap-space-sm">
              {featuredOwner && <Avatar src={featuredOwner.avatar} alt={featuredOwner.name} size="sm" />}
              <div><div className="flex items-center gap-1"><p className="text-label-md font-bold text-on-surface">{featuredBusiness.name}</p><VerifiedBadge compact /></div><p className="text-body-sm text-outline">{featuredBusiness.location}</p></div>
            </div>
            <p className="mt-space-sm text-body-sm text-on-surface-variant">{featuredLoan.title}</p>
            <div className="mt-space-sm flex items-center justify-between text-label-md font-bold"><span className="text-primary">{formatBDT(featuredLoan.amount)}</span><span className="text-success">{featuredLoan.rate}% p.a.</span></div>
            <ProgressBar value={featuredLoan.progress} className="mt-space-sm" showValue={false} />
            <Link href={`/businesses/${featuredBusiness.id}`} className="mt-space-sm flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">View request <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
          </div>

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
                  <Link href={person.role === "business" ? `/businesses/${businesses.find((b) => b.ownerId === person.id)?.id ?? "crave-co"}` : `/investors/${person.id}`} aria-label={`View ${person.name}`} className="rounded-full bg-surface-container-high p-2 text-primary hover:bg-primary-fixed"><UserPlus className="h-4 w-4" aria-hidden /></Link>
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
    </AppShell>
  );
}
