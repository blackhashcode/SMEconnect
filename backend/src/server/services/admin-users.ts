import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import { idSchema } from "@/server/validators/common";
import {
  adminUserListQuerySchema,
  type adminUserDetailSchema,
  type adminUserRecordSchema,
} from "@/server/validators/admin";
import type { z } from "zod";
import { cursorId, pageMeta } from "@/server/services/social-shared";

type Db = typeof prisma;
type UserRecord = z.infer<typeof adminUserRecordSchema>;
type UserDetail = z.infer<typeof adminUserDetailSchema>;

interface ServiceDeps {
  db?: Db;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "INVESTOR" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: Date;
  updatedAt: Date;
  businessProfile?: { trustScore: number } | null;
  investorProfile?: { trustScore: number } | null;
}

interface VerificationRow {
  id: string;
  type: "OWNER" | "INVESTOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewerId: string | null;
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  businessProfile: { select: { trustScore: true } },
  investorProfile: { select: { trustScore: true } },
} as const;

function toUserRecord(
  row: UserRow,
  verificationStatus: UserRecord["verificationStatus"],
): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    verificationStatus,
    trustScore:
      row.businessProfile?.trustScore ?? row.investorProfile?.trustScore ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toVerificationSummary(row: VerificationRow) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewerId: row.reviewerId,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    idDocumentUrl: row.idDocumentUrl,
    salesProofUrls: row.salesProofUrls,
    shopLinks: row.shopLinks,
  };
}

/** ADMIN-only user directory. Verification states are fetched in one batch. */
export async function listAdminUsers(
  actor: Actor,
  query: PaginationParams & { status?: string; role?: string; q?: string },
  deps: ServiceDeps = {},
) {
  assertRole(actor, "ADMIN");
  const parsed = adminUserListQuerySchema.parse({
    status: query.status,
    role: query.role,
    q: query.q,
  });
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const rows = (await db.user.findMany({
    where: {
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.role ? { role: parsed.role } : {}),
      ...(parsed.q
        ? {
            OR: [
              { name: { contains: parsed.q, mode: "insensitive" as const } },
              { email: { contains: parsed.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: USER_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })) as UserRow[];

  const page = pageMeta(rows, query.limit);
  const ids = page.items.map((row) => row.id);
  const verifications = (await db.userVerification.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, type: true, status: true },
  })) as Array<{ userId: string; type: "OWNER" | "INVESTOR"; status: "PENDING" | "APPROVED" | "REJECTED" }>;

  const byUser = new Map<string, Array<(typeof verifications)[number]>>();
  for (const record of verifications) {
    const list = byUser.get(record.userId) ?? [];
    list.push(record);
    byUser.set(record.userId, list);
  }

  return {
    items: page.items.map((row) => {
      const ownType = row.role === "INVESTOR" ? "INVESTOR" : "OWNER";
      const record = (byUser.get(row.id) ?? []).find(
        (item) => item.type === ownType,
      );
      return toUserRecord(row, record?.status ?? null);
    }),
    meta: page.meta,
  };
}

/** ADMIN-only account detail, including private verification documents. */
export async function getAdminUser(
  actor: Actor,
  userId: string,
  deps: ServiceDeps = {},
): Promise<UserDetail> {
  assertRole(actor, "ADMIN");
  const id = idSchema.parse(userId);
  const db = deps.db ?? prisma;

  const row = (await db.user.findUnique({
    where: { id },
    select: USER_SELECT,
  })) as UserRow | null;
  if (!row) throw new NotFoundError("User not found");

  const [verifications, openReports] = await Promise.all([
    db.userVerification.findMany({
      where: { userId: id },
      orderBy: { submittedAt: "desc" },
    }) as Promise<VerificationRow[]>,
    db.report.count({
      where: { targetType: "USER", targetId: id, status: "OPEN" },
    }),
  ]);

  const record = verifications.find(
    (item) => item.type === (row.role === "INVESTOR" ? "INVESTOR" : "OWNER"),
  );

  return {
    ...toUserRecord(row, record?.status ?? null),
    verifications: verifications.map(toVerificationSummary),
    openReportsAgainst: openReports,
  };
}

/** Suspends or reactivates an account; admins and the actor are protected. */
export async function setAdminUserStatus(
  actor: Actor,
  userId: string,
  status: "SUSPENDED" | "ACTIVE",
  deps: ServiceDeps = {},
) {
  assertRole(actor, "ADMIN");
  const id = idSchema.parse(userId);
  if (id === actor.id) {
    throw new BusinessRuleError("You cannot change your own account status");
  }
  const db = deps.db ?? prisma;

  const target = (await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true },
  })) as { id: string; role: string; status: "ACTIVE" | "SUSPENDED" } | null;
  if (!target) throw new NotFoundError("User not found");
  if (target.role === "ADMIN") {
    throw new ForbiddenError("Administrator accounts cannot be moderated");
  }
  if (target.status === status) {
    throw new ConflictError("The account is already in that state");
  }

  const updated = (await db.user.update({
    where: { id },
    data: { status },
    select: { id: true, status: true, updatedAt: true },
  })) as { id: string; status: "ACTIVE" | "SUSPENDED"; updatedAt: Date };

  return {
    id: updated.id,
    status: updated.status,
    changedAt: updated.updatedAt.toISOString(),
  };
}
