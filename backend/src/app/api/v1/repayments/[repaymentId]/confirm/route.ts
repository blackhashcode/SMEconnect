import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { confirmRepayment } from "@/server/services/repayments";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ repaymentId: string }>;
}

/** Investor confirms receipt; no client-authored confirmation identity or status. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("INVESTOR");
    const { repaymentId } = await params;
    return ok(await confirmRepayment(session.user as Actor, idSchema.parse(repaymentId)));
  });
}
