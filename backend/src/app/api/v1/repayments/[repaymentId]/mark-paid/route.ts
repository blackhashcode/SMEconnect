import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { markRepaymentPaid } from "@/server/services/repayments";
import { idSchema } from "@/server/validators/common";
import { markRepaymentPaidSchema } from "@/server/validators/repayment";

interface RouteContext {
  params: Promise<{ repaymentId: string }>;
}

/** Owner marks an installment paid; identity, status and amounts are server-owned. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER");
    const { repaymentId } = await params;
    const input = markRepaymentPaidSchema.parse(await request.json());
    return ok(
      await markRepaymentPaid(session.user as Actor, idSchema.parse(repaymentId), input),
    );
  });
}
