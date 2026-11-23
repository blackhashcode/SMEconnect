import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import {
  dismissAdminReport,
  getAdminReport,
  resolveAdminReport,
} from "@/server/services/admin-reports";
import { adminReportDetailSchema } from "@/server/validators/admin";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const admin = { id: "usr_admin", role: "ADMIN" as const };
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };

type Row = Record<string, unknown>;

function reportRow(overrides: Row = {}): Row {
  return {
    id: "rpt_1",
    reporterId: investor.id,
    targetType: "POST",
    targetId: "post_1",
    reason: "Misleading sales proof",
    status: "OPEN",
    resolutionNote: null,
    handledById: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDb(reports: Row[] = [reportRow()]) {
  const rows = reports.map((row) => ({ ...row }));
  const posts: Row[] = [
    {
      id: "post_1",
      authorId: owner.id,
      type: "UPDATE",
      content: "Buy from my shop",
      imageUrls: [],
      deletedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  const comments: Row[] = [
    {
      id: "cmt_1",
      postId: "post_1",
      authorId: owner.id,
      content: "Still available",
      deletedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  const messages: Row[] = [
    {
      id: "msg_1",
      senderId: owner.id,
      conversationId: "con_1",
      body: "Hello",
      deletedAt: null,
      createdAt: NOW,
    },
  ];
  const users: Row[] = [
    {
      id: owner.id,
      name: "Nusrat Akter",
      role: "OWNER",
      status: "ACTIVE",
    },
    {
      id: admin.id,
      name: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  ];

  const db = {
    report: {
      findUnique: vi.fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      ),
      update: vi.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = rows.find((item) => item.id === where.id);
          if (!row) throw new Error("Report missing");
          Object.assign(row, data, { updatedAt: NOW });
          return Promise.resolve({ ...row });
        },
      ),
    },
    user: {
      findUnique: vi.fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(users.find((row) => row.id === where.id) ?? null),
      ),
      update: vi.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = users.find((item) => item.id === where.id);
          if (!row) throw new Error("User missing");
          Object.assign(row, data);
          return Promise.resolve({ ...row });
        },
      ),
    },
    post: {
      findFirst: vi.fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(posts.find((row) => row.id === where.id) ?? null),
      ),
      update: vi.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = posts.find((item) => item.id === where.id);
          if (!row) throw new Error("Post missing");
          Object.assign(row, data);
          return Promise.resolve({ ...row });
        },
      ),
    },
    comment: {
      findFirst: vi.fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(comments.find((row) => row.id === where.id) ?? null),
      ),
      update: vi.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = comments.find((item) => item.id === where.id);
          if (!row) throw new Error("Comment missing");
          Object.assign(row, data);
          return Promise.resolve({ ...row });
        },
      ),
      updateMany: vi.fn().mockImplementation(
        ({ data }: { data: Row }) => {
          for (const row of comments) Object.assign(row, data);
          return Promise.resolve({ count: comments.length });
        },
      ),
    },
    message: {
      findFirst: vi.fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(messages.find((row) => row.id === where.id) ?? null),
      ),
    },
    $transaction: vi.fn().mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    ),
  };

  return {
    db,
    rows,
    posts,
    comments,
    messages,
    users,
  };
}

const deps = (fake: ReturnType<typeof makeDb>) => ({
  db: fake.db as never,
  now: () => NOW,
});

describe("admin report access", () => {
  it("rejects owners and investors for detail, resolve and dismiss", async () => {
    const fake = makeDb();

    for (const actor of [owner, investor]) {
      await expect(
        getAdminReport(actor, "rpt_1", deps(fake)),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        resolveAdminReport(
          actor,
          "rpt_1",
          { resolutionNote: "Reviewed" },
          deps(fake),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        dismissAdminReport(actor, "rpt_1", { resolutionNote: "No issue" }, deps(fake)),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("returns report detail with a minimal target snapshot", async () => {
    const fake = makeDb();
    const result = await getAdminReport(admin, "rpt_1", deps(fake));

    expect(adminReportDetailSchema.parse(result)).toMatchObject({
      id: "rpt_1",
      reporterId: investor.id,
      status: "OPEN",
      target: {
        targetType: "POST",
        targetId: "post_1",
        authorId: owner.id,
        content: "Buy from my shop",
        deletedAt: null,
      },
    });
    expect(result.target).not.toHaveProperty("email");
  });

  it("returns each other target type and null for missing targets", async () => {
    for (const targetType of ["USER", "COMMENT", "MESSAGE"] as const) {
      const targetId =
        targetType === "USER" ? owner.id : targetType === "COMMENT" ? "cmt_1" : "msg_1";
      const fake = makeDb([reportRow({ targetType, targetId })]);
      const result = await getAdminReport(admin, "rpt_1", deps(fake));
      expect(result.target?.targetType).toBe(targetType);
    }

    const missing = makeDb([reportRow({ targetType: "POST", targetId: "post_missing" })]);
    await expect(
      getAdminReport(admin, "rpt_1", deps(missing)),
    ).resolves.toMatchObject({ target: null });
  });

  it("returns 404 for a missing report", async () => {
    const fake = makeDb([]);
    await expect(getAdminReport(admin, "rpt_1", deps(fake))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("admin report resolution", () => {
  it("resolves an open report, recording handler and note", async () => {
    const fake = makeDb();

    const result = await resolveAdminReport(
      admin,
      "rpt_1",
      { resolutionNote: "Seller provided proof" },
      deps(fake),
    );

    expect(result).toMatchObject({
      reportId: "rpt_1",
      status: "RESOLVED",
      moderationAction: "NONE",
      resolutionNote: "Seller provided proof",
      handledById: admin.id,
    });
    expect(fake.rows[0]).toMatchObject({
      status: "RESOLVED",
      resolutionNote: "Seller provided proof",
      handledById: admin.id,
      updatedAt: NOW,
    });
    expect(fake.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("soft-deletes a reported post and its visible comments in one transaction", async () => {
    const fake = makeDb();

    await resolveAdminReport(
      admin,
      "rpt_1",
      { resolutionNote: "Prohibited content", moderationAction: "REMOVE_CONTENT" },
      deps(fake),
    );

    expect(fake.db.$transaction).toHaveBeenCalledTimes(1);
    expect(fake.posts[0].deletedAt).toEqual(NOW);
    expect(fake.comments[0].deletedAt).toEqual(NOW);
    expect(fake.posts[0]).toHaveProperty("content", "Buy from my shop");
    expect(fake.rows[0].status).toBe("RESOLVED");
  });

  it("soft-deletes a reported comment without deleting the row", async () => {
    const fake = makeDb([reportRow({ targetType: "COMMENT", targetId: "cmt_1" })]);

    await resolveAdminReport(
      admin,
      "rpt_1",
      { resolutionNote: "Abusive comment", moderationAction: "REMOVE_CONTENT" },
      deps(fake),
    );

    expect(fake.comments[0].deletedAt).toEqual(NOW);
    expect(fake.comments[0].content).toBe("Still available");
    expect(fake.posts[0].deletedAt).toBeNull();
  });

  it("suspends the reported user and preserves the account", async () => {
    const fake = makeDb([reportRow({ targetType: "USER", targetId: owner.id })]);

    await resolveAdminReport(
      admin,
      "rpt_1",
      { resolutionNote: "Repeated abuse", moderationAction: "SUSPEND_USER" },
      deps(fake),
    );

    expect(fake.users.find((row) => row.id === owner.id)?.status).toBe("SUSPENDED");
    expect(fake.users.find((row) => row.id === owner.id)).toHaveProperty(
      "name",
      "Nusrat Akter",
    );
  });

  it("rejects invalid action/target combinations and unsafe suspensions", async () => {
    for (const [targetType, targetId] of [
      ["POST", "post_1"],
      ["COMMENT", "cmt_1"],
      ["MESSAGE", "msg_1"],
    ] as const) {
      const fake = makeDb([reportRow({ targetType, targetId })]);
      await expect(
        resolveAdminReport(
          admin,
          "rpt_1",
          { resolutionNote: "Suspend them", moderationAction: "SUSPEND_USER" },
          deps(fake),
        ),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    }

    const messageReport = makeDb([reportRow({ targetType: "MESSAGE", targetId: "msg_1" })]);
    await expect(
      resolveAdminReport(
        admin,
        "rpt_1",
        { resolutionNote: "Remove it", moderationAction: "REMOVE_CONTENT" },
        deps(messageReport),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const self = makeDb([reportRow({ targetType: "USER", targetId: admin.id })]);
    await expect(
      resolveAdminReport(
        admin,
        "rpt_1",
        { resolutionNote: "Self report", moderationAction: "SUSPEND_USER" },
        deps(self),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const otherAdminReport = makeDb([
      reportRow({ targetType: "USER", targetId: "usr_other_admin" }),
    ]);
    otherAdminReport.users.push({
      id: "usr_other_admin",
      name: "Admin 2",
      role: "ADMIN",
      status: "ACTIVE",
    });
    await expect(
      resolveAdminReport(
        admin,
        "rpt_1",
        { resolutionNote: "Admin account", moderationAction: "SUSPEND_USER" },
        deps(otherAdminReport),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects repeated moderation and duplicate resolution", async () => {
    const alreadyRemoved = makeDb();
    alreadyRemoved.posts[0].deletedAt = NOW;
    await expect(
      resolveAdminReport(
        admin,
        "rpt_1",
        { resolutionNote: "Remove again", moderationAction: "REMOVE_CONTENT" },
        deps(alreadyRemoved),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    const suspended = makeDb([reportRow({ targetType: "USER", targetId: owner.id })]);
    suspended.users[0].status = "SUSPENDED";
    await expect(
      resolveAdminReport(
        admin,
        "rpt_1",
        { resolutionNote: "Again", moderationAction: "SUSPEND_USER" },
        deps(suspended),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    const resolved = makeDb([reportRow({ status: "RESOLVED" })]);
    await expect(
      resolveAdminReport(admin, "rpt_1", { resolutionNote: "Late" }, deps(resolved)),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("requires a resolution note and rejects unknown input", async () => {
    const fake = makeDb();

    await expect(
      resolveAdminReport(admin, "rpt_1", { resolutionNote: "   " }, deps(fake)),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      resolveAdminReport(
        admin,
        "rpt_1",
        { resolutionNote: "Ok", status: "DISMISSED" } as never,
        deps(fake),
      ),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("admin report dismissal", () => {
  it("dismisses an open report with a required note and audit fields", async () => {
    const fake = makeDb();

    const result = await dismissAdminReport(
      admin,
      "rpt_1",
      { resolutionNote: "False report" },
      deps(fake),
    );

    expect(result).toMatchObject({
      id: "rpt_1",
      status: "DISMISSED",
      resolutionNote: "False report",
      handledById: admin.id,
    });
    expect(fake.rows[0]).toMatchObject({
      status: "DISMISSED",
      handledById: admin.id,
    });
    expect(fake.posts[0].deletedAt).toBeNull();
    expect(fake.users[0].status).toBe("ACTIVE");
  });

  it("rejects empty notes and non-open reports", async () => {
    const fake = makeDb();
    await expect(
      dismissAdminReport(admin, "rpt_1", { resolutionNote: " " }, deps(fake)),
    ).rejects.toBeInstanceOf(ZodError);

    const resolved = makeDb([reportRow({ status: "RESOLVED" })]);
    await expect(
      dismissAdminReport(admin, "rpt_1", { resolutionNote: "Too late" }, deps(resolved)),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
