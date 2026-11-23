import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import type { notificationTypeSchema } from "@/server/validators/enums";
import type { z } from "zod";

type Db = typeof prisma;
type NotificationType = z.infer<typeof notificationTypeSchema>;
type LoanStatus = "PENDING_AGREEMENT" | "ACTIVE" | "COMPLETED" | "DEFAULTED";
type LoanRequestStatus =
  | "DRAFT"
  | "OPEN"
  | "IN_DISCUSSION"
  | "FUNDED"
  | "REPAYING"
  | "COMPLETED"
  | "PAUSED"
  | "CANCELLED";
type OfferStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "COUNTERED"
  | "WITHDRAWN"
  | "EXPIRED";
type RepaymentStatus = "UPCOMING" | "MARKED_PAID" | "CONFIRMED" | "OVERDUE";

export interface DashboardDeps {
  db?: Db;
  now?: () => Date;
  recentLimit?: number;
}

interface UserRow {
  id: string;
  name: string;
  image: string | null;
  role: "OWNER" | "INVESTOR" | "ADMIN";
  status: string;
}

interface VerificationRow {
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: Date;
  reviewedAt: Date | null;
}

interface OwnerProfileRow {
  shopName: string;
  slug: string;
  category: string;
  district: string;
  city: string;
  trustScore: number;
}

interface InvestorProfileRow {
  bio: string | null;
  minLendBdt: number;
  maxLendBdt: number;
  preferredCategories: string[];
  district: string | null;
  city: string | null;
  trustScore: number;
}

interface RepaymentRow {
  id: string;
  installmentNo: number;
  dueDate: Date;
  amountBdt: number;
  status: RepaymentStatus;
  confirmedAt: Date | null;
}

interface LoanRow {
  id: string;
  loanRequestId: string;
  status: LoanStatus;
  principalBdt: number;
  totalRepayableBdt: number;
  startDate: Date | null;
  createdAt: Date;
  repayments: RepaymentRow[];
}

interface LoanRequestRow {
  id: string;
  purpose: string;
  amountBdt: number;
  status: LoanRequestStatus;
  createdAt: Date;
}

interface RecentNotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const ACTIVE_REQUEST_STATUSES: LoanRequestStatus[] = [
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
];
const REQUEST_STATUSES: LoanRequestStatus[] = [
  "DRAFT",
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
];

function pct(confirmed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((confirmed / total) * 100)));
}

function effectiveStatus(row: RepaymentRow, now: Date): RepaymentStatus {
  if (row.status === "MARKED_PAID" || row.status === "CONFIRMED") return row.status;
  if (row.status === "OVERDUE" || row.dueDate.getTime() < now.getTime()) return "OVERDUE";
  return "UPCOMING";
}

function nextDueFor(rows: RepaymentRow[], now: Date) {
  const pending = rows
    .filter((row) => effectiveStatus(row, now) !== "CONFIRMED")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const row = pending[0];
  if (!row) return null;
  return {
    repaymentId: row.id,
    installmentNo: row.installmentNo,
    dueDate: row.dueDate.toISOString(),
    amountBdt: row.amountBdt,
    status: effectiveStatus(row, now) as "UPCOMING" | "OVERDUE" | "MARKED_PAID",
  };
}

function progressFor(rows: RepaymentRow[], loanTotalBdt: number, now: Date) {
  let confirmedCount = 0;
  let confirmedBdt = 0;
  for (const row of rows) {
    if (effectiveStatus(row, now) === "CONFIRMED") {
      confirmedCount += 1;
      confirmedBdt += row.amountBdt;
    }
  }
  return {
    totalInstallments: rows.length,
    confirmedCount,
    confirmedBdt,
    outstandingBdt: Math.max(0, loanTotalBdt - confirmedBdt),
    progressPct: pct(confirmedBdt, loanTotalBdt),
  };
}

function portfolioHealth(loan: LoanRow, now: Date) {
  if (loan.status === "COMPLETED") return "COMPLETED" as const;
  const statuses = loan.repayments.map((row) => effectiveStatus(row, now));
  if (statuses.includes("OVERDUE")) return "OVERDUE" as const;
  const next = nextDueFor(loan.repayments, now);
  if (
    next &&
    next.dueDate &&
    new Date(next.dueDate).getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000
  ) {
    return "DUE_SOON" as const;
  }
  return "ON_TRACK" as const;
}

function loanSummary(loan: LoanRow, now: Date) {
  return {
    id: loan.id,
    loanRequestId: loan.loanRequestId,
    status: loan.status,
    principalBdt: loan.principalBdt,
    totalRepayableBdt: loan.totalRepayableBdt,
    startDate: loan.startDate ? loan.startDate.toISOString() : null,
    progress: progressFor(loan.repayments, loan.totalRepayableBdt, now),
    nextDue: nextDueFor(loan.repayments, now),
  };
}

function toRecentNotification(row: RecentNotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link ?? null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertDashboardActor(actor: Actor, role: "OWNER" | "INVESTOR") {
  assertRole(actor, role);
  if (!actor.role) throw new ForbiddenError();
}

async function loadContext(actor: Actor, role: "OWNER" | "INVESTOR", db: Db, deps: DashboardDeps) {
  const [user, verification, recent, unreadNotifications, connections, followers, following, posts] =
    await Promise.all([
      db.user.findUnique({
        where: { id: actor.id },
        select: { id: true, name: true, image: true, role: true, status: true },
      }),
      db.userVerification.findFirst({
        where: { userId: actor.id, type: role },
        select: { status: true, submittedAt: true, reviewedAt: true },
      }),
      db.notification.findMany({
        where: { userId: actor.id },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: deps.recentLimit ?? 5,
      }),
      db.notification.count({ where: { userId: actor.id, readAt: null } }),
      db.connection.count({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: actor.id }, { addresseeId: actor.id }],
        },
      }),
      db.follow.count({ where: { followeeId: actor.id } }),
      db.follow.count({ where: { followerId: actor.id } }),
      db.post.count({ where: { authorId: actor.id, deletedAt: null } }),
    ]);

  if (!user || user.role !== role || user.status !== "ACTIVE") {
    throw new NotFoundError("Account not found");
  }

  return {
    user: user as UserRow,
    verification: verification as VerificationRow | null,
    recentNotifications: (recent as RecentNotificationRow[]).map(toRecentNotification),
    activity: {
      connections,
      followers,
      following,
      posts,
      unreadNotifications,
    },
  };
}

const loanInclude = {
  repayments: {
    select: {
      id: true,
      installmentNo: true,
      dueDate: true,
      amountBdt: true,
      status: true,
      confirmedAt: true,
    },
    orderBy: { installmentNo: "asc" as const },
  },
} as const;

/** Owner: active request, received offers, current loan and repayment progress. */
export async function getOwnerDashboard(actor: Actor, deps: DashboardDeps = {}) {
  await assertDashboardActor(actor, "OWNER");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const ctx = await loadContext(actor, "OWNER", db, deps);

  const [profile, requestRows, offerRows, loan] = await Promise.all([
    db.businessProfile.findUnique({
      where: { ownerId: actor.id },
      select: {
        shopName: true,
        slug: true,
        category: true,
        district: true,
        city: true,
        trustScore: true,
      },
    }),
    db.loanRequest.findMany({
      where: { ownerId: actor.id },
      select: { id: true, purpose: true, amountBdt: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.offer.findMany({
      where: { loanRequest: { ownerId: actor.id } },
      select: { status: true },
    }),
    db.loan.findFirst({
      where: { ownerId: actor.id, status: { not: "COMPLETED" } },
      include: loanInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!profile) throw new NotFoundError("Business profile not found");

  const requests = requestRows as LoanRequestRow[];
  const byStatus = Object.fromEntries(
    REQUEST_STATUSES.map((status) => [status, 0]),
  ) as Record<LoanRequestStatus, number>;
  for (const row of requests) byStatus[row.status] += 1;
  const activeRequestRow = requests.find((row) => ACTIVE_REQUEST_STATUSES.includes(row.status));

  const offers = offerRows as Array<{ status: OfferStatus }>;
  const loanRow = loan as LoanRow | null;

  return {
    profile: {
      id: ctx.user.id,
      name: ctx.user.name,
      image: ctx.user.image ?? null,
      role: "OWNER" as const,
      shopName: (profile as OwnerProfileRow).shopName,
      slug: (profile as OwnerProfileRow).slug,
      category: (profile as OwnerProfileRow).category,
      district: (profile as OwnerProfileRow).district,
      city: (profile as OwnerProfileRow).city,
    },
    verification: ctx.verification
      ? {
          status: ctx.verification.status,
          submittedAt: ctx.verification.submittedAt.toISOString(),
          reviewedAt: ctx.verification.reviewedAt?.toISOString() ?? null,
        }
      : { status: null, submittedAt: null, reviewedAt: null },
    trustScore: (profile as OwnerProfileRow).trustScore,
    loanRequests: {
      active: activeRequestRow
        ? {
            id: activeRequestRow.id,
            purpose: activeRequestRow.purpose,
            amountBdt: activeRequestRow.amountBdt,
            status: activeRequestRow.status,
            createdAt: activeRequestRow.createdAt.toISOString(),
          }
        : null,
      total: requests.length,
      byStatus,
    },
    offers: {
      received: offers.length,
      pendingReceived: offers.filter((row) => row.status === "PENDING").length,
      acceptedReceived: offers.filter((row) => row.status === "ACCEPTED").length,
    },
    loan: loanRow ? loanSummary(loanRow, now) : null,
    recentNotifications: ctx.recentNotifications,
    activity: ctx.activity,
  };
}

/** Investor: submitted offers, portfolio totals, next due and per-loan health. */
export async function getInvestorDashboard(actor: Actor, deps: DashboardDeps = {}) {
  await assertDashboardActor(actor, "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const ctx = await loadContext(actor, "INVESTOR", db, deps);

  const [profile, offerRows, loans] = await Promise.all([
    db.investorProfile.findUnique({
      where: { userId: actor.id },
      select: {
        bio: true,
        minLendBdt: true,
        maxLendBdt: true,
        preferredCategories: true,
        district: true,
        city: true,
        trustScore: true,
      },
    }),
    db.offer.findMany({ where: { investorId: actor.id }, select: { status: true } }),
    db.loan.findMany({
      where: { investorId: actor.id },
      include: loanInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!profile) throw new NotFoundError("Investor profile not found");

  const offers = offerRows as Array<{ status: OfferStatus }>;
  const portfolio = loans as LoanRow[];
  const progress = progressFor(
    portfolio.flatMap((loan) => loan.repayments),
    portfolio.reduce((sum, loan) => sum + loan.totalRepayableBdt, 0),
    now,
  );
  const dues = portfolio
    .map((loan) => nextDueFor(loan.repayments, now))
    .filter((due) => due !== null)
    .sort((a, b) => new Date(a!.dueDate).getTime() - new Date(b!.dueDate).getTime());

  return {
    profile: {
      id: ctx.user.id,
      name: ctx.user.name,
      image: ctx.user.image ?? null,
      role: "INVESTOR" as const,
      shopName: null,
      slug: null,
      category: null,
      district: (profile as InvestorProfileRow).district ?? null,
      city: (profile as InvestorProfileRow).city ?? null,
    },
    verification: ctx.verification
      ? {
          status: ctx.verification.status,
          submittedAt: ctx.verification.submittedAt.toISOString(),
          reviewedAt: ctx.verification.reviewedAt?.toISOString() ?? null,
        }
      : { status: null, submittedAt: null, reviewedAt: null },
    trustScore: (profile as InvestorProfileRow).trustScore,
    offers: {
      submitted: offers.length,
      pendingSubmitted: offers.filter((row) => row.status === "PENDING").length,
      acceptedSubmitted: offers.filter((row) => row.status === "ACCEPTED").length,
    },
    loans: {
      active: portfolio.filter((loan) => loan.status === "ACTIVE").length,
      completed: portfolio.filter((loan) => loan.status === "COMPLETED").length,
      totalLentBdt: portfolio.reduce((sum, loan) => sum + loan.principalBdt, 0),
      repaidBdt: progress.confirmedBdt,
      expectedReturnsBdt: portfolio.reduce((sum, loan) => sum + loan.totalRepayableBdt, 0),
    },
    repayments: progress,
    nextDue: dues[0] ?? null,
    portfolio: portfolio.map((loan) => ({
      ...loanSummary(loan, now),
      health: portfolioHealth(loan, now),
    })),
    recentNotifications: ctx.recentNotifications,
    activity: ctx.activity,
  };
}
