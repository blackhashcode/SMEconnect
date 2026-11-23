import type { Actor } from "@/server/auth/policy";

export type Row = Record<string, unknown>;

const DAY = 24 * 60 * 60 * 1000;

export const NOW = new Date("2026-11-23T18:00:00.000Z");
export const owner = { id: "usr_owner", role: "OWNER" as const } satisfies Actor;
export const investor = { id: "usr_investor", role: "INVESTOR" as const } satisfies Actor;
export const stranger = { id: "usr_stranger", role: "INVESTOR" as const } satisfies Actor;
export const admin = { id: "usr_admin", role: "ADMIN" as const } satisfies Actor;

export const USERS: Row[] = [
  {
    id: owner.id,
    name: "Nusrat Akter",
    email: "owner@example.test",
    image: null,
    role: "OWNER",
    status: "ACTIVE",
    businessProfile: {
      shopName: "Nusrat's Home Kitchen",
      slug: "nusrat-home-kitchen",
      category: "Food",
      district: "Dhaka",
      city: "Dhaka",
      logoUrl: null,
      trustScore: 80,
      description: null,
    },
    investorProfile: null,
  },
  {
    id: investor.id,
    name: "Tanvir Ahmed",
    email: "investor@example.test",
    image: null,
    role: "INVESTOR",
    status: "ACTIVE",
    businessProfile: null,
    investorProfile: {
      bio: "Angel investor",
      minLendBdt: 10_000,
      maxLendBdt: 100_000,
      preferredCategories: ["Food"],
      district: "Dhaka",
      city: "Dhaka",
      trustScore: 90,
    },
  },
  {
    id: stranger.id,
    name: "Stranger User",
    email: "stranger@example.test",
    image: null,
    role: "INVESTOR",
    status: "ACTIVE",
    businessProfile: null,
    investorProfile: null,
  },
];

function sameValue(actual: unknown, expected: unknown): boolean {
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  return actual === expected;
}

function comparable(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return null;
}

function matchesRule(actual: unknown, rule: Row): boolean {
  if ("in" in rule && Array.isArray(rule.in)) {
    if (!rule.in.some((value) => sameValue(actual, value))) return false;
  }
  if ("not" in rule && sameValue(actual, rule.not)) return false;
  if ("equals" in rule && !sameValue(actual, rule.equals)) return false;
  const left = comparable(actual);
  if (left === null) {
    for (const key of ["lt", "lte", "gt", "gte"]) {
      if (key in rule) return false;
    }
  } else {
    if ("lt" in rule && !(left < (comparable(rule.lt) ?? Number.POSITIVE_INFINITY))) return false;
    if ("lte" in rule && !(left <= (comparable(rule.lte) ?? Number.POSITIVE_INFINITY))) return false;
    if ("gt" in rule && !(left > (comparable(rule.gt) ?? Number.NEGATIVE_INFINITY))) return false;
    if ("gte" in rule && !(left >= (comparable(rule.gte) ?? Number.NEGATIVE_INFINITY))) return false;
  }
  if ("none" in rule && Array.isArray(actual)) {
    const none = rule.none as Row;
    if (actual.some((item) => matches(item as Row, none, undefined))) return false;
  }
  return true;
}

function isOperatorRule(value: Row): boolean {
  return ["in", "not", "equals", "lt", "lte", "gt", "gte", "none"].some((key) => key in value);
}

export function matches(row: Row, where: Row, state?: State): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(expected)) {
      if (!expected.some((rule) => matches(row, rule as Row, state))) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(expected)) {
      if (!expected.every((rule) => matches(row, rule as Row, state))) return false;
      continue;
    }

    const actual =
      key === "repayments" && state
        ? state.repayments.filter((item) => item.loanId === row.id)
        : row[key];

    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const rule = expected as Row;
      if (isOperatorRule(rule)) {
        if (!matchesRule(actual, rule)) return false;
        continue;
      }
      if (!actual || typeof actual !== "object") return false;
      if (!matches(actual as Row, rule, state)) return false;
      continue;
    }
    if (!sameValue(actual, expected)) return false;
  }
  return true;
}

function orderRows(rows: Row[], orderBy?: Row[]): Row[] {
  if (!orderBy?.length) return rows;
  return [...rows].sort((a, b) => {
    for (const clause of orderBy) {
      const [key, direction] = Object.entries(clause)[0];
      const left = a[key] as string | number | Date;
      const right = b[key] as string | number | Date;
      const leftValue = left instanceof Date ? left.getTime() : left;
      const rightValue = right instanceof Date ? right.getTime() : right;
      if (leftValue < rightValue) return direction === "desc" ? 1 : -1;
      if (leftValue > rightValue) return direction === "desc" ? -1 : 1;
    }
    return 0;
  });
}

function paginate<T extends Row>(
  rows: T[],
  args: {
    cursor?: { id: string };
    skip?: number;
    take?: number;
    orderBy?: Row[];
  },
): T[] {
  const ordered = orderRows(rows, args.orderBy) as T[];
  let start = 0;
  if (args.cursor) {
    const index = ordered.findIndex((row) => row.id === args.cursor?.id);
    if (index < 0) throw new Error("Invalid test cursor");
    start = index + (args.skip ?? 1);
  }
  return args.take === undefined ? ordered.slice(start) : ordered.slice(start, start + args.take);
}

export interface SeedInput {
  loanStatus?: string;
  requestStatus?: string;
  startDate?: Date | null;
  installmentCount?: number;
  dueInDays?: number;
  statuses?: string[];
  amountBdt?: number;
  markedPaidAt?: Date | null;
  confirmedAt?: Date | null;
  agreementId?: string | null;
  withReminderEmails?: boolean;
}

interface FakeDb {
  loan: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
    count: (args: { where: Row }) => Promise<number>;
  };
  loanRequest: {
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  repayment: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    findMany: (args: {
      where?: Row;
      include?: Row;
      orderBy?: Row[];
      take?: number;
      cursor?: { id: string };
      skip?: number;
    }) => Promise<Row[]>;
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  notification: {
    create: (args: { data: Row }) => Promise<Row>;
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
    delete: (args: { where: Row }) => Promise<Row>;
  };
  user: {
    findUnique: (args: { where: Row; select?: Row }) => Promise<Row | null>;
    findMany: (args: { where?: Row; select?: Row }) => Promise<Row[]>;
  };
  userVerification: {
    findFirst: (args: { where: Row }) => Promise<Row | null>;
    findMany: (args: { where: Row }) => Promise<Row[]>;
  };
  review: { findMany: (args: { where: Row; select?: Row }) => Promise<Row[]> };
  businessProfile: {
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  investorProfile: {
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  $transaction: (callback: (tx: FakeDb) => Promise<unknown>) => Promise<unknown>;
}

export function createFakeDb() {
  const loans: Row[] = [];
  const requests: Row[] = [];
  const repayments: Row[] = [];
  const notifications: Row[] = [];
  const reviews: Row[] = [];
  const trustUpdates: Row[] = [];
  const users = USERS.map((user) => ({ ...user }));
  const verifications: Row[] = [
    { userId: owner.id, type: "OWNER", status: "APPROVED" },
    { userId: investor.id, type: "INVESTOR", status: "APPROVED" },
    { userId: stranger.id, type: "INVESTOR", status: "APPROVED" },
  ];

  const db: FakeDb = {
    loan: {
      findUnique: async ({ where }: { where: Row }) => {
        const loan = loans.find((row) => matches(row, where, state));
        return loan ?? null;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of loans) {
          if (!matches(row, where, state)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
      count: async ({ where }: { where: Row }) =>
        loans.filter((row) => matches(row, where, state)).length,
    },
    loanRequest: {
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of requests) {
          if (!matches(row, where, state)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
    repayment: {
      findUnique: async ({ where }: { where: Row }) => {
        const row = repayments.find((item) => matches(item, where, state));
        return row ? withLoan(row) : null;
      },
      findMany: async (args: {
        where?: Row;
        include?: Row;
        orderBy?: Row[];
        take?: number;
        cursor?: { id: string };
        skip?: number;
      }) => {
        const rows = repayments.map(withLoan).filter((row) => matches(row, args.where ?? {}, state));
        return paginate(rows, args);
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of repayments) {
          if (!matches(row, where, state)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
    notification: {
      create: async ({ data }: { data: Row }) => {
        if (notifications.some((row) => row.id === data.id)) {
          throw { code: "P2002" };
        }
        const row = { id: data.id ?? `ntf_${notifications.length + 1}`, ...data };
        notifications.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: Row }) =>
        notifications.find((row) => matches(row, where, state)) ?? null,
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of notifications) {
          if (!matches(row, where, state)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
      delete: async ({ where }: { where: Row }) => {
        const index = notifications.findIndex((row) => matches(row, where, state));
        if (index < 0) throw new Error("Notification not found");
        return notifications.splice(index, 1)[0];
      },
    },
    user: {
      findUnique: async ({ where, select }: { where: Row; select?: Row }) => {
        const user = users.find((row) => matches(row, where, state));
        if (!user) return null;
        return select ? project(user, select) : user;
      },
      findMany: async ({ where, select }: { where?: Row; select?: Row }) => {
        const rows = users.filter((row) => matches(row, where ?? {}, state));
        return select ? rows.map((row) => project(row, select)) : rows;
      },
    },
    userVerification: {
      findFirst: async ({ where }: { where: Row }) =>
        verifications.find((row) => matches(row, where, state)) ?? null,
      findMany: async ({ where }: { where: Row }) =>
        verifications.filter((row) => matches(row, where, state)),
    },
    review: {
      findMany: async ({ where }: { where: Row }) =>
        reviews.filter((row) => matches(row, where, state)),
    },
    businessProfile: {
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        trustUpdates.push({ role: "OWNER", userId: where.ownerId, score: data.trustScore });
        return { count: 1 };
      },
    },
    investorProfile: {
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        trustUpdates.push({ role: "INVESTOR", userId: where.userId, score: data.trustScore });
        return { count: 1 };
      },
    },
    $transaction: async (callback: (tx: typeof db) => Promise<unknown>) => callback(db),
  };

  const state = {
    db,
    loans,
    requests,
    repayments,
    notifications,
    reviews,
    trustUpdates,
    users,
    verifications,
  };

  function withLoan(row: Row): Row {
    const loan = loans.find((item) => item.id === row.loanId);
    return { ...row, loan: loan ?? null };
  }

  return state;
}

function project(row: Row, select: Row): Row {
  return Object.fromEntries(
    Object.keys(select).filter((key) => key in row).map((key) => [key, row[key]]),
  );
}

export type State = ReturnType<typeof createFakeDb>;

export function seed(state: State, input: SeedInput = {}) {
  const request: Row = {
    id: "lr_1",
    ownerId: owner.id,
    purpose: "Buy a second oven",
    status: input.requestStatus ?? "REPAYING",
  };
  const loan: Row = {
    id: "loan_1",
    loanRequestId: request.id,
    offerId: "off_1",
    ownerId: owner.id,
    investorId: investor.id,
    principalBdt: 50_000,
    interestRatePct: "14.50",
    tenureDays: 90,
    repaymentFrequency: "MONTHLY",
    totalRepayableBdt: 51_788,
    status: input.loanStatus ?? "ACTIVE",
    startDate: input.startDate === undefined ? NOW : input.startDate,
    createdAt: new Date(NOW.getTime() - 7 * DAY),
    updatedAt: NOW,
    loanRequest: request,
    agreement:
      input.agreementId === null
        ? null
        : {
            id: input.agreementId ?? "agr_1",
            ownerConfirmedAt: NOW,
            investorConfirmedAt: NOW,
          },
  };
  const count = input.installmentCount ?? 3;
  const schedule = [17_262, 17_262, 17_264];
  const frequencyDays =
    loan.repaymentFrequency === "MONTHLY" ? 30 : loan.repaymentFrequency === "BIWEEKLY" ? 14 : 7;
  const installments = Array.from({ length: count }, (_, index) => {
    const installmentNo = index + 1;
    const dueDate = new Date(
      NOW.getTime() + (input.dueInDays ?? frequencyDays * (index + 1)) * DAY,
    );
    const isMarked = input.statuses?.[index] === "MARKED_PAID";
    const isConfirmed = input.statuses?.[index] === "CONFIRMED";
    return {
      id: `rep_${index + 1}`,
      loanId: loan.id,
      installmentNo,
      dueDate,
      amountBdt: input.amountBdt ?? schedule[index] ?? schedule.at(-1)!,
      status: input.statuses?.[index] ?? "UPCOMING",
      markedPaidAt: isMarked || isConfirmed ? (input.markedPaidAt ?? NOW) : null,
      confirmedAt: isConfirmed ? (input.confirmedAt ?? new Date(NOW.getTime() + DAY)) : null,
      note: null,
      proofUrl: null,
      createdAt: new Date(NOW.getTime() - 7 * DAY),
      updatedAt: NOW,
    };
  });

  state.requests.push(request);
  state.loans.push(loan);
  state.repayments.push(...installments);
  for (const user of state.users) {
    if (user.id === investor.id || user.id === owner.id || input.withReminderEmails) continue;
    user.email = null;
  }
  return { request, loan, installments };
}

export function deps(state: State) {
  return { db: state.db as never, now: () => NOW };
}
