import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getAgreement } from "@/server/services/agreements";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ agreementId: string }>;
}

/** Terms, both parties and a schedule preview — participants only. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { agreementId } = await params;
    return ok(await getAgreement(session.user as Actor, idSchema.parse(agreementId)));
  });
}
