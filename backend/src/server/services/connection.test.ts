import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { encodeCursor } from "@/lib/pagination";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";
import {
  acceptConnection,
  declineConnection,
  listConnections,
  removeConnection,
  sendConnectionRequest,
} from "@/server/services/connection";

type Row = Record<string, unknown>;
const requester = { id: "usr_req", role: "OWNER" as const };
const addressee = { id: "usr_add", role: "INVESTOR" as const };
const stranger = { id: "usr_str", role: "OWNER" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

const publicUser = (id: string, role: "OWNER" | "INVESTOR"): Row => ({
  id,
  name: `User ${id}`,
  image: null,
  role,
  status: "ACTIVE",
  email: "secret@example.com",
  phone: "+8801712345678",
  businessProfile: role === "OWNER"
    ? {
        shopName: "Shop",
        slug: "shop",
        category: "Food",
        district: "Dhaka",
        city: "Dhanmondi",
        logoUrl: null,
        trustScore: 70,
        description: null,
      }
    : null,
  investorProfile:
    role === "INVESTOR"
      ? {
          bio: "Investor",
          minLendBdt: 10_000,
          maxLendBdt: 100_000,
          preferredCategories: ["Food"],
          district: "Dhaka",
          city: null,
          trustScore: 60,
        }
      : null,
});

function connectionRow(overrides: Row = {}): Row {
  return {
    id: "con_1",
    requesterId: requester.id,
    addresseeId: addressee.id,
    status: "PENDING",
    message: "Let's connect",
    createdAt: new Date("2026-11-23T10:00:00.000Z"),
    updatedAt: new Date("2026-11-23T10:00:00.000Z"),
    requester: publicUser(requester.id, "OWNER"),
    addressee: publicUser(addressee.id, "INVESTOR"),
    ...overrides,
  };
}

interface FakeDb {
  user: { findUnique: ReturnType<typeof vi.fn> };
  connection: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  userVerification: { findMany: ReturnType<typeof vi.fn> };
}

function makeDb(): FakeDb {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(publicUser(addressee.id, "INVESTOR")) },
    connection: {
      create: vi.fn().mockResolvedValue({ id: "con_1" }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(connectionRow()),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    userVerification: { findMany: vi.fn().mockResolvedValue([{ userId: addressee.id }]) },
  };
}

let db: FakeDb;
let currentConnection: Row;

beforeEach(() => {
  db = makeDb();
  currentConnection = connectionRow();
  db.user.findUnique.mockImplementation(({ where }: { where: Row }) =>
    Promise.resolve(publicUser(String(where.id), where.id === addressee.id ? "INVESTOR" : "OWNER")),
  );
  db.connection.findUnique.mockImplementation(() => Promise.resolve(currentConnection));
  db.connection.update.mockImplementation(({ data }: { data: Row }) => {
    currentConnection = { ...currentConnection, ...data };
    return Promise.resolve(currentConnection);
  });
});

describe("sendConnectionRequest", () => {
  it("never trusts a client user id and stores the session user as requester", async () => {
    await expect(
      sendConnectionRequest(
        requester,
        { addresseeId: addressee.id, message: "hello" } as never,
        { db: db as never },
      ),
    ).resolves.toMatchObject({ status: "PENDING", direction: "outgoing" });
    expect(db.connection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requesterId: requester.id, addresseeId: addressee.id }),
      }),
    );
  });

  it("rejects self-connections, missing targets and admins", async () => {
    await expect(
      sendConnectionRequest(
        requester,
        { addresseeId: requester.id } as never,
        { db: db as never },
      ),
    ).rejects.toThrow(BusinessRuleError);
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      sendConnectionRequest(requester, { addresseeId: "missing" } as never, { db: db as never }),
    ).rejects.toThrow(NotFoundError);
    db.user.findUnique.mockResolvedValue({
      ...publicUser("usr_admin", "OWNER"),
      role: "ADMIN",
    });
    await expect(
      sendConnectionRequest(requester, { addresseeId: "usr_admin" } as never, { db: db as never }),
    ).rejects.toThrow(NotFoundError);
  });

  it("prevents duplicate and reciprocal pending requests", async () => {
    db.connection.findFirst.mockResolvedValue({ id: "con_existing" });
    await expect(
      sendConnectionRequest(requester, { addresseeId: addressee.id } as never, {
        db: db as never,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects admins and malformed input", async () => {
    await expect(
      sendConnectionRequest(admin, { addresseeId: addressee.id } as never, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      sendConnectionRequest(requester, { addresseeId: "" } as never, { db: db as never }),
    ).rejects.toThrow(ZodError);
  });

  it("does not expose private user data", async () => {
    const result = await sendConnectionRequest(
      requester,
      { addresseeId: addressee.id } as never,
      { db: db as never },
    );
    expect(result.user).not.toHaveProperty("email");
    expect(result.user).not.toHaveProperty("phone");
    expect(result.user).not.toHaveProperty("id");
  });
});

describe("connection state machine", () => {
  it("lets only the addressee accept a pending request", async () => {
    await expect(
      acceptConnection(stranger, "con_1", { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      acceptConnection(addressee, "con_1", { db: db as never }),
    ).resolves.toMatchObject({ status: "ACCEPTED", direction: "incoming" });
    expect(db.connection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACCEPTED" } }),
    );
  });

  it("lets only the addressee decline a pending request", async () => {
    await expect(
      declineConnection(requester, "con_1", { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      declineConnection(addressee, "con_1", { db: db as never }),
    ).resolves.toMatchObject({ status: "DECLINED" });
  });

  it("rejects responses to non-pending connections", async () => {
    db.connection.findUnique.mockResolvedValue(connectionRow({ status: "ACCEPTED" }));
    await expect(
      acceptConnection(addressee, "con_1", { db: db as never }),
    ).rejects.toThrow(ConflictError);
    await expect(
      declineConnection(addressee, "con_1", { db: db as never }),
    ).rejects.toThrow(ConflictError);
  });

  it("allows the requester to cancel pending and either party to remove accepted", async () => {
    await expect(removeConnection(requester, "con_1", { db: db as never })).resolves.toMatchObject({
      status: "PENDING",
    });
    expect(db.connection.delete).toHaveBeenCalledWith({ where: { id: "con_1" } });

    db.connection.findUnique.mockResolvedValue(connectionRow({ status: "ACCEPTED" }));
    await expect(removeConnection(addressee, "con_1", { db: db as never })).resolves.toMatchObject({
      status: "ACCEPTED",
    });
    await expect(removeConnection(stranger, "con_1", { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("rejects cancelling another user's pending request and modifying declined ones", async () => {
    await expect(removeConnection(addressee, "con_1", { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
    db.connection.findUnique.mockResolvedValue(connectionRow({ status: "DECLINED" }));
    await expect(removeConnection(requester, "con_1", { db: db as never })).rejects.toThrow(
      ConflictError,
    );
  });

  it("returns not found for a missing connection", async () => {
    db.connection.findUnique.mockResolvedValue(null);
    await expect(acceptConnection(addressee, "missing", { db: db as never })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("listConnections", () => {
  it("filters by direction and status with cursor pagination", async () => {
    const rows = [connectionRow(), connectionRow({ id: "con_2" }), connectionRow({ id: "con_3" })];
    db.connection.findMany.mockResolvedValue(rows);

    const page = await listConnections(
      requester,
      { limit: 2, direction: "incoming", status: "PENDING" },
      { db: db as never },
    );
    expect(page.items).toHaveLength(2);
    expect(page.meta.nextCursor).toBe(encodeCursor({ id: "con_2" }));
    expect(db.connection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          addresseeId: requester.id,
          status: "PENDING",
        }),
        take: 3,
      }),
    );
  });

  it("rejects a malformed cursor", async () => {
    await expect(
      listConnections(
        requester,
        { limit: 20, cursor: encodeCursor({ wrong: true }) },
        { db: db as never },
      ),
    ).rejects.toThrow(ValidationError);
  });
});
