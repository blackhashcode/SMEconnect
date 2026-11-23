import { parsePagination } from "@/lib/pagination";
import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listRepaymentsForActor } from "@/server/services/repayments";
import { repaymentListQuerySchema } from "@/server/validators/repayment";

/** Participant-scoped repayment list, cursor-paginated and optionally filtered by loan. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("OWNER", "INVESTOR");
    const params = new URLSearchParams(request.nextUrl.searchParams);
    params.delete("cursor");
    params.delete("limit");
    const filters = repaymentListQuerySchema.parse(Object.fromEntries(params));
    const result = await listRepaymentsForActor(session.user as Actor, {
      ...parsePagination(request.nextUrl.searchParams),
      ...filters,
    });
    return ok(result.items, result.meta);
  });
}
