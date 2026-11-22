import { headers } from "next/headers";
import { auth } from "@/server/auth";
import type { Role } from "@/server/auth/roles";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";

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
  const role = (session.user as { role?: Role }).role;

  if (!role || !roles.includes(role)) {
    throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
  }

  return session;
}
