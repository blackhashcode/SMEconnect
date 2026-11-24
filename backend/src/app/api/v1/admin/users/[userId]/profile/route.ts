import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { updateMe } from "@/server/services/profile";
import { idSchema } from "@/server/validators/common";
import { updateMeSchema } from "@/server/validators/profile";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * ADMIN: edit any member's name, photo or profile. Runs the member's own update
 * with the same validation, so admin edits can't create invalid records.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const userId = idSchema.parse((await params).userId);
    const input = updateMeSchema.parse(await request.json());
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
    if (!target || target.role === "ADMIN") throw new NotFoundError("Member not found");
    const result = await updateMe({ id: target.id, role: target.role, status: target.status } as Actor, input);
    const fields = [...Object.keys(input.profile ?? {}), ...(input.name ? ["name"] : []), ...(input.image !== undefined ? ["image"] : [])];
    await recordAudit({ actorId: session.user.id, action: "admin.profile_edited", targetType: "USER", targetId: userId, detail: { fields }, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
