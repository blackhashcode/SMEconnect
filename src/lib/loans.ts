import type { LoanRequest } from "@/data/types";

/** Requests that can still receive offers. Safe to use on the server and in the browser. */
export const isActiveLoan = (loan: Pick<LoanRequest, "status">) => loan.status === "open" || loan.status === "offers_received";

/** Badge colour for each offer status. */
export const offerStatusTone = {
  pending: "primary",
  negotiating: "warning",
  accepted: "success",
  declined: "error",
  withdrawn: "neutral",
} as const;
