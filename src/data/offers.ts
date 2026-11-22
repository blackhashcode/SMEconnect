import type { LoanOffer } from "./types";

export const loanOffers: LoanOffer[] = [
  {
    id: "of-1",
    requestId: "lr-1",
    investorId: "rafiq",
    amount: 150000,
    rate: 10.5,
    tenureMonths: 12,
    frequency: "Monthly",
    status: "negotiating",
    note: "Happy to offer the full amount at 10.5% with monthly repayments. I have backed two food businesses in Dhaka before.",
    createdAt: "1 day ago",
  },
  {
    id: "of-2",
    requestId: "lr-1",
    investorId: "samira",
    amount: 100000,
    rate: 11,
    tenureMonths: 12,
    frequency: "Monthly",
    status: "pending",
    note: "Starting with ৳100,000 so we can review the first three repayments before increasing the offer.",
    createdAt: "18 hours ago",
  },
  {
    id: "of-3",
    requestId: "lr-1",
    investorId: "tanzeem",
    amount: 50000,
    rate: 10,
    tenureMonths: 9,
    frequency: "Monthly",
    status: "pending",
    note: "Can support a smaller ticket for the oven purchase with a shorter nine-month term.",
    createdAt: "6 hours ago",
  },
  {
    id: "of-4",
    requestId: "lr-2",
    investorId: "rafiq",
    amount: 150000,
    rate: 11,
    tenureMonths: 18,
    frequency: "Monthly",
    status: "pending",
    note: "Interested in the loom upgrade. Let's discuss weaver payment schedules.",
    createdAt: "2 days ago",
  },
  {
    id: "of-5",
    requestId: "lr-4",
    investorId: "tanzeem",
    amount: 200000,
    rate: 12,
    tenureMonths: 24,
    frequency: "Monthly",
    status: "negotiating",
    note: "Fleet expansion fits my logistics thesis. Can review the pharmacy contract together.",
    createdAt: "1 day ago",
  },
];

export const offersForRequest = (requestId: string) => loanOffers.filter((offer) => offer.requestId === requestId);
export const offersByInvestor = (investorId: string) => loanOffers.filter((offer) => offer.investorId === investorId);
export const offerById = (id: string) => loanOffers.find((offer) => offer.id === id);
