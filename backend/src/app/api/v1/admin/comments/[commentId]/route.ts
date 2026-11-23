import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { removeAdminComment } from "@/server/services/admin-moderation";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ commentId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { commentId } = await params;
    const result = await removeAdminComment(session.user as Actor, idSchema.parse(commentId));
    await recordAudit({ actorId: session.user.id, action: "admin.comment_removed", targetType: "COMMENT", targetId: commentId, detail: null, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
