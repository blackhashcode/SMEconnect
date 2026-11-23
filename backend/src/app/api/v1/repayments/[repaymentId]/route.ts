import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getRepayment } from "@/server/services/repayments";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ repaymentId: string }>;
}

/** Repayment detail for either loan participant only. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { repaymentId } = await params;
    return ok(await getRepayment(session.user as Actor, idSchema.parse(repaymentId)));
  });
}
