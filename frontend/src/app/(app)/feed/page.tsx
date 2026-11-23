import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Bell, FilePlus2, Handshake, Hourglass, MessageCircle, Search, TrendingUp, UserPlus } from "lucide-react";
import { FeedTabs } from "@/components/domain/FeedTabs";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { formatBDT, firstName } from "@/lib/format";
import { tenureLabel } from "@/lib/loans";
import { listBusinesses, listInvestors, listOpenLoanRequests } from "@/lib/api";
import { profileHref } from "@/lib/profile";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Home feed" };

export default async function FeedPage() {
  const user = await requireUser("/feed");
  const [directory, investors, loans] = await Promise.all([listBusinesses(), listInvestors(), listOpenLoanRequests()]);
  const owners = directory.map((entry) => entry.owner);
  const members = [...owners, ...investors];
  const featured = loans.find((loan) => loan.owner.id !== user.id && loan.business.image);
  const suggested = (user.role === "investor" ? owners : investors).filter((person) => person.id !== user.id).slice(0, 4);
  const verified = user.verification === "APPROVED";
  const shortcut = [
    { label: "Loan requests", href: "/explore", icon: FilePlus2, count: loans.length },
    { label: "Messages", href: "/messages", icon: MessageCircle, count: user.unread.messages },
    { label: "Notifications", href: "/notifications", icon: Bell, count: user.unread.notifications },
    { label: "My profile", href: user.role === "admin" ? "/admin" : profileHref(user), icon: UserPlus },
  ];

  return (
    <div className="grid gap-space-lg lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="hidden space-y-space-md lg:block">
        <div className="overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow">
          <div className="h-20 bg-gradient-to-r from-primary via-primary-container to-secondary-container" />
          <div className="-mt-8 px-space-md pb-space-md">
            <Avatar src={user.avatar} alt={user.name} name={user.name} size="lg" priority className="ring-4 ring-surface-container-lowest" />
            <p className="mt-space-sm text-headline-sm text-on-surface">{user.name}</p>
            <p className="mt-0.5 text-body-sm capitalize text-on-surface-variant">{user.role === "business" ? "Business owner" : user.role}</p>
            <div className="mt-space-sm">
              {verified ? (
                <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified</Badge>
              ) : user.role !== "admin" ? (
                <Badge tone="warning"><Hourglass className="h-3.5 w-3.5" aria-hidden /> {user.verification === "PENDING" ? "Verification in review" : "Not verified yet"}</Badge>
              ) : null}
            </div>
            {!verified && user.role !== "admin" && (
              <LinkButton href="/onboarding" variant="soft" size="sm" className="mt-space-md w-full">
                {user.verification === "PENDING" ? "View verification" : "Get verified"}
              </LinkButton>
            )}
          </div>
        </div>
        <nav className="rounded-2xl bg-surface-container-lowest p-space-sm card-shadow" aria-label="Shortcuts">
          {shortcut.map((item) => (
            <Link key={item.label} href={item.href} className="flex items-center gap-space-sm rounded-xl px-space-sm py-2.5 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary">
              <item.icon className="h-4 w-4 text-primary" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.count ? <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold">{item.count}</span> : null}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
          <div className="flex items-start gap-space-sm">
            <Avatar src={user.avatar} alt={user.name} name={user.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-label-md font-bold text-on-surface">Welcome back, {firstName(user.name)}</p>
              <div className="mt-space-sm flex flex-wrap gap-space-sm">
                {user.role === "investor" && featured && (
                  <Link href={`/loan-requests/${featured.id}/offer`} className="flex items-center gap-1.5 rounded-full bg-secondary-fixed px-space-md py-2 text-label-sm font-bold text-secondary transition-colors hover:bg-secondary-fixed-dim">
                    <Handshake className="h-4 w-4" aria-hidden /> Make an offer
                  </Link>
                )}
                {user.role === "business" && (
                  <Link href="/loans/new" className="flex items-center gap-1.5 rounded-full bg-primary-fixed px-space-md py-2 text-label-sm font-bold text-primary transition-colors hover:bg-primary-fixed-dim">
                    <FilePlus2 className="h-4 w-4" aria-hidden /> Request a loan
                  </Link>
                )}
                <Link href="/explore" className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-space-md py-2 text-label-sm font-bold text-on-surface-variant transition-colors hover:text-primary">
                  <Search className="h-4 w-4" aria-hidden /> Explore
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-space-md">
          <FeedTabs loans={loans} businesses={directory.map((entry) => entry.business)} members={members} />
        </div>
      </div>

      <aside className="space-y-space-md">
        {featured && (
          <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
            <div className="flex items-center justify-between"><p className="text-headline-sm text-on-surface">Featured request</p><Badge tone="secondary">Live</Badge></div>
            <Photo src={featured.business.image} alt="" className="mt-space-sm h-28 w-full rounded-xl" sizes="300px" />
            <div className="mt-space-sm flex items-center gap-space-sm">
              <Avatar src={featured.owner.avatar} alt={featured.owner.name} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-1"><p className="truncate text-label-md font-bold text-on-surface">{featured.business.name}</p>{featured.business.verified && <VerifiedBadge compact />}</div>
                <p className="text-body-sm text-outline">{featured.business.location}</p>
              </div>
            </div>
            <p className="mt-space-sm text-body-sm text-on-surface-variant">{featured.title}</p>
            <div className="mt-space-sm flex items-center justify-between text-label-md font-bold">
              <span className="text-primary">{formatBDT(featured.amount)}</span>
              <span className="text-on-surface-variant">{tenureLabel(featured.tenureDays)}</span>
            </div>
            <Link href={`/businesses/${featured.business.id}`} className="mt-space-sm flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">View business <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
          </div>
        )}

        {suggested.length > 0 && (
          <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
            <p className="text-headline-sm text-on-surface">{user.role === "investor" ? "Businesses to back" : "Investors to meet"}</p>
            <div className="mt-space-sm space-y-space-sm">
              {suggested.map((person) => (
                <Link key={person.id} href={profileHref(person)} className="flex items-center gap-space-sm rounded-xl p-1 transition-colors hover:bg-surface-container-low">
                  <Avatar src={person.avatar} alt={person.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label-md font-bold text-on-surface">{person.name}</span>
                    <span className="block truncate text-body-sm text-outline">{person.headline}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-primary p-space-md text-on-primary">
          <TrendingUp className="h-6 w-6" aria-hidden />
          <p className="mt-space-sm text-label-md font-bold">Direct deals, clear terms</p>
          <p className="mt-1 text-body-sm text-on-primary/80">Investors make offers, owners accept or counter, and both confirm a written agreement before repayments start.</p>
        </div>
      </aside>
    </div>
  );
}
