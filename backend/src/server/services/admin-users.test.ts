import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import {
  getAdminUser,
  listAdminUsers,
  setAdminUserStatus,
} from "@/server/services/admin-users";
import { adminUserListQuerySchema } from "@/server/validators/admin";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const admin = { id: "usr_admin", role: "ADMIN" as const };
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };

type Row = Record<string, unknown>;

function userRow(overrides: Row = {}): Row {
  return {
    id: owner.id,
    name: "Nusrat Akter",
    email: "nusrat@example.test",
    role: "OWNER",
    status: "ACTIVE",
    createdAt: NOW,
    updatedAt: NOW,
    businessProfile: { trustScore: 82 },
    investorProfile: null,
    ...overrides,
  };
}

function verificationRow(overrides: Row = {}): Row {
  return {
    id: "ver_123",
    type: "OWNER",
    status: "APPROVED",
    reviewerId: admin.id,
    reviewNote: "Documents checked",
    submittedAt: NOW,
    reviewedAt: NOW,
    idDocumentUrl: "/api/v1/files/private/id.pdf",
    salesProofUrls: ["/api/v1/files/private/sales.jpg"],
    shopLinks: ["https://www.facebook.com/shop/example"],
    ...overrides,
  };
}

function makeDb(users: Row[] = [], verifications: Row[] = []) {
  const rows = users.map((row) => ({ ...row }));
  const reports = { count: vi.fn().mockResolvedValue(0) };

  const db = {
    user: {
      findMany: vi.fn().mockImplementation(
        ({ where, take }: { where: Row; take: number }) =>
          Promise.resolve(
            rows
              .filter((row) =>
                Object.entries(where).every(([key, value]) => row[key] === value),
              )
              .slice(0, take),
          ),
      ),
      findUnique: vi.fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      ),
      update: vi.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = rows.find((item) => item.id === where.id);
          if (!row) throw new Error("User missing");
          Object.assign(row, data, { updatedAt: NOW });
          return Promise.resolve({ ...row });
        },
      ),
    },
    userVerification: {
      findMany: vi.fn().mockImplementation(
        ({ where }: { where: { userId: string | { in: string[] } } }) => {
          const ids =
            typeof where.userId === "string" ? [where.userId] : where.userId.in;
          return Promise.resolve(
            verifications.filter((row) => ids.includes(row.userId as string)),
          );
        },
      ),
    },
    report: reports,
  };

  return { db, rows, reports };
}

const deps = (fake: ReturnType<typeof makeDb>) => ({ db: fake.db as never });

describe("admin user directory", () => {
  it("is ADMIN-only", async () => {
    const fake = makeDb();

    await expect(
      listAdminUsers(owner, { limit: 20 }, deps(fake)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      listAdminUsers(investor, { limit: 20 }, deps(fake)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      getAdminUser(owner, owner.id, deps(fake)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setAdminUserStatus(investor, owner.id, "SUSPENDED", deps(fake)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists users with approved verification states and trusted-only fields", async () => {
    const fake = makeDb(
      [userRow(), userRow({ id: investor.id, role: "INVESTOR", email: "tanvir@example.test", businessProfile: null, investorProfile: { trustScore: 71 } })],
      [verificationRow({
        userId: owner.id,
        ...{},
      }), verificationRow({
        userId: investor.id,
        type: "INVESTOR",
        id: "ver_456",
        status: "PENDING",
      })],
    );

    const result = await listAdminUsers(
      admin,
      { limit: 20, role: "OWNER", status: "ACTIVE" },
      deps(fake),
    );

    expect(adminUserListQuerySchema.parse({ role: "OWNER", status: "ACTIVE" })).toEqual({
      role: "OWNER",
      status: "ACTIVE",
    });
    expect(fake.db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: "OWNER", status: "ACTIVE" } }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        id: owner.id,
        role: "OWNER",
        status: "ACTIVE",
        verificationStatus: "APPROVED",
        trustScore: 82,
        createdAt: NOW.toISOString(),
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty("password");
  });

  it("returns private verification history and open report count in detail", async () => {
    const fake = makeDb([userRow()], [verificationRow({ userId: owner.id })]);
    fake.reports.count.mockResolvedValue(2);

    const result = await getAdminUser(admin, owner.id, deps(fake));

    expect(result).toMatchObject({
      id: owner.id,
      email: "nusrat@example.test",
      verificationStatus: "APPROVED",
      openReportsAgainst: 2,
      verifications: [
        expect.objectContaining({
          id: "ver_123",
          reviewerId: admin.id,
          idDocumentUrl: "/api/v1/files/private/id.pdf",
        }),
      ],
    });
  });

  it("returns 404 for a missing user", async () => {
    const fake = makeDb();
    await expect(getAdminUser(admin, "usr_missing", deps(fake))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("admin user status changes", () => {
  it("suspends and reactivates a user through the existing status field", async () => {
    const fake = makeDb([userRow()]);

    await expect(
      setAdminUserStatus(admin, owner.id, "SUSPENDED", deps(fake)),
    ).resolves.toEqual({
      id: owner.id,
      status: "SUSPENDED",
      changedAt: NOW.toISOString(),
    });
    expect(fake.db.user.update).toHaveBeenCalledWith({
      where: { id: owner.id },
      data: { status: "SUSPENDED" },
      select: { id: true, status: true, updatedAt: true },
    });

    await expect(
      setAdminUserStatus(admin, owner.id, "ACTIVE", deps(fake)),
    ).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("protects self and returns 404 for a missing account", async () => {
    const fake = makeDb([userRow()]);

    await expect(
      setAdminUserStatus(admin, admin.id, "SUSPENDED", deps(fake)),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    await expect(
      setAdminUserStatus(admin, "usr_missing", "SUSPENDED", deps(fake)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects suspending another admin, repeats, and self-suspension", async () => {
    const otherAdmin = makeDb([
      userRow({ id: "usr_admin2", role: "ADMIN", email: "admin2@example.test" }),
      userRow({ id: owner.id, status: "SUSPENDED" }),
    ]);

    await expect(
      setAdminUserStatus(admin, "usr_admin2", "SUSPENDED", deps(otherAdmin)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setAdminUserStatus(admin, owner.id, "SUSPENDED", deps(otherAdmin)),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
