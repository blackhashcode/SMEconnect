import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { socialSignupRole } from "@/server/auth/signup-role";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/server/errors";
import { switchOwnRole } from "@/server/services/account-role";
import { listAdminLoans, moderateLoanRequest, revokeUserSessions } from "@/server/services/admin-oversight";
import { clientIp, listAuditLogs, recordAudit } from "@/server/services/audit-log";

const admin = { id: "usr_admin", role: "ADMIN" as const };
const owner = { id: "usr_owner", role: "OWNER" as const };
const NOW = new Date("2026-11-24T06:00:00.000Z");

type Db = Parameters<typeof moderateLoanRequest>[4];
const asDb = (value: unknown) => value as Db;

describe("socialSignupRole", () => {
  it("reads the role cookie the frontend sets before Google sign-up", () => {
    expect(socialSignupRole("theme=dark; sme_signup_role=INVESTOR; other=1")).toBe("INVESTOR");
    expect(socialSignupRole("sme_signup_role=OWNER")).toBe("OWNER");
  });

  it("defaults to OWNER and never accepts ADMIN", () => {
    expect(socialSignupRole(null)).toBe("OWNER");
    expect(socialSignupRole("sme_signup_role=ADMIN")).toBe("OWNER");
    expect(socialSignupRole("sme_signup_role=investor")).toBe("OWNER");
  });
});

describe("clientIp", () => {
  it("takes the first hop from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-vercel-forwarded-for": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("recordAudit", () => {
  it("writes one entry", async () => {
    const create = vi.fn().mockResolvedValue({});
    await recordAudit({ actorId: "u1", action: "auth.sign_in", ipAddress: "1.2.3.4" }, asDb({ auditLog: { create } }));
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "u1", action: "auth.sign_in", ipAddress: "1.2.3.4" }) });
  });

  it("never throws when the write fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(recordAudit({ action: "auth.sign_in" }, asDb({ auditLog: { create } }))).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("listAuditLogs", () => {
  it("is admin only", async () => {
    await expect(listAuditLogs(owner, { limit: 20 }, asDb({}))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("joins actor names and filters by category prefix", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "a1", actorId: "u1", action: "admin.user_suspended", targetType: "USER", targetId: "u2", detail: null, ipAddress: null, createdAt: NOW },
      { id: "a2", actorId: "gone", action: "admin.post_removed", targetType: "POST", targetId: "p1", detail: null, ipAddress: null, createdAt: NOW },
    ]);
    const users = vi.fn().mockResolvedValue([{ id: "u1", name: "Admin", email: "a@example.test", role: "ADMIN" }]);
    const result = await listAuditLogs(admin, { limit: 20, category: "admin." }, asDb({ auditLog: { findMany }, user: { findMany: users } }));
    expect(findMany.mock.calls[0][0].where).toEqual({ action: { startsWith: "admin." } });
    expect(result.items[0].actor?.name).toBe("Admin");
    expect(result.items[1].actor?.name).toBe("Deleted account");
    expect(result.meta.hasMore).toBe(false);
  });
});

describe("moderateLoanRequest", () => {
  function db(status: string) {
    const tx = {
      loanRequest: { update: vi.fn() },
      post: { updateMany: vi.fn() },
      offer: { updateMany: vi.fn() },
      notification: { create: vi.fn() },
    };
    return {
      tx,
      db: asDb({
        loanRequest: { findUnique: vi.fn().mockResolvedValue({ id: "lr1", status, ownerId: "usr_owner", purpose: "Oven" }) },
        $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
      }),
    };
  }

  it("pauses an open request, hides its feed post and notifies the owner", async () => {
    const { db: client, tx } = db("OPEN");
    const result = await moderateLoanRequest(admin, "lr1", "pause", "Documents don't match", client);
    expect(result).toEqual({ id: "lr1", status: "PAUSED", previousStatus: "OPEN" });
    expect(tx.loanRequest.update).toHaveBeenCalledWith({ where: { id: "lr1" }, data: { status: "PAUSED" } });
    expect(tx.post.updateMany).toHaveBeenCalled();
    expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({ userId: "usr_owner", type: "ADMIN_NOTICE", body: "Documents don't match" });
  });

  it("withdraws pending offers when cancelling", async () => {
    const { db: client, tx } = db("IN_DISCUSSION");
    await moderateLoanRequest(admin, "lr1", "cancel", "Fraud report confirmed", client);
    expect(tx.offer.updateMany).toHaveBeenCalledWith({ where: { loanRequestId: "lr1", status: "PENDING" }, data: { status: "WITHDRAWN" } });
  });

  it("refuses to touch funded or repaying requests", async () => {
    await expect(moderateLoanRequest(admin, "lr1", "cancel", "No reason", db("REPAYING").db)).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("is admin only and 404s on unknown ids", async () => {
    await expect(moderateLoanRequest(owner, "lr1", "pause", "reason", db("OPEN").db)).rejects.toBeInstanceOf(ForbiddenError);
    const missing = asDb({ loanRequest: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(moderateLoanRequest(admin, "nope", "pause", "reason", missing)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("revokeUserSessions", () => {
  it("deletes every session of a member", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const client = asDb({ user: { findUnique: vi.fn().mockResolvedValue({ id: "usr_owner", role: "OWNER" }) }, session: { deleteMany } });
    await expect(revokeUserSessions(admin, "usr_owner", client)).resolves.toEqual({ userId: "usr_owner", revokedSessions: 3 });
  });

  it("protects other admins", async () => {
    const client = asDb({ user: { findUnique: vi.fn().mockResolvedValue({ id: "usr_admin2", role: "ADMIN" }) }, session: { deleteMany: vi.fn() } });
    await expect(revokeUserSessions(admin, "usr_admin2", client)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listAdminLoans", () => {
  it("summarises repayment progress", async () => {
    const past = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 86_400_000);
    const client = asDb({
      loan: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "l1", principalBdt: 50000, interestRatePct: "10.50", tenureDays: 90, status: "ACTIVE", startDate: NOW, createdAt: NOW,
            owner: { id: "o", name: "Owner", businessProfile: { shopName: "Shop" } }, investor: { id: "i", name: "Investor" },
            repayments: [{ status: "CONFIRMED", amountBdt: 1, dueDate: past }, { status: "UPCOMING", amountBdt: 1, dueDate: past }, { status: "UPCOMING", amountBdt: 1, dueDate: future }],
          },
        ]),
      },
    });
    const { items } = await listAdminLoans(admin, { limit: 20 }, client);
    expect(items[0]).toMatchObject({ interestRatePct: 10.5, repayments: { total: 3, confirmed: 1, overdue: 1 }, owner: { shopName: "Shop" } });
  });
});

describe("switchOwnRole", () => {
  function client(counts: number[] = [0, 0, 0, 0, 0]) {
    const [b, i, v, l, o] = counts;
    return {
      db: {
        businessProfile: { count: vi.fn().mockResolvedValue(b) },
        investorProfile: { count: vi.fn().mockResolvedValue(i) },
        userVerification: { count: vi.fn().mockResolvedValue(v) },
        loanRequest: { count: vi.fn().mockResolvedValue(l) },
        offer: { count: vi.fn().mockResolvedValue(o) },
        user: { update: vi.fn() },
        auditLog: { create: vi.fn() },
      },
    };
  }

  it("switches an empty account", async () => {
    const { db } = client();
    await expect(switchOwnRole(owner, "INVESTOR", db as never)).resolves.toEqual({ id: "usr_owner", role: "INVESTOR" });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "usr_owner" }, data: { role: "INVESTOR" } });
  });

  it("locks the role once anything exists", async () => {
    const { db } = client([1, 0, 0, 0, 0]);
    await expect(switchOwnRole(owner, "INVESTOR", db as never)).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("never lets anyone become or stop being an admin", async () => {
    await expect(switchOwnRole(owner, "ADMIN", client().db as never)).rejects.toThrow();
    await expect(switchOwnRole(admin, "OWNER", client().db as never)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
