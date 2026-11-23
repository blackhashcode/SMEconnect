import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { removeAdminPost } from "@/server/services/admin-moderation";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ postId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { postId } = await params;
    const result = await removeAdminPost(session.user as Actor, idSchema.parse(postId));
    await recordAudit({ actorId: session.user.id, action: "admin.post_removed", targetType: "POST", targetId: postId, detail: null, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
