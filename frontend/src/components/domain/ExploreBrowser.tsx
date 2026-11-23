"use client";

import { useMemo, useState } from "react";
import { Building2, LayoutGrid, Search, SearchX, SlidersHorizontal, Star, TrendingUp, UserRound, Wallet } from "lucide-react";
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

export function ExploreBrowser({ businesses, people, loans }: { businesses: Business[]; people: Person[]; loans: LoanRequestView[] }) {
  const [active, setActive] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const categories = useMemo(() => ["All categories", ...new Set(businesses.map((business) => business.category))], [businesses]);

  const filteredBusinesses = businesses.filter((business) => {
    const matchesQuery = `${business.name} ${business.category} ${business.location} ${business.tagline}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "All categories" || business.category === category);
  });
  const filteredPeople = people.filter((person) => {
    const matchesQuery = `${person.name} ${person.headline} ${person.location}`.toLowerCase().includes(query.toLowerCase());
    return person.role === "investor" && matchesQuery;
  });
  const filteredLoans = loans.filter((loan) => {
    const matchesQuery = `${loan.title} ${loan.description} ${loan.business.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "All categories" || loan.business.category === category);
  });

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
          <button type="button" className="flex items-center justify-center gap-2 rounded-full bg-surface-container-high px-space-md py-2.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> More filters
          </button>
        </div>
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
                <p className="mt-1 text-body-md text-on-surface-variant">Try another keyword or clear the category filter.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

