import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { revokeUserSessions } from "@/server/services/admin-oversight";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/** ADMIN: sign a member out of every device. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const userId = idSchema.parse((await params).userId);
    const result = await revokeUserSessions(session.user as Actor, userId);
    await recordAudit({ actorId: session.user.id, action: "admin.sessions_revoked", targetType: "USER", targetId: userId, detail: { count: result.revokedSessions }, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
