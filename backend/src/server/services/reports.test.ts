import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { encodeCursor } from "@/lib/pagination";
import { createReport, listReports } from "@/server/services/reports";
import { reportRecordSchema } from "@/server/validators/social";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const reporter = { id: "usr_me", role: "OWNER" as const };
const other = { id: "usr_other", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

type Row = Record<string, unknown>;

function reportRow(overrides: Row = {}): Row {
  return {
    id: "rpt_1",
    reporterId: reporter.id,
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

function makeDb(initial: Row[] = []) {
  const rows = [...initial];
  let sequence = rows.length;
  const targets = {
    user: { id: "usr_target" },
    post: { id: "post_1" },
    comment: { id: "cmt_1" },
    message: { id: "msg_1" },
  };

  const db = {
    user: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(
          where.id === targets.user.id
            ? { id: targets.user.id, role: "INVESTOR", status: "ACTIVE", email: "private@example.test" }
            : null,
        ),
      ),
    },
    post: {
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(
          where.id === targets.post.id && where.deletedAt === null ? targets.post : null,
        ),
      ),
    },
    comment: {
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(
          where.id === targets.comment.id && where.deletedAt === null ? targets.comment : null,
        ),
      ),
    },
    message: {
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(
          where.id === targets.message.id && where.deletedAt === null ? targets.message : null,
        ),
      ),
    },
    report: {
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(
          rows.find((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          ) ?? null,
        ),
      ),
      findMany: vi.fn().mockImplementation(
        ({ where, take, cursor, skip }: Row) => {
          const filtered = rows.filter((row) =>
            Object.entries(where as Row).every(([key, value]) => row[key] === value),
          );
          const index = cursor ? filtered.findIndex((row) => row.id === (cursor as Row).id) : -1;
          const start = index >= 0 ? index + Number(skip ?? 1) : 0;
          return Promise.resolve(filtered.slice(start, start + Number(take ?? filtered.length)));
        },
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Row }) => {
        const row = reportRow({ id: `rpt_${++sequence}`, ...data, status: "OPEN" });
        rows.push(row);
        return Promise.resolve(row);
      }),
    },
  };
  return { db, rows, targets };
}

const deps = (db: ReturnType<typeof makeDb>["db"]) => ({ db: db as never });

describe("createReport", () => {
  it("creates an OPEN report with the session user as reporter", async () => {
    const { db } = makeDb();
    const result = await createReport(
      reporter as never,
      { targetType: "POST", targetId: "post_1", reason: "  Misleading sales proof  " },
      deps(db),
    );

    expect(db.report.create).toHaveBeenCalledWith({
      data: {
        reporterId: reporter.id,
        targetType: "POST",
        targetId: "post_1",
        reason: "Misleading sales proof",
        status: "OPEN",
      },
    });
    expect(reportRecordSchema.parse(result)).toMatchObject({
      reporterId: reporter.id,
      status: "OPEN",
    });
  });

  it("accepts all four target types and rejects missing/deleted targets", async () => {
    const { db } = makeDb();
    for (const [targetType, targetId] of [
      ["USER", "usr_target"],
      ["POST", "post_1"],
      ["COMMENT", "cmt_1"],
      ["MESSAGE", "msg_1"],
    ] as const) {
      await expect(
        createReport(reporter as never, { targetType, targetId, reason: "Spam" }, deps(db)),
      ).resolves.toMatchObject({ targetType, targetId });
    }

    await expect(
      createReport(reporter as never, { targetType: "POST", targetId: "missing", reason: "Spam" }, deps(db)),
    ).rejects.toBeInstanceOf(NotFoundError);
    db.post.findFirst.mockResolvedValueOnce(null);
    await expect(
      createReport(reporter as never, { targetType: "POST", targetId: "post_1", reason: "Spam" }, deps(db)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects duplicate open reports, invalid input and unauthorized roles", async () => {
    const duplicate = makeDb([reportRow()]);
    await expect(
      createReport(
        reporter as never,
        { targetType: "POST", targetId: "post_1", reason: "Again" },
        deps(duplicate.db),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    const { db } = makeDb();
    db.report.findFirst.mockResolvedValue(null);
    db.report.create.mockRejectedValueOnce({ code: "P2002" });
    await expect(
      createReport(
        reporter as never,
        { targetType: "POST", targetId: "post_1", reason: "Again" },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      createReport(
        reporter as never,
        { targetType: "POST", targetId: "post_1", reason: "" },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      createReport(
        admin as never,
        { targetType: "POST", targetId: "post_1", reason: "Spam" },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listReports", () => {
  it("scopes reporters to their own reports and admins to the full queue", async () => {
    const { db } = makeDb([
      reportRow(),
      reportRow({ id: "rpt_2", reporterId: other.id, status: "RESOLVED" }),
    ]);

    const own = await listReports(reporter as never, { limit: 20 }, deps(db));
    expect(own.items).toHaveLength(1);
    expect(db.report.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { reporterId: reporter.id }, take: 21 }),
    );
    expect(own.items.every((item) => reportRecordSchema.safeParse(item).success)).toBe(true);

    const all = await listReports(admin as never, { limit: 20 }, deps(db));
    expect(all.items).toHaveLength(2);
    expect(db.report.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {}, take: 21 }),
    );

    const filtered = await listReports(admin as never, { limit: 20, status: "RESOLVED" }, deps(db));
    expect(filtered.items.map((item) => item.id)).toEqual(["rpt_2"]);
    expect(db.report.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: "RESOLVED" } }),
    );

    await expect(listReports(admin as never, { limit: 20, status: "INVALID" }, deps(db))).rejects.toBeInstanceOf(ZodError);
  });

  it("paginates with a cursor and rejects unsupported roles", async () => {
    const { db } = makeDb([
      reportRow(),
      reportRow({ id: "rpt_2" }),
      reportRow({ id: "rpt_3" }),
    ]);

    const first = await listReports(reporter as never, { limit: 2 }, deps(db));
    expect(first.items.map((item) => item.id)).toEqual(["rpt_1", "rpt_2"]);
    expect(first.meta).toMatchObject({ hasMore: true });
    expect(first.meta.nextCursor).toBe(encodeCursor({ id: "rpt_2" }));

    const second = await listReports(
      reporter as never,
      { limit: 2, cursor: first.meta.nextCursor! },
      deps(db),
    );
    expect(second.items.map((item) => item.id)).toEqual(["rpt_3"]);
    expect(second.meta.nextCursor).toBeNull();

    await expect(
      listReports({ id: "usr_x", role: "SYSTEM" } as never, { limit: 20 }, deps(db)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
