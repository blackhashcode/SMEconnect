"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { LoanCard } from "./LoanCard";
import { BusinessCard } from "./BusinessCard";
import { InvestorCard } from "./InvestorCard";
import { loanRequests } from "@/data/loans";
import { businesses } from "@/data/businesses";
import { people } from "@/data/users";

const items = [
  { id: "requests", label: "Loan requests", count: loanRequests.length },
  { id: "businesses", label: "Businesses" },
  { id: "investors", label: "Investors" },
] as const;

export function FeedTabs() {
  const [active, setActive] = useState<(typeof items)[number]["id"]>("requests");

  return (
    <div>
      <Tabs items={[...items]} active={active} onChange={setActive} className="mb-space-md" />
      {active === "requests" && (
        <div className="space-y-space-md">
          {loanRequests.map((loan) => <LoanCard key={loan.id} loan={loan} featured={loan.id === "lr-1"} />)}
        </div>
      )}
      {active === "businesses" && (
        <div className="grid gap-space-md sm:grid-cols-2">
          {businesses.map((business) => <BusinessCard key={business.id} business={business} />)}
        </div>
      )}
      {active === "investors" && (
        <div className="grid gap-space-md">
          {people.filter((person) => person.role === "investor").map((investor) => (
            <InvestorCard key={investor.id} investor={investor} />
          ))}
        </div>
      )}
    </div>
  );
}
