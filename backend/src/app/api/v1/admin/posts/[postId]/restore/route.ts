import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { restorePost } from "@/server/services/admin-oversight";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ postId: string }>;
}

/** ADMIN: bring back a removed post. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const id = idSchema.parse((await params).postId);
    const result = await restorePost(session.user as Actor, id);
    await recordAudit({ actorId: session.user.id, action: "admin.post_restored", targetType: "POST", targetId: id, detail: null, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
