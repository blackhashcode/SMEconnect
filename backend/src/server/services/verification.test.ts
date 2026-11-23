import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/server/errors";
import {
  getMyVerification,
  listVerifications,
  reviewVerification,
  submitVerification,
} from "@/server/services/verification";

const ID_URL =
  "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";
const SALES_URL =
  "/api/v1/files/private/3a9d2b65-7c8e-4d0f-8a12-1b2c3d4e5f60.jpg";
const now = new Date("2026-11-23T18:00:00.000Z");

const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

const ownerInput = {
  type: "OWNER" as const,
  idDocumentUrl: ID_URL,
  salesProofUrls: [SALES_URL],
  shopLinks: ["https://www.facebook.com/shop/example"],
};

interface Row {
  id: string;
  userId: string;
  reviewerId: string | null;
  type: "OWNER" | "INVESTOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "ver_123",
    userId: owner.id,
    reviewerId: null,
    type: "OWNER",
    status: "PENDING",
    idDocumentUrl: ID_URL,
    salesProofUrls: [SALES_URL],
    shopLinks: [],
    reviewNote: null,
    submittedAt: now,
    reviewedAt: null,
    ...overrides,
  };
}

function createFakeDb(initial: Row[] = []) {
  const records = [...initial];
  const notifications: Array<Record<string, unknown>> = [];
  const trustUpdates: Array<Record<string, unknown>> = [];
  let sequence = 0;

  const db = {
    userVerification: {
      findFirst: async ({
        where,
      }: {
        where: { id?: string; userId?: string; type?: string };
      }) =>
        records.find(
          (record) =>
            (!where.id || record.id === where.id) &&
            (!where.userId || record.userId === where.userId) &&
            (!where.type || record.type === where.type),
        ) ?? null,
      findMany: async ({ take }: { take: number }) => records.slice(0, take),
      create: async ({ data }: { data: Partial<Row> }) => {
        const row = makeRow({ id: `ver_${++sequence}`, ...data });
        records.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => {
        const row = records.find((item) => item.id === where.id);
        if (!row) throw new Error("Verification missing");
        Object.assign(row, data);
        return row;
      },
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        notifications.push(data);
        return { id: `ntf_${notifications.length}`, ...data };
      },
    },
    loan: { count: async () => 0 },
    repayment: { findMany: async () => [] },
    review: { findMany: async () => [] },
    businessProfile: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        trustUpdates.push({ role: "OWNER", ...data });
        return { count: 1 };
      },
    },
    investorProfile: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        trustUpdates.push({ role: "INVESTOR", ...data });
        return { count: 1 };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(db),
  };

  return { db, records: () => records, notifications, trustUpdates };
}

function deps(fake: ReturnType<typeof createFakeDb>) {
  return { db: fake.db as never, now: () => now };
}

describe("verification submission", () => {
  it("creates a pending verification for the actor's role", async () => {
    const fake = createFakeDb();
    const result = await submitVerification(owner, ownerInput, deps(fake));

    expect(result.status).toBe("PENDING");
    expect(result.submittedAt).toBe(now.toISOString());
    expect(fake.records()[0]).toMatchObject({
      userId: owner.id,
      type: "OWNER",
      idDocumentUrl: ID_URL,
      salesProofUrls: [SALES_URL],
    });
  });

  it("rejects a mismatched type and an admin submission", async () => {
    const fake = createFakeDb();

    await expect(
      submitVerification(owner, { ...ownerInput, type: "INVESTOR" }, deps(fake)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      submitVerification(admin, ownerInput, deps(fake)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks resubmission while pending or approved", async () => {
    for (const status of ["PENDING", "APPROVED"] as const) {
      const fake = createFakeDb([makeRow({ status })]);
      await expect(
        submitVerification(owner, ownerInput, deps(fake)),
      ).rejects.toBeInstanceOf(ConflictError);
    }
  });

  it("replaces a rejected verification and clears review fields", async () => {
    const fake = createFakeDb([
      makeRow({
        status: "REJECTED",
        reviewerId: admin.id,
        reviewNote: "Blurry document",
        reviewedAt: new Date("2026-11-22T18:00:00.000Z"),
      }),
    ]);

    const result = await submitVerification(owner, ownerInput, deps(fake));

    expect(result.status).toBe("PENDING");
    expect(result.reviewNote).toBeNull();
    expect(result.reviewedAt).toBeNull();
    expect(fake.records()).toHaveLength(1);
    expect(fake.records()[0].reviewerId).toBeNull();
  });

  it("returns null when the current user has no verification", async () => {
    const fake = createFakeDb();
    await expect(getMyVerification(investor, deps(fake))).resolves.toBeNull();
  });
});

describe("admin verification review", () => {
  it("approves a pending verification and notifies its owner", async () => {
    const fake = createFakeDb([makeRow()]);

    const result = await reviewVerification(
      admin,
      "ver_123",
      { status: "APPROVED", reviewNote: "Documents checked" },
      deps(fake),
    );

    expect(result.status).toBe("APPROVED");
    expect(result.reviewNote).toBe("Documents checked");
    expect(result.reviewedAt).toBe(now.toISOString());
    expect(fake.notifications).toEqual([
      expect.objectContaining({
        userId: owner.id,
        type: "VERIFICATION_RESULT",
        title: "Verification approved",
        data: { verificationId: "ver_123", status: "APPROVED" },
      }),
    ]);
  });

  it("requires a note to reject", async () => {
    const fake = createFakeDb([makeRow()]);

    await expect(
      reviewVerification(admin, "ver_123", { status: "REJECTED" }, deps(fake)),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects only pending verifications and only for admins", async () => {
    const pending = createFakeDb([makeRow()]);
    await expect(
      reviewVerification(
        investor,
        "ver_123",
        { status: "REJECTED", reviewNote: "Not allowed" },
        deps(pending),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const reviewed = createFakeDb([makeRow({ status: "APPROVED" })]);
    await expect(
      reviewVerification(
        admin,
        "ver_123",
        { status: "REJECTED", reviewNote: "Too late" },
        deps(reviewed),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("paginates the admin queue with an opaque cursor", async () => {
    const fake = createFakeDb([
      makeRow({ id: "ver_1" }),
      makeRow({ id: "ver_2" }),
      makeRow({ id: "ver_3" }),
    ]);

    const result = await listVerifications(
      admin,
      { limit: 2, status: "PENDING" },
      deps(fake),
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ userId: owner.id, reviewerId: null });
    expect(result.meta).toMatchObject({ limit: 2, hasMore: true });
    expect(result.meta.nextCursor).toBeTypeOf("string");
  });
});
