import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  assertOwnership,
  assertRole,
  assertVerified,
  verificationTypeForRole,
  type Actor,
} from "@/server/auth/policy";
import type { Role } from "@/server/auth/roles";
import { prisma } from "@/server/db";
import { UnauthorizedError } from "@/server/errors";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  assertRole(session.user as Actor, ...roles);
  return session;
}

/**
 * Verifies that the authenticated user owns the resource. Admin bypass is
 * opt-in so ownership checks stay explicit at every call site.
 */
export async function requireOwnership(
  resourceOwnerId: string,
  options: { allowAdmin?: boolean } = {},
) {
  const session = await requireSession();
  assertOwnership(resourceOwnerId, session.user as Actor, options);
  return session;
}

/**
 * Gates an action on an APPROVED verification for the actor's role. Business
 * logic must use this (or assertVerified) rather than trusting a client flag.
 */
export async function requireVerifiedUser(...roles: Role[]) {
  const session = roles.length > 0 ? await requireRole(...roles) : await requireSession();
  const actor = session.user as Actor;
  const type = verificationTypeForRole(actor.role);

  const record = await prisma.userVerification.findFirst({
    where: { userId: actor.id, type, status: "APPROVED" },
    select: { id: true },
  });

  assertVerified(actor, record ? "APPROVED" : null);
  return session;
}
