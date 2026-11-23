import type { NextRequest } from "next/server";
import { z } from "zod";
import { parsePagination } from "@/lib/pagination";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listAdminLoanRequests } from "@/server/services/admin-oversight";
import { loanRequestStatusSchema } from "@/server/validators/enums";

const querySchema = z
  .object({ status: loanRequestStatusSchema.optional(), q: z.string().trim().max(100).optional() })
  .strict();

/** ADMIN: every loan request on the platform, any status. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const url = new URL(request.url);
    const query = querySchema.parse({
      ...(url.searchParams.get("status") ? { status: url.searchParams.get("status") } : {}),
      ...(url.searchParams.get("q") ? { q: url.searchParams.get("q") } : {}),
    });
    const result = await listAdminLoanRequests(session.user as Actor, { ...query, ...parsePagination(url.searchParams) });
    return ok(result.items, result.meta);
  });
}
