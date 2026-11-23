import { assertVerified, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import {
  PUBLIC_USER_SELECT,
  toPostAuthor,
  verifiedUserIds,
  type PublicUserRow,
} from "@/server/services/social-shared";

type Db = typeof prisma;

/** Public, role-safe card used for both loan parties in offer/agreement responses. */
export function offerPartyFromUser(user: PublicUserRow, verified: boolean) {
  return { id: user.id, ...toPostAuthor(user, verified) };
}

export type OfferParty = ReturnType<typeof offerPartyFromUser>;

/** Batch-loads public party cards; no email, phone, NID or document is ever selected. */
export async function loadOfferParties(
  ids: string[],
  db: Pick<Db, "user" | "userVerification">,
): Promise<Map<string, OfferParty>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const [users, verified] = await Promise.all([
    db.user.findMany({ where: { id: { in: uniqueIds } }, select: PUBLIC_USER_SELECT }),
    verifiedUserIds(uniqueIds, db),
  ]);

  const parties = new Map<string, OfferParty>();
  for (const user of users as PublicUserRow[]) {
    parties.set(user.id, offerPartyFromUser(user, verified.has(user.id)));
  }
  for (const id of uniqueIds) {
    if (!parties.has(id)) throw new NotFoundError("Loan participant not found");
  }
  return parties;
}

/** Being logged in is not enough: the actor's own role verification must be APPROVED. */
export async function assertLendingActorVerified(actor: Actor, db: Db): Promise<void> {
  if (actor.role !== "OWNER" && actor.role !== "INVESTOR") {
    throw new ForbiddenError("Only owners and investors can use lending features");
  }
  const verification = await db.userVerification.findFirst({
    where: { userId: actor.id, type: actor.role, status: "APPROVED" },
    select: { status: true },
  });
  assertVerified(actor, verification?.status);
}

export function assertRequestOpenForOffers(status: string): void {
  if (status !== "OPEN" && status !== "IN_DISCUSSION") {
    throw new ConflictError(`Cannot create or respond to offers on a ${status} loan request`);
  }
}

export function isOfferExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function toIso(date: Date): string {
  return date.toISOString();
}
