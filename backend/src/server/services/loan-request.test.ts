import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import { encodeCursor } from "@/lib/pagination";
import {
  ACTIVE_LOAN_STATUSES,
  cancelLoanRequest,
  createLoanRequest,
  getMyLoanRequest,
  getPublicLoanRequest,
  listMyLoanRequests,
  listPublicLoanRequests,
  pauseLoanRequest,
  publishLoanRequest,
  resumeLoanRequest,
  updateLoanRequest,
} from "@/server/services/loan-request";

type Row = Record<string, unknown>;

interface FakeDb {
  loanRequest: {
    create: (args: { data: Row }) => Promise<Row>;
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    findFirst: (args: { where: Row; include?: Row }) => Promise<Row | null>;
    findMany: (args: {
      where: Row;
      orderBy: Row[];
      take: number;
      cursor?: Row;
      skip?: number;
      include?: Row;
    }) => Promise<Row[]>;
    count: (args: { where: Row }) => Promise<number>;
    update: (args: { where: Row; data: Row }) => Promise<Row>;
  };
  post: {
    create: (args: { data: Row }) => Promise<Row>;
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  userVerification: {
    findFirst: (args: { where: Row }) => Promise<Row | null>;
    findMany: (args: { where: Row }) => Promise<Row[]>;
  };
  businessProfile: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
  };
  $transaction: (callback: (tx: FakeDb) => Promise<unknown>) => Promise<unknown>;
}

const NOW = new Date("2026-11-23T18:00:00.000Z");
const owner = { id: "usr_owner", role: "OWNER" as const };
const otherOwner = { id: "usr_other", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

const PUBLIC_OWNERS: Record<string, Row> = {
  usr_owner: {
    id: "usr_owner",
    name: "Nusrat Akter",
    image: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
    email: "secret@example.com",
    phone: "+8801712345678",
    businessProfile: {
      shopName: "Nusrat's Home Kitchen",
      slug: "nusrat-home-kitchen",
      category: "Food",
      district: "Dhaka",
      city: "Dhanmondi",
      logoUrl: null,
      trustScore: 80,
    },
  },
  usr_other: {
    id: "usr_other",
    name: "Other Owner",
    image: null,
    businessProfile: {
      shopName: "Other Shop",
      slug: "other-shop",
      category: "Crafts",
      district: "Chattogram",
      city: "Chattogram",
      logoUrl: null,
      trustScore: 50,
    },
  },
};

const GOOD_PROFILE = {
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
  district: "Dhaka",
  city: "Dhanmondi",
};

const validInput = {
  amountBdt: 50_000,
  purpose: "Buy a second oven",
  fundUsage: "Expand weekend meal prep capacity",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY" as const,
  proposedRatePct: "14.5",
  proofUrls: [] as string[],
};

function matches(row: Row, where: Row, profiles?: Map<string, Row>): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (key === "owner" && expected && typeof expected === "object") {
      const profileFilter = (expected as Row).businessProfile as Row | undefined;
      const ownerProfile = (profiles?.get(String(row.ownerId)) ??
        PUBLIC_OWNERS[String(row.ownerId)]?.businessProfile) as Row | undefined;
      if (!profileFilter || !ownerProfile) return false;
      for (const [field, rule] of Object.entries(profileFilter)) {
        const value = (rule as Row)?.equals ?? rule;
        if (String(ownerProfile[field]).toLowerCase() !== String(value).toLowerCase()) {
          return false;
        }
      }
      continue;
    }
    if (expected && typeof expected === "object") {
      const rule = expected as Row;
      if ("in" in rule && Array.isArray(rule.in) && !rule.in.includes(row[key])) return false;
      if ("not" in rule && row[key] === rule.not) return false;
      if ("gte" in rule && Number(row[key]) < Number(rule.gte)) return false;
      if ("lte" in rule && Number(row[key]) > Number(rule.lte)) return false;
      if ("equals" in rule && row[key] !== rule.equals) return false;
      continue;
    }
    if (row[key] !== expected) return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    for (const rule of orderBy) {
      const [field, direction] = Object.entries(rule)[0];
      const left = a[field];
      const right = b[field];
      if (left === right) continue;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      const result = String(left).localeCompare(String(right), undefined, { numeric: true });
      return direction === "desc" ? -result : result;
    }
    return 0;
  });
}

function uniqueOwnerError() {
  const error = new Error("Unique constraint failed") as Error & {
    code: string;
    meta: { target: string[] };
  };
  error.code = "P2002";
  error.meta = { target: ["ownerId", "loan_request_one_active_per_owner"] };
  return error;
}

function createFakeDb() {
  const requests: Row[] = [];
  const posts: Row[] = [];
  const verifications: Row[] = [];
  const profiles = new Map<string, Row>();
  let requestSeq = 0;
  let postSeq = 0;

  const db: FakeDb = {
    loanRequest: {
      create: async ({ data }) => {
        const row: Row = {
          id: `lr_${++requestSeq}`,
          proofUrls: [],
          publishedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
          ...data,
        };
        requests.push(row);
        return row;
      },
      findUnique: async ({ where }) => requests.find((row) => row.id === where.id) ?? null,
      findFirst: async ({ where, include }) => {
        const row = requests.find((item) => matches(item, where, profiles));
        if (!row) return null;
        return include ? { ...row, owner: PUBLIC_OWNERS[String(row.ownerId)] ?? null } : row;
      },
      findMany: async ({ where, orderBy, take, cursor, include }) => {
        let rows = requests.filter((row) => matches(row, where, profiles));
        rows = sortRows(rows, orderBy);
        if (cursor?.id) {
          const index = rows.findIndex((row) => row.id === cursor.id);
          rows = index >= 0 ? rows.slice(index + 1) : rows;
        }
        return rows.slice(0, take).map((row) =>
          include ? { ...row, owner: PUBLIC_OWNERS[String(row.ownerId)] ?? null } : { ...row },
        );
      },
      count: async ({ where }) => requests.filter((row) => matches(row, where, profiles)).length,
      update: async ({ where, data }) => {
        const row = requests.find((item) => item.id === where.id);
        if (!row) throw new Error("Request missing");
        Object.assign(row, data);
        return row;
      },
    },
    post: {
      create: async ({ data }) => {
        const row: Row = { id: `post_${++postSeq}`, deletedAt: null, ...data };
        posts.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const post of posts) {
          if (
            post.loanRequestId === where.loanRequestId &&
            post.type === where.type &&
            post.deletedAt === null
          ) {
            Object.assign(post, data);
            count++;
          }
        }
        return { count };
      },
    },
    userVerification: {
      findFirst: async ({ where }) =>
        verifications.find(
          (item) =>
            item.userId === where.userId &&
            (!where.type || item.type === where.type) &&
            (!where.status || item.status === where.status),
        ) ?? null,
      findMany: async ({ where }) => {
        const ids = (where.userId as Row).in as string[];
        return verifications.filter(
          (item) =>
            ids.includes(item.userId as string) &&
            item.type === where.type &&
            item.status === where.status,
        );
      },
    },
    businessProfile: {
      findUnique: async ({ where }) => profiles.get(String(where.ownerId)) ?? null,
    },
    $transaction: async (callback) => callback(db),
  };

  return { db, requests, posts, verifications, profiles };
}

function deps(state: ReturnType<typeof createFakeDb>) {
  return { db: state.db as never, now: () => NOW };
}

function seedApproved(state: ReturnType<typeof createFakeDb>, userId = owner.id) {
  state.verifications.push({ userId, type: "OWNER", status: "APPROVED" });
  state.profiles.set(userId, { ...GOOD_PROFILE, ownerId: userId });
}

function seedRequest(
  state: ReturnType<typeof createFakeDb>,
  ownerId = owner.id,
  overrides: Row = {},
): Row & { id: string } {
  const row: Row & { id: string } = {
    id: `lr_${state.requests.length + 1}`,
    ownerId,
    ...validInput,
    proposedRatePct: "14.50",
    status: "DRAFT",
    publishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
  state.requests.push(row);
  return row;
}

describe("createLoanRequest", () => {
  it("creates a DRAFT owned by the session user", async () => {
    const state = createFakeDb();
    const result = await createLoanRequest(owner, validInput, deps(state));

    expect(result).toMatchObject({
      status: "DRAFT",
      proposedRatePct: "14.50",
      amountBdt: 50_000,
      publishedAt: null,
    });
    expect(state.requests[0].ownerId).toBe(owner.id);
  });

  it.each([investor, admin])("rejects a non-OWNER actor", async (actor) => {
    const state = createFakeDb();
    await expect(createLoanRequest(actor, validInput, deps(state))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("rejects client-supplied server-controlled fields", async () => {
    const state = createFakeDb();
    await expect(
      createLoanRequest(
        owner,
        { ...validInput, ownerId: otherOwner.id, status: "OPEN" } as never,
        deps(state),
      ),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("ownership and eligibility", () => {
  it("hides other owners' requests and blocks edits to them", async () => {
    const state = createFakeDb();
    const request = seedRequest(state, otherOwner.id);

    await expect(getMyLoanRequest(owner, request.id, deps(state))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      updateLoanRequest(owner, request.id, { purpose: "Stolen" }, deps(state)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(publishLoanRequest(owner, request.id, deps(state))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("returns 404 for missing requests", async () => {
    const state = createFakeDb();
    await expect(getMyLoanRequest(owner, "missing", deps(state))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(publishLoanRequest(owner, "missing", deps(state))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("allows editing only DRAFT and PAUSED requests", async () => {
    const state = createFakeDb();
    const draft = seedRequest(state);
    const open = seedRequest(state, owner.id, { status: "OPEN" });
    const paused = seedRequest(state, owner.id, { status: "PAUSED" });

    expect((await updateLoanRequest(owner, draft.id, { amountBdt: 60_000 }, deps(state))).amountBdt).toBe(60_000);
    expect((await updateLoanRequest(owner, paused.id, { amountBdt: 70_000 }, deps(state))).amountBdt).toBe(70_000);
    await expect(
      updateLoanRequest(owner, open.id, { amountBdt: 80_000 }, deps(state)),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("publishing prerequisites", () => {
  it("requires an APPROVED verification", async () => {
    const state = createFakeDb();
    state.profiles.set(owner.id, { ...GOOD_PROFILE });
    const request = seedRequest(state);

    await expect(publishLoanRequest(owner, request.id, deps(state))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(state.requests[0].status).toBe("DRAFT");
  });

  it("requires a complete business profile", async () => {
    const state = createFakeDb();
    state.verifications.push({ userId: owner.id, type: "OWNER", status: "APPROVED" });
    const request = seedRequest(state);

    await expect(publishLoanRequest(owner, request.id, deps(state))).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
  });

  it("allows a second DRAFT but blocks publishing while another request is active", async () => {
    const state = createFakeDb();
    seedApproved(state);
    seedRequest(state, owner.id, { status: "OPEN" });
    const second = seedRequest(state);

    expect(state.requests).toHaveLength(2);
    await expect(publishLoanRequest(owner, second.id, deps(state))).rejects.toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
      status: 422,
    });
  });

  it("maps a concurrent unique-index violation to 422", async () => {
    const state = createFakeDb();
    seedApproved(state);
    const request = seedRequest(state);
    const originalUpdate = state.db.loanRequest.update;
    state.db.loanRequest.update = async (args: { where: Row; data: Row }) => {
      if (args.data.status === "OPEN") throw uniqueOwnerError();
      return originalUpdate(args);
    };

    await expect(publishLoanRequest(owner, request.id, deps(state))).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
  });
});

describe("state transitions", () => {
  function readyState() {
    const state = createFakeDb();
    seedApproved(state);
    return state;
  }

  it("publishes DRAFT → OPEN, sets publishedAt and creates the feed post", async () => {
    const state = readyState();
    const request = seedRequest(state);

    const result = await publishLoanRequest(owner, request.id, deps(state));

    expect(result.status).toBe("OPEN");
    expect(result.publishedAt).toBe(NOW.toISOString());
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0]).toMatchObject({
      authorId: owner.id,
      type: "LOAN_REQUEST",
      loanRequestId: request.id,
      deletedAt: null,
    });
  });

  it("pauses OPEN → PAUSED and hides the post, then resumes PAUSED → OPEN", async () => {
    const state = readyState();
    const request = seedRequest(state);
    await publishLoanRequest(owner, request.id, deps(state));

    const paused = await pauseLoanRequest(owner, request.id, deps(state));
    expect(paused.status).toBe("PAUSED");
    expect(state.posts[0].deletedAt).toEqual(NOW);

    const resumed = await resumeLoanRequest(owner, request.id, deps(state));
    expect(resumed.status).toBe("OPEN");
    expect(resumed.publishedAt).toBe(NOW.toISOString());
    expect(state.posts.filter((post) => post.deletedAt === null)).toHaveLength(1);
  });

  it("pauses IN_DISCUSSION → PAUSED", async () => {
    const state = readyState();
    const request = seedRequest(state, owner.id, { status: "IN_DISCUSSION", publishedAt: NOW });

    expect((await pauseLoanRequest(owner, request.id, deps(state))).status).toBe("PAUSED");
  });

  it.each([
    ["DRAFT", "pauseLoanRequest"],
    ["DRAFT", "resumeLoanRequest"],
    ["FUNDED", "cancelLoanRequest"],
    ["COMPLETED", "resumeLoanRequest"],
    ["CANCELLED", "publishLoanRequest"],
    ["OPEN", "publishLoanRequest"],
    ["PAUSED", "pauseLoanRequest"],
  ])("rejects %s → %s", async (from, action) => {
    const state = readyState();
    const request = seedRequest(state, owner.id, { status: from });

    const actions: Record<
      string,
      (actor: typeof owner, id: string, dependencies: ReturnType<typeof deps>) => Promise<unknown>
    > = {
      publishLoanRequest,
      pauseLoanRequest,
      resumeLoanRequest,
      cancelLoanRequest,
    };
    await expect(actions[action](owner, request.id, deps(state))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("cancels a DRAFT request", async () => {
    const state = readyState();
    const request = seedRequest(state);

    const result = await cancelLoanRequest(owner, request.id, deps(state));
    expect(result.status).toBe("CANCELLED");
    expect(state.posts).toHaveLength(0);
    await expect(publishLoanRequest(owner, request.id, deps(state))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("cancels an OPEN request and hides the feed post", async () => {
    const state = readyState();
    const request = seedRequest(state);
    await publishLoanRequest(owner, request.id, deps(state));

    const result = await cancelLoanRequest(owner, request.id, deps(state));
    expect(result.status).toBe("CANCELLED");
    expect(state.posts[0].deletedAt).toEqual(NOW);
    await expect(resumeLoanRequest(owner, request.id, deps(state))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("blocks resume when another active request was created in the meantime", async () => {
    const state = readyState();
    const paused = seedRequest(state, owner.id, { status: "PAUSED" });
    seedRequest(state, owner.id, { status: "OPEN" });

    await expect(resumeLoanRequest(owner, paused.id, deps(state))).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
  });

  it("exposes the active statuses used by the DB partial index", () => {
    expect(ACTIVE_LOAN_STATUSES).toEqual(["OPEN", "IN_DISCUSSION", "FUNDED", "REPAYING"]);
  });
});

describe("pagination and public visibility", () => {
  it("paginates the owner's requests with a cursor", async () => {
    const state = createFakeDb();
    const first = seedRequest(state, owner.id, { createdAt: new Date("2026-11-23T19:00:00.000Z") });
    seedRequest(state, owner.id, { createdAt: new Date("2026-11-23T18:00:00.000Z") });
    seedRequest(state, otherOwner.id);

    const page1 = await listMyLoanRequests(owner, { limit: 1 }, deps(state));
    expect(page1.items).toHaveLength(1);
    expect(page1.meta.hasMore).toBe(true);
    expect(page1.meta.nextCursor).toBeTruthy();

    const page2 = await listMyLoanRequests(
      owner,
      { limit: 1, cursor: page1.meta.nextCursor ?? undefined },
      deps(state),
    );
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
    expect(page2.meta.hasMore).toBe(false);
    expect(first.ownerId).toBe(owner.id);
  });

  it("rejects a malformed cursor", async () => {
    const state = createFakeDb();
    await expect(
      listMyLoanRequests(owner, { limit: 20, cursor: "not-a-cursor" }, deps(state)),
    ).rejects.toThrow();
  });

  it("lists only OPEN requests for the public with filters and pagination", async () => {
    const state = createFakeDb();
    seedApproved(state);
    seedApproved(state, otherOwner.id);
    const open = seedRequest(state, owner.id, { status: "OPEN", publishedAt: NOW });
    seedRequest(state, otherOwner.id, {
      status: "OPEN",
      publishedAt: new Date("2026-11-23T17:00:00.000Z"),
    });
    seedRequest(state, owner.id, { status: "DRAFT" });

    const result = await listPublicLoanRequests(
      { limit: 1, sort: "newest", category: "food" },
      deps(state),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(open.id);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.nextCursor).toBe(encodeCursor({ id: open.id }));
  });

  it("applies min and max amount filters together", async () => {
    const state = createFakeDb();
    const inRange = seedRequest(state, owner.id, {
      status: "OPEN",
      publishedAt: NOW,
      amountBdt: 50_000,
    });
    seedRequest(state, otherOwner.id, {
      status: "OPEN",
      publishedAt: NOW,
      amountBdt: 10_000,
    });
    seedRequest(state, owner.id, {
      status: "OPEN",
      publishedAt: NOW,
      amountBdt: 100_000,
    });

    const result = await listPublicLoanRequests(
      { limit: 20, sort: "newest", minAmountBdt: 40_000, maxAmountBdt: 60_000 },
      deps(state),
    );

    expect(result.items.map((item) => item.id)).toEqual([inRange.id]);
  });

  it("returns sanitized public data with a verified badge", async () => {
    const state = createFakeDb();
    seedApproved(state);
    const request = seedRequest(state, owner.id, {
      status: "OPEN",
      publishedAt: NOW,
      proofUrls: ["https://example.com/secret-proof.jpg"],
    });

    const detail = await getPublicLoanRequest(request.id, deps(state));
    const serialized = JSON.stringify(detail);

    expect(detail.owner.verified).toBe(true);
    expect(detail.owner.shopName).toBe("Nusrat's Home Kitchen");
    for (const forbidden of [
      "ownerId",
      "proofUrls",
      "status",
      "updatedAt",
      "secret-proof",
      "secret@example.com",
      "+8801712345678",
      owner.id,
      "usr_other",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("returns 404 for non-OPEN public requests and unverified owners get verified:false", async () => {
    const state = createFakeDb();
    const draft = seedRequest(state, owner.id, { status: "DRAFT" });
    const open = seedRequest(state, owner.id, { status: "OPEN", publishedAt: NOW });

    await expect(getPublicLoanRequest(draft.id, deps(state))).rejects.toBeInstanceOf(NotFoundError);
    expect((await getPublicLoanRequest(open.id, deps(state))).owner.verified).toBe(false);
  });
});
