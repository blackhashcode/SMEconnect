import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import { createReview, getReview, listReviews } from "@/server/services/reviews";
import { encodeCursor } from "@/lib/pagination";
import { reviewRecordSchema } from "@/server/validators/social";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_inv", role: "INVESTOR" as const };
const stranger = { id: "usr_str", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

type Row = Record<string, unknown>;

function publicUser(id: string, role: "OWNER" | "INVESTOR"): Row {
  return {
    id,
    name: `User ${id}`,
    image: null,
    role,
    status: "ACTIVE",
    email: "private@example.test",
    phone: "+8801712345678",
    businessProfile: null,
    investorProfile: null,
  };
}

function reviewRow(overrides: Row = {}): Row {
  return {
    id: "rev_1",
    loanId: "loan_1",
    reviewerId: investor.id,
    revieweeId: owner.id,
    rating: 5,
    comment: "Great partner",
    createdAt: NOW,
    updatedAt: NOW,
    reviewer: publicUser(investor.id, "INVESTOR"),
    reviewee: publicUser(owner.id, "OWNER"),
    ...overrides,
  };
}

function makeDb() {
  const db = {
    loan: {
      findUnique: vi.fn().mockResolvedValue({
        id: "loan_1",
        ownerId: owner.id,
        investorId: investor.id,
        status: "COMPLETED",
      }),
      count: vi.fn().mockResolvedValue(1),
    },
    repayment: { findMany: vi.fn().mockResolvedValue([]) },
    review: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(reviewRow()),
      findMany: vi.fn().mockImplementation(
        ({ where, take, cursor, skip }: Row) => {
          const filtered = [reviewRow(), reviewRow({ id: "rev_2" }), reviewRow({ id: "rev_3" })]
            .filter((row) => !where || row.revieweeId === (where as Row).revieweeId);
          const index = cursor ? filtered.findIndex((row) => row.id === (cursor as Row).id) : -1;
          const start = index >= 0 ? index + Number(skip ?? 1) : 0;
          return Promise.resolve(filtered.slice(start, start + Number(take ?? filtered.length)));
        },
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Row }) =>
        Promise.resolve({ id: "rev_1", ...data }),
      ),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(publicUser(owner.id, "OWNER")),
    },
    userVerification: {
      findFirst: vi.fn().mockResolvedValue({ id: "ver_1" }),
      findMany: vi.fn().mockResolvedValue([
        { userId: owner.id },
        { userId: investor.id },
      ]),
    },
    businessProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    investorProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: vi.fn().mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(db)),
  };
  return db;
}

const deps = (db: ReturnType<typeof makeDb>) => ({ db: db as never, now: () => NOW });

describe("createReview", () => {
  it("lets a loan participant review the other side after completion", async () => {
    const db = makeDb();
    const result = await createReview(
      investor as never,
      {
        loanId: "loan_1",
        revieweeId: owner.id,
        rating: 5,
        comment: "  Clear communication and on-time payments.  ",
      },
      deps(db),
    );

    expect(db.review.create).toHaveBeenCalledWith({
      data: {
        loanId: "loan_1",
        reviewerId: investor.id,
        revieweeId: owner.id,
        rating: 5,
        comment: "Clear communication and on-time payments.",
      },
    });
    expect(db.businessProfile.updateMany).toHaveBeenCalledWith({
      where: { ownerId: owner.id },
      data: { trustScore: expect.any(Number) },
    });
    expect(reviewRecordSchema.safeParse(result).success).toBe(true);
    expect(result.reviewer.verified).toBe(true);
    expect(result).not.toHaveProperty("reviewerId");
    expect(result).not.toHaveProperty("email");
  });

  it("derives the reviewee from the loan and rejects a forged target", async () => {
    const db = makeDb();
    await expect(
      createReview(
        investor as never,
        { loanId: "loan_1", revieweeId: stranger.id, rating: 4 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(db.review.create).not.toHaveBeenCalled();
  });

  it("only allows actual participants with the matching role", async () => {
    const db = makeDb();
    await expect(
      createReview(
        stranger as never,
        { loanId: "loan_1", revieweeId: owner.id, rating: 4 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    db.loan.findUnique.mockResolvedValue({
      id: "loan_1",
      ownerId: owner.id,
      investorId: investor.id,
      status: "COMPLETED",
    });
    await expect(
      createReview(
        { id: owner.id, role: "INVESTOR" },
        { loanId: "loan_1", revieweeId: investor.id, rating: 4 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createReview(
        admin as never,
        { loanId: "loan_1", revieweeId: owner.id, rating: 4 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires a completed loan and rejects duplicates", async () => {
    const db = makeDb();
    db.loan.findUnique.mockResolvedValue({
      id: "loan_1",
      ownerId: owner.id,
      investorId: investor.id,
      status: "REPAYING",
    });
    await expect(
      createReview(
        investor as never,
        { loanId: "loan_1", revieweeId: owner.id, rating: 4 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    db.loan.findUnique.mockResolvedValue({
      id: "loan_1",
      ownerId: owner.id,
      investorId: investor.id,
      status: "COMPLETED",
    });
    db.review.findFirst.mockResolvedValue({ id: "rev_existing" });
    await expect(
      createReview(
        investor as never,
        { loanId: "loan_1", revieweeId: owner.id, rating: 4 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    db.review.findFirst.mockResolvedValue(null);
    db.review.create.mockRejectedValue({ code: "P2002" });
    await expect(
      createReview(
        investor as never,
        { loanId: "loan_1", revieweeId: owner.id, rating: 4 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("validates the rating and rejects a missing loan", async () => {
    const db = makeDb();
    await expect(
      createReview(
        investor as never,
        { loanId: "loan_1", revieweeId: owner.id, rating: 6 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ZodError);

    db.loan.findUnique.mockResolvedValue(null);
    await expect(
      createReview(
        investor as never,
        { loanId: "loan_1", revieweeId: owner.id, rating: 5 },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("review reads", () => {
  it("returns one safe review by id", async () => {
    const db = makeDb();
    const result = await getReview("rev_1", { db: db as never });
    expect(db.review.findUnique).toHaveBeenCalledWith({
      where: { id: "rev_1" },
      include: expect.objectContaining({ reviewer: expect.anything() }),
    });
    expect(reviewRecordSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private@example.test");
  });

  it("lists a user's reviews with cursor pagination and verifies the target", async () => {
    const db = makeDb();

    const page = await listReviews(
      { userId: owner.id, limit: 2 },
      { db: db as never },
    );
    expect(page.items).toHaveLength(2);
    expect(page.meta).toMatchObject({ limit: 2, hasMore: true });
    expect(page.meta.nextCursor).toBe(encodeCursor({ id: "rev_2" }));
    expect(db.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { revieweeId: owner.id }, take: 3 }),
    );

    const next = await listReviews(
      { userId: owner.id, limit: 2, cursor: page.meta.nextCursor! },
      { db: db as never },
    );
    expect(next.items.map((item) => item.id)).toEqual(["rev_3"]);

    db.user.findUnique.mockResolvedValue(null);
    await expect(
      listReviews({ userId: "missing", limit: 20 }, { db: db as never }),
    ).rejects.toBeInstanceOf(NotFoundError);
    db.user.findUnique.mockResolvedValue({ ...publicUser(admin.id, "OWNER"), role: "ADMIN" });
    await expect(
      listReviews({ userId: admin.id, limit: 20 }, { db: db as never }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
