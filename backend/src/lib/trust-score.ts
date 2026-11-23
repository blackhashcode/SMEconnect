export interface TrustScoreInputs {
  verified: boolean;
  onTimeRepayments: number;
  overdueRepayments: number;
  completedLoans: number;
  averageRating: number; // 0..5
}

/**
 * Deterministic 0–100 trust score formula (AGENTS.md §6).
 * Single source of truth recomputed on verification, repayment, and review events.
 */
export function computeTrustScore(inputs: TrustScoreInputs): number {
  const base = 35;
  const verificationBonus = inputs.verified ? 25 : 0;
  const repaymentBonus = Math.min(20, Math.max(0, inputs.onTimeRepayments) * 2);
  const completedBonus = Math.min(10, Math.max(0, inputs.completedLoans) * 5);
  const ratingBonus =
    inputs.averageRating > 0
      ? Math.round((Math.min(5, Math.max(0, inputs.averageRating)) / 5) * 10)
      : 0;
  const overduePenalty = Math.max(0, inputs.overdueRepayments) * 8;

  const raw = base + verificationBonus + repaymentBonus + completedBonus + ratingBonus - overduePenalty;
  return Math.max(0, Math.min(100, raw));
}
