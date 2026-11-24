import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { getLendingHistory } from "@/server/services/lending-history";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/** Signed-in members: a member's lending track record (loans, repayment reliability). */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireSession();
    return ok(await getLendingHistory(session.user as Actor, idSchema.parse((await params).userId)));
  });
}
