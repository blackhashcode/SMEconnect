import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { canAccessPrivateFile } from "@/server/storage/authorization";

const url = "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";

function fakeDb(ownerId: string, proofParticipantIds: string[] = []) {
  return {
    userVerification: {
      findFirst: async ({
        where,
      }: {
        where: { userId: string; OR: Array<Record<string, unknown>> };
      }) => (where.userId === ownerId ? { id: "ver_123" } : null),
    },
    repayment: {
      findFirst: async ({
        where,
      }: {
        where: {
          proofUrl: string;
          loan: { OR: Array<{ ownerId?: string; investorId?: string }> };
        };
      }) => {
        if (where.proofUrl !== url) return null;
        const ids = where.loan.OR.flatMap((clause) => [
          clause.ownerId,
          clause.investorId,
        ]).filter((id): id is string => typeof id === "string");
        return ids.some((id) => proofParticipantIds.includes(id)) ? { id: "rep_123" } : null;
      },
    },
  };
}

describe("private file authorization", () => {
  it("allows an admin", async () => {
    await expect(
      canAccessPrivateFile(url, { id: "usr_admin", role: "ADMIN" }, {
        db: fakeDb("usr_owner") as never,
      }),
    ).resolves.toBe(true);
  });

  it("allows the verification owner whose record references the file", async () => {
    await expect(
      canAccessPrivateFile(url, { id: "usr_owner", role: "OWNER" }, {
        db: fakeDb("usr_owner") as never,
      }),
    ).resolves.toBe(true);
  });

  it("allows a loan party to read a repayment proof", async () => {
    await expect(
      canAccessPrivateFile(url, { id: "usr_investor", role: "INVESTOR" }, {
        db: fakeDb("usr_owner", ["usr_investor"]) as never,
      }),
    ).resolves.toBe(true);
    await expect(
      canAccessPrivateFile(url, { id: "usr_owner", role: "OWNER" }, {
        db: fakeDb("usr_other", ["usr_owner"]) as never,
      }),
    ).resolves.toBe(true);
  });

  it("rejects another user and role-less actors", async () => {
    await expect(
      canAccessPrivateFile(url, { id: "usr_other", role: "INVESTOR" }, {
        db: fakeDb("usr_owner") as never,
      }),
    ).resolves.toBe(false);
    await expect(
      canAccessPrivateFile(url, { id: "usr_owner" }, {
        db: fakeDb("usr_owner") as never,
      }),
    ).resolves.toBe(false);
  });
});
