import type { NextRequest } from "next/server";
import { z } from "zod";
import { parsePagination } from "@/lib/pagination";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { listAuditLogs } from "@/server/services/audit-log";

const querySchema = z
  .object({
    action: z.string().trim().max(80).regex(/^[a-z_.]+$/).optional(),
    category: z.enum(["auth.", "account.", "admin.", "loan_request.", "offer.", "agreement.", "repayment.", "verification.", "report."]).optional(),
    actorId: z.string().trim().min(1).max(64).optional(),
    targetId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

/** ADMIN: the activity log, newest first. */
export async function GET(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const url = new URL(request.url);
    const filters = Object.fromEntries(
      ["action", "category", "actorId", "targetId"].flatMap((key) => {
        const value = url.searchParams.get(key);
        return value ? [[key, value]] : [];
      }),
    );
    const query = querySchema.parse(filters);
    const result = await listAuditLogs(session.user as Actor, { ...query, ...parsePagination(url.searchParams) });
    return ok(result.items, result.meta);
  });
}
