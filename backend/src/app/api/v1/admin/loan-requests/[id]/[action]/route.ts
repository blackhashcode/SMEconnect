import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { moderateLoanRequest } from "@/server/services/admin-oversight";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string; action: string }>;
}

const actionSchema = z.enum(["pause", "resume", "cancel", "reopen"]);
const bodySchema = z.object({ reason: z.string().trim().min(5).max(500) }).strict();

/** ADMIN: pause, resume or cancel a loan request. The owner is notified with the reason. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { id: rawId, action: rawAction } = await params;
    const id = idSchema.parse(rawId);
    const action = actionSchema.parse(rawAction);
    const { reason } = bodySchema.parse(await request.json());
    const result = await moderateLoanRequest(session.user as Actor, id, action, reason);
    await recordAudit({ actorId: session.user.id, action: `admin.loan_request_${action === "resume" || action === "reopen" ? "resumed" : action === "pause" ? "paused" : "cancelled"}`, targetType: "LOAN_REQUEST", targetId: id, detail: { reason, from: result.previousStatus }, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
