import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listLoanRepayments } from "@/server/services/admin-oversight";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ loanId: string }>;
}

/** ADMIN: every instalment of a loan. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    return ok(await listLoanRepayments(session.user as Actor, idSchema.parse((await params).loanId)));
  });
}
