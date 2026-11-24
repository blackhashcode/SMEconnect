"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { LoanCard } from "./LoanCard";
import { BusinessCard } from "./BusinessCard";
import { InvestorCard } from "./InvestorCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileSearch } from "lucide-react";
import type { Business, LoanRequestView, Person } from "@/data/types";

type TabId = "posts" | "requests" | "businesses" | "investors";

export function FeedTabs({ loans, businesses, members, posts }: { loans: LoanRequestView[]; businesses: Business[]; members: Person[]; /** The posts feed; shown as the first tab when present. */ posts?: ReactNode }) {
  const investors = members.filter((person) => person.role === "investor");
  const [active, setActive] = useState<TabId>(posts ? "posts" : "requests");
  const items: { id: TabId; label: string; count?: number }[] = [
    ...(posts ? [{ id: "posts" as TabId, label: "Posts" }] : []),
    { id: "requests", label: "Loan requests", count: loans.length },
    { id: "businesses", label: "Businesses" },
    { id: "investors", label: "Investors" },
  ];

  return (
    <div>
      <Tabs items={items} active={active} onChange={setActive} className="mb-space-md" />
      {active === "posts" && posts}
      {active === "requests" && (
        <div key="requests" className="stagger space-y-space-md">
          {loans.length === 0 && (
            <EmptyState icon={FileSearch} title="No open requests right now" description="New loan requests from verified businesses will appear here." />
          )}
          {loans.map((loan, index) => <LoanCard key={loan.id} loan={loan} featured={index === 0 && Boolean(loan.business.image)} />)}
        </div>
      )}
      {active === "businesses" && (
        <div key="businesses" className="stagger grid gap-space-md sm:grid-cols-2">
          {businesses.map((business) => (
            <BusinessCard key={business.id} business={business} ownerName={members.find((person) => person.id === business.ownerId)?.name} />
          ))}
        </div>
      )}
      {active === "investors" && (
        <div key="investors" className="stagger grid gap-space-md">
          {investors.map((investor) => (
            <InvestorCard key={investor.id} investor={investor} />
          ))}
        </div>
      )}
    </div>
  );
}
