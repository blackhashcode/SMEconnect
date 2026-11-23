import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/server/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}));

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  requireOwnership,
  requireRole,
  requireSession,
} from "@/server/auth/guards";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";

const owner = { id: "usr_owner", role: "OWNER", status: "ACTIVE" };
const investor = { id: "usr_investor", role: "INVESTOR", status: "ACTIVE" };
const admin = { id: "usr_admin", role: "ADMIN", status: "ACTIVE" };
const suspended = { ...owner, status: "SUSPENDED" };

describe("session guards", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("blocks suspended users from all protected access", async () => {
    getSession.mockResolvedValue({ user: suspended });
    await expect(requireSession()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireRole("OWNER")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireOwnership(suspended.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("allows only the requested roles", async () => {
    getSession.mockResolvedValue({ user: admin });
    await expect(requireRole("ADMIN")).resolves.toMatchObject({
      user: { id: admin.id },
    });

    getSession.mockResolvedValue({ user: owner });
    await expect(requireRole("ADMIN")).rejects.toBeInstanceOf(ForbiddenError);

    getSession.mockResolvedValue({ user: investor });
    await expect(requireRole("ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps ownership checks explicit even for admins", async () => {
    getSession.mockResolvedValue({ user: admin });
    await expect(requireOwnership(owner.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      requireOwnership(owner.id, { allowAdmin: true }),
    ).resolves.toMatchObject({ user: { id: admin.id } });

    getSession.mockResolvedValue({ user: owner });
    await expect(requireOwnership(owner.id)).resolves.toMatchObject({
      user: { id: owner.id },
    });
  });
});
