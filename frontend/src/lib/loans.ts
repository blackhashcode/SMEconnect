import type { LoanRequestStatus, OfferStatus, RepaymentFrequency } from "@/data/types";

/** Labels and badge tones for the API's status enums. Safe on server and client. */

export const FREQUENCY_LABEL: Record<RepaymentFrequency, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
};

export const FREQUENCIES: RepaymentFrequency[] = ["WEEKLY", "BIWEEKLY", "MONTHLY"];

export const tenureLabel = (days: number) =>
  days % 30 === 0 && days >= 30 ? `${days / 30} ${days === 30 ? "month" : "months"}` : `${days} days`;

type Tone = "primary" | "secondary" | "success" | "warning" | "error" | "neutral";

export const LOAN_REQUEST_STATUS: Record<LoanRequestStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  OPEN: { label: "Open", tone: "primary" },
  IN_DISCUSSION: { label: "In discussion", tone: "warning" },
  PAUSED: { label: "Paused", tone: "neutral" },
  FUNDED: { label: "Funded", tone: "success" },
  REPAYING: { label: "Repaying", tone: "success" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "primary" },
  COUNTERED: { label: "Countered", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Rejected", tone: "error" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

/** Requests that investors can still make offers on. */
export const isAcceptingOffers = (status: LoanRequestStatus) => status === "OPEN" || status === "IN_DISCUSSION";
