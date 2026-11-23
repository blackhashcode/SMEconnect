import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import {
  getVerificationForAdmin,
  reviewVerification,
} from "@/server/services/verification";
import { idSchema } from "@/server/validators/common";
import { reviewVerificationSchema } from "@/server/validators/verification";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { id: rawId } = await params;
    return ok(
      await getVerificationForAdmin(session.user as Actor, idSchema.parse(rawId)),
    );
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const { id: rawId } = await params;
    const verificationId = idSchema.parse(rawId);
    const input = reviewVerificationSchema.parse(await request.json());

    const result = await reviewVerification(session.user as Actor, verificationId, input);
    await recordAudit({ actorId: session.user.id, action: "admin.verification_reviewed", targetType: "VERIFICATION", targetId: verificationId, detail: { status: input.status }, ipAddress: clientIp(request.headers) });
    return ok(result);
  });
}
