import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getLoanDetail } from "@/server/services/repayments";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ loanId: string }>;
}

/** Full participant-only loan schedule, history and progress. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const { loanId } = await params;
    return ok(await getLoanDetail(session.user as Actor, idSchema.parse(loanId)));
  });
}
