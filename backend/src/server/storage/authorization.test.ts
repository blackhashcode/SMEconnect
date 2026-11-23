import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { canAccessPrivateFile } from "@/server/storage/authorization";

const url = "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";

function fakeDb(ownerId: string) {
  return {
    userVerification: {
      findFirst: async ({
        where,
      }: {
        where: { userId: string; OR: Array<Record<string, unknown>> };
      }) =>
        where.userId === ownerId
          ? { id: "ver_123" }
          : null,
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
