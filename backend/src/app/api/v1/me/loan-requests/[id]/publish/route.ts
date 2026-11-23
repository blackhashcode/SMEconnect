import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { publishLoanRequest } from "@/server/services/loan-request";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** DRAFT → OPEN (APPROVED verification + complete profile required). */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const { id: rawId } = await params;
    const result = await publishLoanRequest(session.user as Actor, idSchema.parse(rawId));
    await recordAudit({ actorId: session.user.id, action: "loan_request.published", targetType: "LOAN_REQUEST", targetId: rawId, detail: null, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
