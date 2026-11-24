import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { setUserRole } from "@/server/services/admin-oversight";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

const bodySchema = z.object({ role: z.enum(["OWNER", "INVESTOR", "ADMIN"]) }).strict();

/** ADMIN: change a member's role, including granting or removing admin access. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const userId = idSchema.parse((await params).userId);
    const { role } = bodySchema.parse(await request.json());
    const result = await setUserRole(session.user as Actor, userId, role);
    await recordAudit({ actorId: session.user.id, action: role === "ADMIN" ? "admin.role_granted" : "admin.role_changed", targetType: "USER", targetId: userId, detail: { from: result.previousRole, to: role }, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
