import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { confirmAgreement } from "@/server/services/agreements";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ agreementId: string }>;
}

/** One confirmation per party; the second activates the loan in one transaction. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { agreementId } = await params;
    return ok(await confirmAgreement(session.user as Actor, idSchema.parse(agreementId)));
  });
}
