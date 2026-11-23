import type { Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";

interface PrivateFileDeps {
  db?: typeof prisma;
}

/**
 * A private file is readable only by the verification owner it is attached to,
 * or by an admin. Randomized URLs are not treated as authorization.
 */
export async function canAccessPrivateFile(
  url: string,
  actor: Actor,
  deps: PrivateFileDeps = {},
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "OWNER" && actor.role !== "INVESTOR") return false;

  const db = deps.db ?? prisma;
  const record = await db.userVerification.findFirst({
    where: {
      userId: actor.id,
      OR: [{ idDocumentUrl: url }, { salesProofUrls: { has: url } }],
    },
    select: { id: true },
  });

  return record !== null;
}
