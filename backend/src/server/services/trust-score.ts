import { prisma } from "@/server/db";

type Db = typeof prisma;
export type TrustRole = "OWNER" | "INVESTOR";

/** Prisma client subset needed to recompute one user's persisted trust score. */
export type TrustScoreDb = Pick<
  Db,
  | "userVerification"
  | "loan"
  | "repayment"
  | "review"
  | "businessProfile"
  | "investorProfile"
>;

export interface TrustScoreFactors {
  verified: boolean;
  onTimeRepayments: number;
  completedLoans: number;
  averageRating: number | null;
  overdueCount: number;
}

const WEIGHTS = {
  verification: 25,
  onTimePerInstallment: 5,
  onTimeMax: 30,
  completedPerLoan: 10,
  completedMax: 25,
  ratingMax: 20,
  overduePenaltyPerInstallment: 5,
  overduePenaltyMax: 25,
} as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * The single source of truth for the 0–100 trust score. All inputs come from
 * the server: verification state, confirmed repayment timestamps, completed
 * loans, received ratings and overdue installments.
 */
export function calculateTrustScore(factors: TrustScoreFactors): number {
  const verification = factors.verified ? WEIGHTS.verification : 0;
  const onTime = Math.min(
    WEIGHTS.onTimeMax,
    Math.max(0, factors.onTimeRepayments) * WEIGHTS.onTimePerInstallment,
  );
  const completed = Math.min(
    WEIGHTS.completedMax,
    Math.max(0, factors.completedLoans) * WEIGHTS.completedPerLoan,
  );
  const average = factors.averageRating;
  const rating =
    average === null || !Number.isFinite(average)
      ? 0
      : Math.round(
          (Math.max(0, Math.min(5, average)) / 5) * WEIGHTS.ratingMax,
        );
  const penalty = Math.min(
    WEIGHTS.overduePenaltyMax,
    Math.max(0, factors.overdueCount) * WEIGHTS.overduePenaltyPerInstallment,
  );
  return clampScore(verification + onTime + completed + rating - penalty);
}

/**
 * Recomputes and persists one participant's score. Callers pass the active
 * Prisma transaction so the score and the triggering event commit together.
 */
export async function recomputeTrustScore(
  userId: string,
  role: TrustRole,
  db: TrustScoreDb,
  now: Date,
): Promise<number> {
  const loanWhere = role === "OWNER" ? { ownerId: userId } : { investorId: userId };

  const [verification, completedLoans, repayments, reviews] = await Promise.all([
    db.userVerification.findFirst({
      where: { userId, type: role, status: "APPROVED" },
      select: { id: true },
    }),
    db.loan.count({ where: { ...loanWhere, status: "COMPLETED" } }),
    db.repayment.findMany({
      where: { loan: loanWhere },
      select: { status: true, dueDate: true, confirmedAt: true },
    }),
    db.review.findMany({ where: { revieweeId: userId }, select: { rating: true } }),
  ]);

  let onTimeRepayments = 0;
  let overdueCount = 0;
  for (const row of repayments) {
    const dueDate = new Date(row.dueDate).getTime();
    if (
      row.status === "CONFIRMED" &&
      row.confirmedAt &&
      new Date(row.confirmedAt).getTime() <= dueDate
    ) {
      onTimeRepayments += 1;
    }
    if (
      row.status === "OVERDUE" ||
      (row.status !== "CONFIRMED" && dueDate < now.getTime())
    ) {
      overdueCount += 1;
    }
  }

  const ratings = reviews.map((row) => row.rating);
  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : null;
  const score = calculateTrustScore({
    verified: Boolean(verification),
    onTimeRepayments,
    completedLoans,
    averageRating,
    overdueCount,
  });

  if (role === "OWNER") {
    await db.businessProfile.updateMany({
      where: { ownerId: userId },
      data: { trustScore: score },
    });
  } else {
    await db.investorProfile.updateMany({
      where: { userId },
      data: { trustScore: score },
    });
  }
  return score;
}
