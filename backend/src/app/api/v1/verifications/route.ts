import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { recordSubmission } from "@/server/services/verification-history";
import { submitVerification } from "@/server/services/verification";
import { submitVerificationSchema } from "@/server/validators/verification";

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const input = submitVerificationSchema.parse(await request.json());

    const result = await submitVerification(session.user as Actor, input);
    // Keep this exact set of documents in the permanent history before logging it.
    await recordSubmission(session.user.id, result);
    await recordAudit({ actorId: session.user.id, action: "verification.submitted", targetType: "VERIFICATION", targetId: result.id, detail: { documents: 1 + result.salesProofUrls.length }, ipAddress: clientIp(request.headers) });
    return created(result);
  });
}
