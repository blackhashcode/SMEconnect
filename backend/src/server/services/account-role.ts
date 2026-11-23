import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { BusinessRuleError } from "@/server/errors";
import { signupRoleSchema } from "@/server/validators/enums";
import { recordAudit } from "@/server/services/audit-log";

type Db = typeof prisma;

/**
 * Lets a new member switch between OWNER and INVESTOR before they've created
 * anything (needed for Google sign-ups, which can't carry a role choice when
 * started from the login page). Once a profile, verification, loan request or
 * offer exists the role is fixed.
 */
export async function switchOwnRole(actor: Actor, role: string, db: Db = prisma) {
  assertRole(actor, "OWNER", "INVESTOR");
  const next = signupRoleSchema.parse(role);
  if (next === actor.role) return { id: actor.id, role: next };

  const [business, investor, verifications, loanRequests, offers] = await Promise.all([
    db.businessProfile.count({ where: { ownerId: actor.id } }),
    db.investorProfile.count({ where: { userId: actor.id } }),
    db.userVerification.count({ where: { userId: actor.id } }),
    db.loanRequest.count({ where: { ownerId: actor.id } }),
    db.offer.count({ where: { investorId: actor.id } }),
  ]);
  if (business + investor + verifications + loanRequests + offers > 0) {
    throw new BusinessRuleError("Your account type can't be changed after you've set up a profile");
  }

  await db.user.update({ where: { id: actor.id }, data: { role: next } });
  await recordAudit({ actorId: actor.id, action: "account.role_changed", targetType: "USER", targetId: actor.id, detail: { from: actor.role, to: next } }, db);
  return { id: actor.id, role: next };
}
