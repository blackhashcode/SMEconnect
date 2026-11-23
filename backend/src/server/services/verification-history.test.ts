import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ForbiddenError } from "@/server/errors";
import { listSubmissions, recordReview, recordSubmission } from "@/server/services/verification-history";

type Db = Parameters<typeof listSubmissions>[2];
const asDb = (value: unknown) => value as Db;
const NOW = new Date("2026-11-24T06:00:00.000Z");

describe("verification history", () => {
  it("stores each submission with its exact documents", async () => {
    const create = vi.fn();
    await recordSubmission("u1", { id: "v1", type: "OWNER", idDocumentUrl: "/api/v1/files/private/a.jpg", salesProofUrls: ["/api/v1/files/private/b.pdf"], shopLinks: [], submittedAt: NOW.toISOString() }, asDb({ verificationSubmission: { create } }));
    expect(create.mock.calls[0][0].data).toMatchObject({ verificationId: "v1", userId: "u1", idDocumentUrl: "/api/v1/files/private/a.jpg", salesProofUrls: ["/api/v1/files/private/b.pdf"] });
  });

  it("stamps the review on the newest pending submission only", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "s2" });
    const update = vi.fn();
    await recordReview("v1", { status: "REJECTED", reviewerId: "admin", reviewNote: "Blurry photo" }, asDb({ verificationSubmission: { findFirst, update } }));
    expect(findFirst.mock.calls[0][0]).toMatchObject({ where: { verificationId: "v1", status: "PENDING" }, orderBy: { submittedAt: "desc" } });
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: "s2" }, data: { status: "REJECTED", reviewerId: "admin", reviewNote: "Blurry photo" } });
  });

  it("does nothing when there is no pending submission", async () => {
    const update = vi.fn();
    await recordReview("v1", { status: "APPROVED", reviewerId: "admin" }, asDb({ verificationSubmission: { findFirst: vi.fn().mockResolvedValue(null), update } }));
    expect(update).not.toHaveBeenCalled();
  });

  it("lists every submission for admins, with reviewer names", async () => {
    const rows = [
      { id: "s2", verificationId: "v1", type: "OWNER", status: "APPROVED", idDocumentUrl: "/x2.jpg", salesProofUrls: [], shopLinks: [], submittedAt: NOW, reviewedAt: NOW, reviewNote: null, reviewerId: "a1" },
      { id: "s1", verificationId: "v1", type: "OWNER", status: "REJECTED", idDocumentUrl: "/x1.jpg", salesProofUrls: [], shopLinks: [], submittedAt: NOW, reviewedAt: NOW, reviewNote: "Blurry", reviewerId: "gone" },
    ];
    const db = asDb({ verificationSubmission: { findMany: vi.fn().mockResolvedValue(rows) }, user: { findMany: vi.fn().mockResolvedValue([{ id: "a1", name: "Admin One" }]) } });
    const list = await listSubmissions({ id: "a1", role: "ADMIN" }, "u1", db);
    expect(list.map((s) => s.idDocumentUrl)).toEqual(["/x2.jpg", "/x1.jpg"]);
    expect(list[0].reviewer?.name).toBe("Admin One");
    expect(list[1].reviewer?.name).toBe("Former admin");
  });

  it("is admin only", async () => {
    await expect(listSubmissions({ id: "u1", role: "OWNER" }, "u1", asDb({}))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
