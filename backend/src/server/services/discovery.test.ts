import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { encodeCursor } from "@/lib/pagination";
import { BusinessRuleError, ForbiddenError } from "@/server/errors";
import {
  discoverBusinesses,
  discoverInvestors,
  suggestBusinesses,
  suggestInvestors,
} from "@/server/services/discovery";

type Row = Record<string, unknown>;
const investor = { id: "usr_inv", role: "INVESTOR" as const };
const owner = { id: "usr_own", role: "OWNER" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

function businessRow(overrides: Row = {}): Row {
  return {
    id: "usr_biz",
    name: "Nusrat Akter",
    image: null,
    role: "OWNER",
    status: "ACTIVE",
    email: "secret@example.com",
    phone: "+8801712345678",
    businessProfile: {
      shopName: "Nusrat's Kitchen",
      slug: "nusrat-kitchen",
      category: "Food",
      description: "Home-cooked meals",
      district: "Dhaka",
      city: "Dhanmondi",
      logoUrl: null,
      trustScore: 80,
    },
    investorProfile: null,
    loanRequests: [
      {
        id: "lr_1",
        amountBdt: 50_000,
        tenureDays: 90,
        proposedRatePct: "14.50",
        proofUrls: ["private-proof"],
      },
    ],
    ...overrides,
  };
}

function investorRow(overrides: Row = {}): Row {
  return {
    id: "usr_inv2",
    name: "Rahim Uddin",
    image: null,
    role: "INVESTOR",
    status: "ACTIVE",
    email: "secret@example.com",
    phone: "+8801712345678",
    businessProfile: null,
    investorProfile: {
      bio: "Angel investor",
      minLendBdt: 10_000,
      maxLendBdt: 100_000,
      preferredCategories: ["Food", "Crafts"],
      preferredTenureDays: 90,
      district: "Dhaka",
      city: "Dhanmondi",
      trustScore: 75,
    },
    loanRequests: [],
    ...overrides,
  };
}

interface FakeDb {
  user: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
}

function makeDb(): FakeDb {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
}

let db: FakeDb;
beforeEach(() => {
  db = makeDb();
});

describe("discoverBusinesses", () => {
  it("only queries approved, active owners and exposes a safe projection", async () => {
    db.user.findMany.mockResolvedValue([businessRow()]);
    const page = await discoverBusinesses({ limit: 20 }, { db: db as never });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "OWNER",
          status: "ACTIVE",
          businessProfile: expect.objectContaining({ isNot: null }),
          verificationsSubmitted: {
            some: { type: "OWNER", status: "APPROVED" },
          },
        }),
      }),
    );
    expect(page.items[0]).toMatchObject({
      role: "OWNER",
      verified: true,
      shopName: "Nusrat's Kitchen",
      trustScore: 80,
      loanRequest: { amountBdt: 50_000, proposedRatePct: "14.50" },
    });
    for (const key of ["email", "phone", "proofUrls", "idDocumentUrl"]) {
      expect(page.items[0]).not.toHaveProperty(key);
    }
    expect(page.items[0].loanRequest).not.toHaveProperty("proofUrls");
  });

  it("applies text, location, amount and trust filters", async () => {
    await discoverBusinesses(
      {
        limit: 20,
        q: "kitchen",
        category: "food",
        location: "dhaka",
        district: "dhaka",
        minAmountBdt: 20_000,
        maxAmountBdt: 80_000,
        maxTenureDays: 120,
        minTrustScore: 70,
        sort: "trustScore",
      },
      { db: db as never },
    );

    const call = db.user.findMany.mock.calls[0][0] as Row;
    const where = call.where as Row;
    const profile = where.businessProfile as Row;
    const and = profile.AND as Row[];
    expect(profile.isNot).toBeNull();
    expect(JSON.stringify(and)).toContain("shopName");
    expect(JSON.stringify(and)).toContain("description");
    expect(JSON.stringify(and)).toContain("category");
    expect(JSON.stringify(and)).toContain("trustScore");
    expect(JSON.stringify(where.loanRequests)).toContain("status");
    expect(JSON.stringify(where.loanRequests)).toContain("amountBdt");
    expect(JSON.stringify(where.loanRequests)).toContain("tenureDays");
    expect(call.orderBy as Row[]).toEqual([
      { businessProfile: { trustScore: "desc" } },
      { id: "desc" },
    ]);
  });

  it("paginates with limit+1 and rejects bad sort values", async () => {
    db.user.findMany.mockResolvedValue([
      businessRow(),
      businessRow({ id: "usr_biz2" }),
      businessRow({ id: "usr_biz3" }),
    ]);
    const page = await discoverBusinesses({ limit: 2 }, { db: db as never });
    expect(page.items).toHaveLength(2);
    expect(page.meta.nextCursor).toBe(encodeCursor({ id: "usr_biz2" }));

    await expect(
      discoverBusinesses({ limit: 20, sort: "amountAsc" } as never, { db: db as never }),
    ).rejects.toThrow(ZodError);
  });
});

describe("discoverInvestors", () => {
  it("only queries approved, active investors with a safe projection", async () => {
    db.user.findMany.mockResolvedValue([investorRow()]);
    const page = await discoverInvestors({ limit: 20 }, { db: db as never });
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "INVESTOR",
          status: "ACTIVE",
          verificationsSubmitted: {
            some: { type: "INVESTOR", status: "APPROVED" },
          },
        }),
      }),
    );
    expect(page.items[0]).toMatchObject({
      role: "INVESTOR",
      verified: true,
      minLendBdt: 10_000,
      maxLendBdt: 100_000,
      preferredCategories: ["Food", "Crafts"],
    });
    expect(page.items[0]).not.toHaveProperty("email");
    expect(page.items[0]).not.toHaveProperty("phone");
  });

  it("matches categories with has and lends with an overlapping range", async () => {
    await discoverInvestors(
      { limit: 20, category: "food", minLendBdt: 20_000, maxLendBdt: 80_000, sort: "lendAsc" },
      { db: db as never },
    );
    const call = db.user.findMany.mock.calls[0][0] as Row;
    expect(JSON.stringify(call.where)).toContain("preferredCategories");
    expect(JSON.stringify(call.where)).toContain("maxLendBdt");
    expect((call.orderBy as Row[])[0]).toEqual({ investorProfile: { minLendBdt: "asc" } });
  });
});

describe("suggestions", () => {
  it("restricts business suggestions to investors and derives filters from their profile", async () => {
    db.user.findUnique.mockResolvedValue(
      investorRow({
        id: investor.id,
        investorProfile: {
          ...(investorRow().investorProfile as Row),
          preferredCategories: ["Food"],
          district: "Dhaka",
          city: "Dhanmondi",
          minLendBdt: 20_000,
          maxLendBdt: 80_000,
        },
      }),
    );
    db.user.findMany.mockResolvedValue([businessRow()]);

    await expect(suggestBusinesses(admin, { limit: 20 }, { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
    const page = await suggestBusinesses(investor, { limit: 20 }, { db: db as never });
    expect(page.items[0]).toMatchObject({ role: "OWNER", verified: true });

    const where = (db.user.findMany.mock.calls[0][0] as Row).where as Row;
    expect(JSON.stringify(where.businessProfile)).toContain('"in"');
    expect(JSON.stringify(where.loanRequests)).toContain("lte");
    expect(JSON.stringify(where.loanRequests)).toContain("gte");
    expect(JSON.stringify(where)).toContain('"APPROVED"');
  });

  it("restricts investor suggestions to owners and uses the owner's OPEN request", async () => {
    db.user.findUnique.mockResolvedValue(businessRow({ id: owner.id }));
    db.user.findMany.mockResolvedValue([investorRow()]);

    await expect(suggestInvestors(admin, { limit: 20 }, { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
    const page = await suggestInvestors(owner, { limit: 20 }, { db: db as never });
    expect(page.items[0]).toMatchObject({ role: "INVESTOR", verified: true });
    const where = (db.user.findMany.mock.calls[0][0] as Row).where as Row;
    expect(JSON.stringify(where.investorProfile)).toContain("preferredCategories");
    expect(JSON.stringify(where.investorProfile)).toContain("minLendBdt");
    expect(JSON.stringify(where)).toContain('"APPROVED"');
  });

  it("requires a profile before giving suggestions", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(suggestInvestors(owner, { limit: 20 }, { db: db as never })).rejects.toThrow(
      BusinessRuleError,
    );
  });
});
