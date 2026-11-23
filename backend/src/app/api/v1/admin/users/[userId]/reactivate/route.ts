import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { setAdminUserStatus } from "@/server/services/admin-users";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { userId } = await params;
    const result = await setAdminUserStatus(
        session.user as Actor,
        idSchema.parse(userId),
        "ACTIVE",
      );
    await recordAudit({ actorId: session.user.id, action: "admin.user_reactivated", targetType: "USER", targetId: userId, detail: null, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
