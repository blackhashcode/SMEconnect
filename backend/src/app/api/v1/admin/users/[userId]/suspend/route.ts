import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { prisma } from "@/server/db";
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
        "SUSPENDED",
      );
    await recordAudit({ actorId: session.user.id, action: "admin.user_suspended", targetType: "USER", targetId: userId, detail: null, ipAddress: clientIp(request.headers) });
    // A suspended member is signed out everywhere straight away.
    await prisma.session.deleteMany({ where: { userId: result.id } });
    return ok(result);
  });
}
