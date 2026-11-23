import type { NextRequest } from "next/server";
import { z } from "zod";
import { parsePagination } from "@/lib/pagination";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listAdminLoans } from "@/server/services/admin-oversight";

const querySchema = z.object({ status: z.enum(["PENDING_AGREEMENT", "ACTIVE", "COMPLETED", "DEFAULTED"]).optional() }).strict();

/** ADMIN: every loan with its parties and repayment progress. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const url = new URL(request.url);
    const query = querySchema.parse(url.searchParams.get("status") ? { status: url.searchParams.get("status") } : {});
    const result = await listAdminLoans(session.user as Actor, { ...query, ...parsePagination(url.searchParams) });
    return ok(result.items, result.meta);
  });
}
