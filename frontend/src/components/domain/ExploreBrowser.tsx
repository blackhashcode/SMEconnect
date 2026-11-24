"use client";

import { useMemo, useState } from "react";
import { Building2, LayoutGrid, Search, SearchX, SlidersHorizontal, Star, TrendingUp, UserRound, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { BusinessCard } from "./BusinessCard";
import { InvestorCard } from "./InvestorCard";
import { LoanCard } from "./LoanCard";
import type { Business, LoanRequestView, Person } from "@/data/types";
import { cn } from "@/lib/cn";

const tabs = [
  { id: "all", label: "All results" },
  { id: "businesses", label: "Businesses" },
  { id: "investors", label: "Investors" },
  { id: "requests", label: "Loan requests" },
] as const;

type TabId = (typeof tabs)[number]["id"];

type Filters = { location: string; verifiedOnly: boolean; minTrust: number; minAmount: string; maxAmount: string; maxTenure: number; frequency: string; sort: "newest" | "amount-asc" | "amount-desc" | "trust" };
const NO_FILTERS: Filters = { location: "", verifiedOnly: false, minTrust: 0, minAmount: "", maxAmount: "", maxTenure: 0, frequency: "", sort: "newest" };
const countActive = (f: Filters) =>
  [f.location.trim(), f.verifiedOnly, f.minTrust > 0, f.minAmount, f.maxAmount, f.maxTenure > 0, f.frequency, f.sort !== "newest"].filter(Boolean).length;

export function ExploreBrowser({ businesses, people, loans, initialQuery = "" }: { businesses: Business[]; people: Person[]; loans: LoanRequestView[]; initialQuery?: string }) {
  const [active, setActive] = useState<TabId>("all");
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("All categories");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const activeCount = countActive(filters);
  const place = filters.location.trim().toLowerCase();
  const minAmount = Number(filters.minAmount) || 0;
  const maxAmount = Number(filters.maxAmount) || Infinity;
  const categories = useMemo(() => ["All categories", ...new Set(businesses.map((business) => business.category))], [businesses]);

  const filteredBusinesses = businesses.filter((business) => {
    const matchesQuery = `${business.name} ${business.category} ${business.location} ${business.tagline}`.toLowerCase().includes(query.toLowerCase());
    return (
      matchesQuery &&
      (category === "All categories" || business.category === category) &&
      (!place || business.location.toLowerCase().includes(place)) &&
      (!filters.verifiedOnly || business.verified) &&
      business.trustScore >= filters.minTrust
    );
  }).sort((a, b) => (filters.sort === "trust" ? b.trustScore - a.trustScore : 0));
  const filteredPeople = people.filter((person) => {
    const matchesQuery = `${person.name} ${person.headline} ${person.location}`.toLowerCase().includes(query.toLowerCase());
    return (
      person.role === "investor" &&
      matchesQuery &&
      (!place || person.location.toLowerCase().includes(place)) &&
      (!filters.verifiedOnly || person.verified) &&
      person.trustScore >= filters.minTrust
    );
  }).sort((a, b) => (filters.sort === "trust" ? b.trustScore - a.trustScore : 0));
  const filteredLoans = loans.filter((loan) => {
    const matchesQuery = `${loan.title} ${loan.description} ${loan.business.name}`.toLowerCase().includes(query.toLowerCase());
    return (
      matchesQuery &&
      (category === "All categories" || loan.business.category === category) &&
      (!place || loan.business.location.toLowerCase().includes(place)) &&
      (!filters.verifiedOnly || loan.business.verified) &&
      loan.business.trustScore >= filters.minTrust &&
      loan.amount >= minAmount &&
      loan.amount <= maxAmount &&
      (!filters.maxTenure || loan.tenureDays <= filters.maxTenure) &&
      (!filters.frequency || loan.frequency === filters.frequency)
    );
  }).sort((a, b) =>
    filters.sort === "amount-asc" ? a.amount - b.amount
      : filters.sort === "amount-desc" ? b.amount - a.amount
        : filters.sort === "trust" ? b.business.trustScore - a.business.trustScore
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const showBusinesses = active === "all" || active === "businesses";
  const showInvestors = active === "all" || active === "investors";
  const showLoans = active === "all" || active === "requests";
  const total = (showBusinesses ? filteredBusinesses.length : 0) + (showInvestors ? filteredPeople.length : 0) + (showLoans ? filteredLoans.length : 0);

  return (
    <div>
      <div className="rounded-3xl bg-surface-container-lowest p-space-lg card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Explore</p>
            <h1 className="mt-1 text-headline-lg text-on-surface">Find verified businesses and investors</h1>
            <p className="mt-1 text-body-md text-on-surface-variant">Search by shop, founder, location or loan purpose. All profiles are identity checked.</p>
          </div>
          <Badge tone="success"><Star className="h-3.5 w-3.5 fill-current" aria-hidden /> {businesses.filter((business) => business.verified).length} verified shops</Badge>
        </div>

        <div className="mt-space-md flex flex-col gap-space-sm sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-outline" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Jamdani, cloud kitchen, Sylhet…"
              aria-label="Explore search"
              className="w-full rounded-full bg-surface-container-low py-2.5 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Category"
            className="rounded-full bg-surface-container-low px-space-md py-2.5 text-label-md font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="explore-filters"
            className={cn("flex items-center justify-center gap-2 rounded-full px-space-md py-2.5 text-label-md font-semibold transition-colors", showFilters || activeCount ? "bg-primary-fixed text-primary" : "bg-surface-container-high text-on-surface-variant hover:text-primary")}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> {showFilters ? "Hide filters" : "More filters"}
            {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold leading-5 text-on-primary">{activeCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div id="explore-filters" className="mt-space-md grid animate-fade-in gap-space-md border-t border-surface-container-high pt-space-md sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold text-on-surface-variant">Location</span>
              <input value={filters.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Dhaka, Sylhet" className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-sm text-body-sm focus:border-primary focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold text-on-surface-variant">Minimum trust score</span>
              <select value={filters.minTrust} onChange={(e) => set("minTrust", Number(e.target.value))} className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-sm text-body-sm focus:border-primary focus:outline-none">
                <option value={0}>Any</option><option value={50}>50+</option><option value={70}>70+</option><option value={85}>85+</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold text-on-surface-variant">Sort by</span>
              <select value={filters.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])} className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-sm text-body-sm focus:border-primary focus:outline-none">
                <option value="newest">Newest requests</option>
                <option value="amount-asc">Loan amount: low to high</option>
                <option value="amount-desc">Loan amount: high to low</option>
                <option value="trust">Highest trust score</option>
              </select>
            </label>
            <label className="flex items-end gap-space-sm pb-2 text-body-sm text-on-surface">
              <input type="checkbox" checked={filters.verifiedOnly} onChange={(e) => set("verifiedOnly", e.target.checked)} className="h-4 w-4 accent-primary" /> Verified members only
            </label>
            <div className="block sm:col-span-2">
              <span className="mb-1 block text-label-sm font-semibold text-on-surface-variant">Loan amount (৳)</span>
              <div className="flex items-center gap-space-sm">
                <input type="number" min={0} inputMode="numeric" value={filters.minAmount} onChange={(e) => set("minAmount", e.target.value)} placeholder="Min" aria-label="Minimum loan amount" className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-sm text-body-sm focus:border-primary focus:outline-none" />
                <span className="text-outline">to</span>
                <input type="number" min={0} inputMode="numeric" value={filters.maxAmount} onChange={(e) => set("maxAmount", e.target.value)} placeholder="Max" aria-label="Maximum loan amount" className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-sm text-body-sm focus:border-primary focus:outline-none" />
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold text-on-surface-variant">Longest tenure</span>
              <select value={filters.maxTenure} onChange={(e) => set("maxTenure", Number(e.target.value))} className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-sm text-body-sm focus:border-primary focus:outline-none">
                <option value={0}>Any</option><option value={30}>1 month</option><option value={90}>3 months</option><option value={180}>6 months</option><option value={365}>1 year</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold text-on-surface-variant">Repayments</span>
              <select value={filters.frequency} onChange={(e) => set("frequency", e.target.value)} className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-sm text-body-sm focus:border-primary focus:outline-none">
                <option value="">Any</option><option value="WEEKLY">Weekly</option><option value="BIWEEKLY">Every 2 weeks</option><option value="MONTHLY">Monthly</option>
              </select>
            </label>
            <p className="text-body-sm text-on-surface-variant sm:col-span-2 lg:col-span-3">Amount, tenure and repayment filters apply to loan requests.</p>
            {activeCount > 0 && (
              <button type="button" onClick={() => setFilters(NO_FILTERS)} className="inline-flex items-center gap-1 justify-self-start text-label-md font-semibold text-primary hover:underline lg:justify-self-end">
                <X className="h-4 w-4" aria-hidden /> Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-space-md grid gap-space-lg lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-space-md">
          <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
            <p className="mb-space-sm text-label-sm font-bold uppercase tracking-wider text-outline">Browse by</p>
            <div className="space-y-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-space-sm py-2 text-left text-body-sm transition-colors",
                    category === item ? "bg-primary-fixed font-bold text-primary" : "text-on-surface-variant hover:bg-surface-container-low",
                  )}
                >
                  {item === "All categories" ? <LayoutGrid className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-primary-fixed p-space-md text-on-primary-fixed">
            <TrendingUp className="h-5 w-5" aria-hidden />
            <p className="mt-space-sm text-label-md font-bold">Direct offers only</p>
            <p className="mt-1 text-body-sm text-on-primary-fixed/80">Every result is a real business or investor you can connect with directly.</p>
          </div>
        </aside>

        <div>
          <Tabs items={[...tabs]} active={active} onChange={setActive} className="mb-space-md" />
          <p className="mb-space-sm text-body-sm text-outline">{total} result{total === 1 ? "" : "s"}</p>

          <div className="space-y-space-lg">
            {showBusinesses && filteredBusinesses.length > 0 && (
              <section>
                {active !== "all" && <h2 className="mb-space-sm flex items-center gap-2 text-headline-sm text-on-surface"><Building2 className="h-5 w-5 text-primary" aria-hidden /> Businesses</h2>}
                <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-3">
                  {filteredBusinesses.map((business) => (
                    <BusinessCard key={business.id} business={business} ownerName={people.find((person) => person.id === business.ownerId)?.name} />
                  ))}
                </div>
              </section>
            )}

            {showLoans && filteredLoans.length > 0 && (
              <section>
                {active !== "all" && <h2 className="mb-space-sm flex items-center gap-2 text-headline-sm text-on-surface"><Wallet className="h-5 w-5 text-primary" aria-hidden /> Open requests</h2>}
                <div className="grid gap-space-md xl:grid-cols-2">
                  {filteredLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}
                </div>
              </section>
            )}

            {showInvestors && filteredPeople.length > 0 && (
              <section>
                {active !== "all" && <h2 className="mb-space-sm flex items-center gap-2 text-headline-sm text-on-surface"><UserRound className="h-5 w-5 text-primary" aria-hidden /> Investors</h2>}
                <div className="grid gap-space-md xl:grid-cols-2">
                  {filteredPeople.map((investor) => <InvestorCard key={investor.id} investor={investor} />)}
                </div>
              </section>
            )}

            {total === 0 && (
              <div className="rounded-2xl bg-surface-container-lowest p-space-xl text-center card-shadow">
                <SearchX className="mx-auto h-8 w-8 text-outline" aria-hidden />
                <p className="mt-space-sm text-headline-sm text-on-surface">No matches yet</p>
                <p className="mt-1 text-body-md text-on-surface-variant">Try another keyword, or clear the category and filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

